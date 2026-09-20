import streamDeck, {
  action,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  type KeyAction,
} from "@elgato/streamdeck";
import { FootballDataClient, type TeamStanding } from "../api/footballData.js";
import { renderTableButton, type TableDisplayState } from "../rendering/tableRenderer.js";

export interface TableSettings {
  apiKey?: string;
  teamId?: number;
  teamName?: string;
  teamTla?: string;
  competitionCode?: string; // e.g. "PL", "CL", "WC"
  [key: string]: string | number | boolean | null | undefined;
}

interface ButtonState {
  act: KeyAction<TableSettings>;
  settings: TableSettings;
  lastStanding: TeamStanding | null;
  lastDisplay: TableDisplayState;
  pollTimer: ReturnType<typeof setInterval> | null;
}

const POLL_INTERVAL_MS = 2 * 60_000; // standings refresh every 2 minutes

const clients = new Map<string, FootballDataClient>();

@action({ UUID: "com.matchcenter.streamdeck.table" })
export class TablePositionAction extends SingletonAction<TableSettings> {
  private buttons = new Map<string, ButtonState>();

  override async onWillAppear(ev: WillAppearEvent<TableSettings>): Promise<void> {
    const act = ev.action as KeyAction<TableSettings>;
    let settings = await ev.action.getSettings();

    if (!settings.apiKey) {
      try {
        const global = await streamDeck.settings.getGlobalSettings<{ apiKey?: string }>();
        if (global?.apiKey) {
          settings = { ...settings, apiKey: global.apiKey };
          await ev.action.setSettings(settings);
        }
      } catch (err) {
        streamDeck.logger.warn(`[Table] getGlobalSettings failed: ${String(err)}`);
      }
    }

    const btn: ButtonState = {
      act,
      settings,
      lastStanding: null,
      lastDisplay: "NO_API_KEY",
      pollTimer: null,
    };
    this.buttons.set(act.id, btn);

    await this.refresh(btn);
    this.schedulePoll(btn);
  }

  override async onWillDisappear(ev: WillDisappearEvent<TableSettings>): Promise<void> {
    const act = ev.action as KeyAction<TableSettings>;
    const btn = this.buttons.get(act.id);
    if (btn) {
      this.stopPoll(btn);
      this.buttons.delete(act.id);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<TableSettings>): Promise<void> {
    const act = ev.action as KeyAction<TableSettings>;
    const btn = this.buttons.get(act.id);
    if (!btn) return;

    if (btn.settings.teamName && btn.settings.competitionCode) {
      const query = encodeURIComponent(`${btn.settings.teamName} ${btn.settings.competitionCode} table standings`);
      try {
        await streamDeck.system.openUrl(`https://www.google.com/search?q=${query}`);
      } catch (err) {
        streamDeck.logger.warn(`[Table] openUrl failed: ${String(err)}`);
      }
    }

    this.getClient(btn.settings)?.clearCache();
    await this.refresh(btn);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TableSettings>): Promise<void> {
    const act = ev.action as KeyAction<TableSettings>;
    const btn = this.buttons.get(act.id);
    if (!btn) return;
    btn.settings = ev.payload.settings;
    this.getClient(btn.settings)?.clearCache();
    this.stopPoll(btn);
    await this.refresh(btn);
    this.schedulePoll(btn);
  }

  private getClient(settings: TableSettings): FootballDataClient | null {
    const apiKey = settings.apiKey;
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) return null;
    const key = apiKey.trim();
    let client = clients.get(key);
    if (!client) {
      client = new FootballDataClient(key);
      clients.set(key, client);
    }
    return client;
  }

  private async refresh(btn: ButtonState): Promise<void> {
    const { apiKey, teamId, competitionCode } = btn.settings;

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
      await this.draw(btn, "NO_API_KEY", null);
      return;
    }
    if (!teamId) {
      await this.draw(btn, "NO_TEAM", null);
      return;
    }
    if (!competitionCode || competitionCode.trim() === "") {
      await this.draw(btn, "NO_COMPETITION", null);
      return;
    }

    const client = this.getClient(btn.settings)!;
    streamDeck.logger.info(`[Table] refresh: button=${btn.act.id} team=${teamId} comp=${competitionCode}`);

    try {
      const standing = await client.getStandings(competitionCode.trim(), Number(teamId));
      if (standing === null) {
        await this.draw(btn, "NOT_IN_TABLE", null);
      } else {
        btn.lastStanding = standing;
        await this.draw(btn, "TABLE", standing);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      streamDeck.logger.warn(`[Table] Fetch error: ${msg}`);

      if (msg === "PLAN_RESTRICTED") {
        await this.draw(btn, "PLAN_RESTRICTED", null);
      } else if (msg.startsWith("INVALID_API_KEY")) {
        await this.draw(btn, "BAD_KEY", null);
      } else if (msg === "RATE_LIMIT" || msg === "TIMEOUT") {
        // silent: keep showing last standing
      } else if (btn.lastStanding) {
        // transient error: keep showing last good data
        streamDeck.logger.warn(`[Table] Keeping last good standing after error: ${msg}`);
      } else {
        await this.draw(btn, "ERROR", null);
      }
    }
  }

  private async draw(btn: ButtonState, display: TableDisplayState, standing: TeamStanding | null): Promise<void> {
    btn.lastDisplay = display;
    try {
      const image = await renderTableButton({
        display,
        standing,
        competitionCode: btn.settings.competitionCode ?? "",
        teamTla: btn.settings.teamTla,
        teamName: btn.settings.teamName,
      });
      if (image) {
        await btn.act.setImage(image);
        await btn.act.setTitle("");
      } else {
        await this.textFallback(btn, display, standing);
      }
    } catch (err) {
      streamDeck.logger.error(`[Table] Render: ${String(err)}`);
      await this.textFallback(btn, display, standing);
    }
  }

  private async textFallback(btn: ButtonState, display: TableDisplayState, standing: TeamStanding | null): Promise<void> {
    switch (display) {
      case "TABLE":
        if (standing) await btn.act.setTitle(`${standing.position}\n${standing.points} PTS`);
        break;
      case "NO_API_KEY": await btn.act.setTitle("NO\nAPI KEY"); break;
      case "NO_TEAM": await btn.act.setTitle("PICK\nTEAM"); break;
      case "NO_COMPETITION": await btn.act.setTitle("PICK\nLEAGUE"); break;
      case "NOT_IN_TABLE": await btn.act.setTitle("NOT IN\nTABLE"); break;
      case "BAD_KEY": await btn.act.setTitle("BAD KEY"); break;
      case "PLAN_RESTRICTED": await btn.act.setTitle("NOT\nFREE"); break;
      default: await btn.act.setTitle("ERROR");
    }
  }

  private schedulePoll(btn: ButtonState): void {
    this.stopPoll(btn);
    btn.pollTimer = setInterval(async () => {
      await this.refresh(btn);
    }, POLL_INTERVAL_MS);
  }

  private stopPoll(btn: ButtonState): void {
    if (btn.pollTimer) { clearInterval(btn.pollTimer); btn.pollTimer = null; }
  }
}
