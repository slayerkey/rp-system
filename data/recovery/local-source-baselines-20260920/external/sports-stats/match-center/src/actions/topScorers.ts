import streamDeck, {
  action,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  type KeyAction,
} from "@elgato/streamdeck";
import { FootballDataClient, type ScorerEntry } from "../api/footballData.js";
import { renderScorersButton, type ScorersDisplayState } from "../rendering/scorersRenderer.js";

export interface TopScorersSettings {
  apiKey?: string;
  competitionCode?: string;
  competitionName?: string;
  [key: string]: string | number | boolean | null | undefined;
}

interface ButtonState {
  act: KeyAction<TopScorersSettings>;
  settings: TopScorersSettings;
  lastScorers: ScorerEntry[];
  page: number;
  pollTimer: ReturnType<typeof setInterval> | null;
}

const POLL_MS = 10 * 60_000; // scorers update every 10 minutes
const PAGE_SIZE = 3;

const clients = new Map<string, FootballDataClient>();

@action({ UUID: "com.matchcenter.streamdeck.scorers" })
export class TopScorersAction extends SingletonAction<TopScorersSettings> {
  private buttons = new Map<string, ButtonState>();

  override async onWillAppear(ev: WillAppearEvent<TopScorersSettings>): Promise<void> {
    const act = ev.action as KeyAction<TopScorersSettings>;
    let settings = await ev.action.getSettings();
    if (!settings.apiKey) {
      try {
        const global = await streamDeck.settings.getGlobalSettings<{ apiKey?: string }>();
        if (global?.apiKey) { settings = { ...settings, apiKey: global.apiKey }; await ev.action.setSettings(settings); }
      } catch {}
    }
    const btn: ButtonState = { act, settings, lastScorers: [], page: 0, pollTimer: null };
    this.buttons.set(act.id, btn);
    await this.refresh(btn);
    this.schedulePoll(btn);
  }

  override async onWillDisappear(ev: WillDisappearEvent<TopScorersSettings>): Promise<void> {
    const act = ev.action as KeyAction<TopScorersSettings>;
    const btn = this.buttons.get(act.id);
    if (btn) { this.stopPoll(btn); this.buttons.delete(act.id); }
  }

  // Press cycles to the next 3 scorers (wraps around) — no network call,
  // just re-slices the already-fetched list. Freshness is handled by the
  // poll timer, not by pressing the button.
  override async onKeyDown(ev: KeyDownEvent<TopScorersSettings>): Promise<void> {
    const act = ev.action as KeyAction<TopScorersSettings>;
    const btn = this.buttons.get(act.id);
    if (!btn || btn.lastScorers.length <= PAGE_SIZE) return;
    const totalPages = Math.ceil(btn.lastScorers.length / PAGE_SIZE);
    btn.page = (btn.page + 1) % totalPages;
    await this.drawPage(btn);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TopScorersSettings>): Promise<void> {
    const act = ev.action as KeyAction<TopScorersSettings>;
    const btn = this.buttons.get(act.id);
    if (!btn) return;
    btn.settings = ev.payload.settings;
    this.getClient(btn.settings)?.clearCache();
    this.stopPoll(btn);
    await this.refresh(btn);
    this.schedulePoll(btn);
  }

  private getClient(settings: TopScorersSettings): FootballDataClient | null {
    const k = settings.apiKey?.trim();
    if (!k) return null;
    let c = clients.get(k);
    if (!c) { c = new FootballDataClient(k); clients.set(k, c); }
    return c;
  }

  private async refresh(btn: ButtonState): Promise<void> {
    const { apiKey, competitionCode, competitionName } = btn.settings;
    const compName = competitionName ?? competitionCode ?? "";

    if (!apiKey?.trim()) { await this.draw(btn, this.emptyState("NO_API_KEY")); return; }
    if (!competitionCode?.trim()) { await this.draw(btn, this.emptyState("NO_COMPETITION")); return; }

    const client = this.getClient(btn.settings)!;
    streamDeck.logger.info(`[Scorers] refresh: button=${btn.act.id} comp=${competitionCode}`);
    try {
      const scorers = await client.getTopScorers(competitionCode.trim());
      btn.lastScorers = scorers;
      btn.page = 0;
      if (scorers.length === 0) {
        await this.draw(btn, { display: "EMPTY", competitionCode, competitionName: compName, scorers: [], startRank: 1, page: 0, totalPages: 1 });
      } else {
        await this.drawPage(btn);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      streamDeck.logger.warn(`[Scorers] Fetch error: ${msg}`);
      if (msg === "PLAN_RESTRICTED") await this.draw(btn, this.emptyState("PLAN_RESTRICTED"));
      else if (msg.startsWith("INVALID_API_KEY")) await this.draw(btn, this.emptyState("BAD_KEY"));
      else if (msg !== "RATE_LIMIT" && msg !== "TIMEOUT" && btn.lastScorers.length === 0) {
        await this.draw(btn, this.emptyState("ERROR"));
      }
    }
  }

  private async drawPage(btn: ButtonState): Promise<void> {
    const { competitionCode, competitionName } = btn.settings;
    const compName = competitionName ?? competitionCode ?? "";
    const totalPages = Math.max(1, Math.ceil(btn.lastScorers.length / PAGE_SIZE));
    const page = ((btn.page % totalPages) + totalPages) % totalPages;
    const startRank = page * PAGE_SIZE + 1;
    const slice = btn.lastScorers.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    await this.draw(btn, {
      display: "SCORERS",
      competitionCode: competitionCode ?? "",
      competitionName: compName,
      scorers: slice,
      startRank,
      page,
      totalPages,
    });
  }

  private emptyState(display: ScorersDisplayState): Parameters<typeof renderScorersButton>[0] {
    return { display, competitionCode: "", competitionName: "", scorers: [], startRank: 1, page: 0, totalPages: 1 };
  }

  private async draw(btn: ButtonState, state: Parameters<typeof renderScorersButton>[0]): Promise<void> {
    try {
      const img = await renderScorersButton(state);
      if (img) { await btn.act.setImage(img); await btn.act.setTitle(""); }
      else await this.textFallback(btn, state);
    } catch (err) {
      streamDeck.logger.error(`[Scorers] Render: ${String(err)}`);
      await this.textFallback(btn, state);
    }
  }

  private async textFallback(btn: ButtonState, state: Parameters<typeof renderScorersButton>[0]): Promise<void> {
    try {
      const title = state.display === "SCORERS" && state.scorers[0]
        ? `${state.scorers[0].player.name}\n${state.scorers[0].goals} goals`
        : state.display.replace(/_/g, "\n");
      await btn.act.setTitle(title);
    } catch (err) {
      streamDeck.logger.error(`[Scorers] setTitle fallback failed: ${String(err)}`);
    }
  }

  private schedulePoll(btn: ButtonState): void {
    this.stopPoll(btn);
    btn.pollTimer = setInterval(async () => { await this.refresh(btn); }, POLL_MS);
  }

  private stopPoll(btn: ButtonState): void {
    if (btn.pollTimer) { clearInterval(btn.pollTimer); btn.pollTimer = null; }
  }
}
