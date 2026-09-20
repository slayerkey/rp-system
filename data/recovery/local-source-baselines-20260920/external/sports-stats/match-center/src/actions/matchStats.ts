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
import { renderStatsButton, extractStats, type StatsDisplayState } from "../rendering/statsRenderer.js";
import { teamCrestUrl } from "../rendering/scoreRenderer.js";
import { STATS_DEMO_STATES } from "../utils/statsDemoStates.js";

export interface MatchStatsSettings {
  apiKey?: string;
  teamId?: number;
  teamName?: string;
  teamTla?: string;
  previewMode?: boolean;
  [key: string]: string | number | boolean | null | undefined;
}

interface ButtonState {
  act: KeyAction<MatchStatsSettings>;
  settings: MatchStatsSettings;
  pollTimer: ReturnType<typeof setInterval> | null;
  lastDisplay: StatsDisplayState;
  previewIndex: number;
}

const clients = new Map<string, FootballDataClient>();
const POLL_LIVE_MS   = 30_000;   // 30s during live match
const POLL_IDLE_MS   = 2 * 60_000; // 2min when no live match

@action({ UUID: "com.matchcenter.streamdeck.stats" })
export class MatchStatsAction extends SingletonAction<MatchStatsSettings> {
  private buttons = new Map<string, ButtonState>();

