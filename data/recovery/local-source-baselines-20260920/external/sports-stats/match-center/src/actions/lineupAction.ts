import streamDeck, {
  action,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  type KeyAction,
} from "@elgato/streamdeck";
import { FootballDataClient } from "../api/footballData.js";
import { renderLineupButton, type LineupDisplayState } from "../rendering/lineupRenderer.js";
import { LINEUP_DEMO_STATES } from "../utils/lineupDemoStates.js";

export interface LineupSettings {
  apiKey?: string;
  teamId?: number;
  teamName?: string;
  teamTla?: string;
  previewMode?: boolean;
  [key: string]: string | number | boolean | null | undefined;
}

interface ButtonState {
  act: KeyAction<LineupSettings>;
  settings: LineupSettings;
  pollTimer: ReturnType<typeof setInterval> | null;
  lastDisplay: LineupDisplayState;
  previewIndex: number;
}

const clients = new Map<string, FootballDataClient>();
const POLL_CONFIRMED_MS = 60_000;   // poll every 60s when lineup confirmed (in case of changes)
const POLL_PENDING_MS  = 5 * 60_000; // poll every 5min when waiting for lineup

@action({ UUID: "com.matchcenter.streamdeck.lineup" })
export class LineupAction extends SingletonAction<LineupSettings> {
  private buttons = new Map<string, ButtonState>();

  override async onWillAppear(ev: WillAppearEvent<LineupSettings>): Promise<void> {
    const act = ev.action as KeyAction<LineupSettings>;
    let settings = await ev.action.getSettings();
    if (!settings.apiKey) {
      try {
        const global = await streamDeck.settings.getGlobalSettings<{ apiKey?: string }>();
        if (global?.apiKey) { settings = { ...settings, apiKey: global.apiKey }; await ev.action.setSettings(settings); }
      } catch {}
    }
    // Default to a globally popular club so a freshly-dropped button never
    // sits blank on "PICK A TEAM" before the user opens settings.
    if (!settings.teamId) {
      settings = { ...settings, teamId: 66, teamName: "Manchester United", teamTla: "MUN" };
      await ev.action.setSettings(settings);
    }
    const btn: ButtonState = { act, settings, pollTimer: null, lastDisplay: "NO_API_KEY", previewIndex: -1 };
    this.buttons.set(act.id, btn);
    await this.refresh(btn);
    this.schedulePoll(btn);
  }

  override async onWillDisappear(ev: WillDisappearEvent<LineupSettings>): Promise<void> {
    const act = ev.action as KeyAction<LineupSettings>;
    const btn = this.buttons.get(act.id);
    if (btn) { this.stopPoll(btn); this.buttons.delete(act.id); }
  }