  override async onWillAppear(ev: WillAppearEvent<MatchStatsSettings>): Promise<void> {
    const act = ev.action as KeyAction<MatchStatsSettings>;
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

  override async onWillDisappear(ev: WillDisappearEvent<MatchStatsSettings>): Promise<void> {
    const act = ev.action as KeyAction<MatchStatsSettings>;
    const btn = this.buttons.get(act.id);
    if (btn) { this.stopPoll(btn); this.buttons.delete(act.id); }
  }

  // In Preview Mode, pressing cycles through synthetic states so the layout
  // can be checked without waiting for a real live match. Otherwise the
  // button does nothing on press — the poll timer already keeps it current,
  // so a manual "force refresh" press was redundant.
  override async onKeyDown(ev: KeyDownEvent<MatchStatsSettings>): Promise<void> {
    const act = ev.action as KeyAction<MatchStatsSettings>;
    const btn = this.buttons.get(act.id);
    if (!btn) return;
    if (btn.settings.previewMode) {
      btn.previewIndex = (btn.previewIndex + 1) % STATS_DEMO_STATES.length;
      const demoState = STATS_DEMO_STATES[btn.previewIndex];
      await this.draw(btn, demoState);
      // Crest images load in the background and aren't ready on the very
      // first draw — redraw once they've had time to arrive so Preview Mode
      // doesn't require a second press to see the real flag.
      if (demoState.homeCrestUrl || demoState.awayCrestUrl) {
        setTimeout(() => { void this.draw(btn, demoState); }, 700);
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<MatchStatsSettings>): Promise<void> {
    const act = ev.action as KeyAction<MatchStatsSettings>;
    const btn = this.buttons.get(act.id);
    if (!btn) return;
    btn.settings = ev.payload.settings;
    this.getClient(btn.settings)?.clearCache();
    this.stopPoll(btn);
    await this.refresh(btn);
    this.schedulePoll(btn);
  }

  private getClient(settings: MatchStatsSettings): FootballDataClient | null {
    const k = settings.apiKey?.trim();
    if (!k) return null;
    let c = clients.get(k);
    if (!c) { c = new FootballDataClient(k); clients.set(k, c); }
    return c;
  }

  private async refresh(btn: ButtonState): Promise<void> {
    if (btn.settings.previewMode) return; // don't clobber the demo display with live data

    const { apiKey, teamId } = btn.settings;
    if (!apiKey?.trim()) { btn.lastDisplay = "NO_API_KEY"; await this.draw(btn, { display: "NO_API_KEY", homeTeam: "", awayTeam: "", isHome: false, minute: null, homeScore: 0, awayScore: 0, stats: [] }); return; }
    if (!teamId) { btn.lastDisplay = "NO_TEAM"; await this.draw(btn, { display: "NO_TEAM", homeTeam: "", awayTeam: "", isHome: false, minute: null, homeScore: 0, awayScore: 0, stats: [] }); return; }

    const client = this.getClient(btn.settings)!;
    streamDeck.logger.info(`[Stats] refresh: button=${btn.act.id} teamId=${teamId}`);
    try {
      const matches = await client.getTeamMatches(Number(teamId));
      const live = matches.find(m => m.status === "IN_PLAY" || m.status === "PAUSED");

      if (!live) {
        btn.lastDisplay = "NO_LIVE";
        await this.draw(btn, { display: "NO_LIVE", homeTeam: "", awayTeam: "", isHome: false, minute: null, homeScore: 0, awayScore: 0, stats: [] });
        return;
      }

      const isHome = live.homeTeam.id === Number(teamId);
      const detail = await client.getMatchDetail(live.id);
      const stats = extractStats(detail);

      const homeCrestUrl = teamCrestUrl(live.homeTeam);
      const awayCrestUrl = teamCrestUrl(live.awayTeam);

      if (stats.length === 0) {
        btn.lastDisplay = "NO_STATS";
        await this.draw(btn, {
          display: "NO_STATS",
          homeTeam: live.homeTeam.tla,
          awayTeam: live.awayTeam.tla,
          homeCrestUrl,
          awayCrestUrl,
          isHome,
          minute: live.minute,
          homeScore: live.score.fullTime.home ?? 0,
          awayScore: live.score.fullTime.away ?? 0,
          stats: [],
        });
      } else {
        btn.lastDisplay = "STATS";
        await this.draw(btn, {
          display: "STATS",
          homeTeam: live.homeTeam.tla,
          awayTeam: live.awayTeam.tla,
          homeCrestUrl,
          awayCrestUrl,
          isHome,
          minute: live.minute,
          homeScore: live.score.fullTime.home ?? 0,
          awayScore: live.score.fullTime.away ?? 0,
          stats,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      streamDeck.logger.warn(`[Stats] Fetch error: ${msg}`);
      if (msg.startsWith("INVALID_API_KEY")) { btn.lastDisplay = "BAD_KEY"; await this.draw(btn, { display: "BAD_KEY", homeTeam: "", awayTeam: "", isHome: false, minute: null, homeScore: 0, awayScore: 0, stats: [] }); }
    }
  }

  private async draw(btn: ButtonState, state: Parameters<typeof renderStatsButton>[0]): Promise<void> {
    try {
      const img = await renderStatsButton(state);
      if (img) { await btn.act.setImage(img); await btn.act.setTitle(""); }
      else await this.textFallback(btn, state);
    } catch (err) {
      streamDeck.logger.error(`[Stats] Render: ${String(err)}`);
      await this.textFallback(btn, state);
    }
  }

  private async textFallback(btn: ButtonState, state: Parameters<typeof renderStatsButton>[0]): Promise<void> {
    try {
      await btn.act.setTitle(state.display.replace(/_/g, "\n"));
    } catch (err) {
      streamDeck.logger.error(`[Stats] setTitle fallback failed: ${String(err)}`);
    }
  }

  private schedulePoll(btn: ButtonState): void {
    this.stopPoll(btn);
    const ms = btn.lastDisplay === "STATS" || btn.lastDisplay === "NO_STATS" ? POLL_LIVE_MS : POLL_IDLE_MS;
    btn.pollTimer = setInterval(async () => {
      await this.refresh(btn);
      this.stopPoll(btn);
      this.schedulePoll(btn);
    }, ms);
  }

  private stopPoll(btn: ButtonState): void {
    if (btn.pollTimer) { clearInterval(btn.pollTimer); btn.pollTimer = null; }
  }
}