  // In Preview Mode, pressing cycles through synthetic states so the layout
  // can be checked without waiting for a real match. Otherwise the button
  // does nothing on press — the poll timer already keeps it current, so a
  // manual "force refresh" press was redundant.
  override async onKeyDown(ev: KeyDownEvent<LineupSettings>): Promise<void> {
    const act = ev.action as KeyAction<LineupSettings>;
    const btn = this.buttons.get(act.id);
    if (!btn) return;
    if (btn.settings.previewMode) {
      btn.previewIndex = (btn.previewIndex + 1) % LINEUP_DEMO_STATES.length;
      await this.draw(btn, LINEUP_DEMO_STATES[btn.previewIndex]);
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<LineupSettings>): Promise<void> {
    const act = ev.action as KeyAction<LineupSettings>;
    const btn = this.buttons.get(act.id);
    if (!btn) return;
    btn.settings = ev.payload.settings;
    this.getClient(btn.settings)?.clearCache();
    this.stopPoll(btn);
    await this.refresh(btn);
    this.schedulePoll(btn);
  }

  private getClient(settings: LineupSettings): FootballDataClient | null {
    const k = settings.apiKey?.trim();
    if (!k) return null;
    let c = clients.get(k);
    if (!c) { c = new FootballDataClient(k); clients.set(k, c); }
    return c;
  }

  private async refresh(btn: ButtonState): Promise<void> {
    if (btn.settings.previewMode) return; // don't clobber the demo display with live data

    const { apiKey, teamId, teamTla } = btn.settings;
    const ownTeamTla = teamTla ?? null;
    if (!apiKey?.trim()) { await this.draw(btn, this.emptyState("NO_API_KEY", ownTeamTla)); return; }
    if (!teamId) { await this.draw(btn, this.emptyState("NO_TEAM", ownTeamTla)); return; }

    const client = this.getClient(btn.settings)!;
    streamDeck.logger.info(`[Lineup] refresh: button=${btn.act.id} teamId=${teamId}`);
    try {
      const matches = await client.getTeamMatches(Number(teamId));
      // Find current or next upcoming match
      const live = matches.find(m => m.status === "IN_PLAY" || m.status === "PAUSED");
      const upcoming = matches.find(m => m.status === "TIMED" || m.status === "SCHEDULED");
      const target = live ?? upcoming;

      if (!target) {
        await this.draw(btn, this.emptyState("NO_MATCH", ownTeamTla));
        return;
      }

      const isHome = target.homeTeam.id === Number(teamId);
      const opponent = isHome ? target.awayTeam.shortName || target.awayTeam.tla : target.homeTeam.shortName || target.homeTeam.tla;

      // Fetch match detail for lineup
      const detail = await client.getMatchDetail(target.id);
      const myTeamDetail = isHome ? detail.homeTeam : detail.awayTeam;
      const hasLineup = myTeamDetail.lineup && myTeamDetail.lineup.length > 0;

      if (hasLineup) {
        btn.lastDisplay = "LINEUP_CONFIRMED";
        await this.draw(btn, {
          display: "LINEUP_CONFIRMED",
          ownTeamTla,
          formation: myTeamDetail.formation,
          matchStatus: target.status,
          opponent,
          isHome,
          minute: target.minute,
          players: myTeamDetail.lineup,
        });
      } else {
        btn.lastDisplay = "LINEUP_PENDING";
        await this.draw(btn, {
          display: "LINEUP_PENDING",
          ownTeamTla,
          formation: null,
          matchStatus: target.status,
          opponent,
          isHome,
          minute: target.minute,
          players: [],
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      streamDeck.logger.warn(`[Lineup] Fetch error: ${msg}`);
      if (msg.startsWith("INVALID_API_KEY")) await this.draw(btn, this.emptyState("BAD_KEY", ownTeamTla));
      else if (msg !== "RATE_LIMIT" && msg !== "TIMEOUT") await this.draw(btn, this.emptyState("ERROR", ownTeamTla));
    }
  }

  private emptyState(display: LineupDisplayState, ownTeamTla: string | null): Parameters<typeof renderLineupButton>[0] {
    return { display, ownTeamTla, formation: null, matchStatus: null, opponent: null, isHome: false, minute: null, players: [] };
  }

  private async draw(btn: ButtonState, state: Parameters<typeof renderLineupButton>[0]): Promise<void> {
    try {
      const img = await renderLineupButton(state);
      if (img) { await btn.act.setImage(img); await btn.act.setTitle(""); }
      else await this.textFallback(btn, state);
    } catch (err) {
      streamDeck.logger.error(`[Lineup] Render: ${String(err)}`);
      await this.textFallback(btn, state);
    }
  }

  private async textFallback(btn: ButtonState, state: Parameters<typeof renderLineupButton>[0]): Promise<void> {
    try {
      const title = state.display === "LINEUP_CONFIRMED" ? state.formation ?? "LINEUP" : state.display.replace(/_/g, "\n");
      await btn.act.setTitle(title);
    } catch (err) {
      streamDeck.logger.error(`[Lineup] setTitle fallback failed: ${String(err)}`);
    }
  }

  private schedulePoll(btn: ButtonState): void {
    this.stopPoll(btn);
    const ms = btn.lastDisplay === "LINEUP_CONFIRMED" ? POLL_CONFIRMED_MS : POLL_PENDING_MS;
    btn.pollTimer = setInterval(async () => { await this.refresh(btn); }, ms);
  }

  private stopPoll(btn: ButtonState): void {
    if (btn.pollTimer) { clearInterval(btn.pollTimer); btn.pollTimer = null; }
  }
}
