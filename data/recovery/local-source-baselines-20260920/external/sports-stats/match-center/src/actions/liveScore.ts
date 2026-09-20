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
import { deriveMatchState, getPollIntervalMs, type MatchState } from "../utils/stateMachine.js";
import { renderButton } from "../rendering/scoreRenderer.js";
import { DEMO_STATES } from "../utils/demoStates.js";

export interface LiveScoreSettings {
  apiKey?: string;
  teamId?: number;
  teamName?: string;
  teamTla?: string;
  teamArea?: string;
  previewMode?: boolean;
  viewMode?: "auto" | "next_match" | "flag_only";
  competitionFilter?: string; // competition code (e.g. "WC", "PL") or "ALL"
  [key: string]: string | number | boolean | null | undefined;
}

// Per-button state. SingletonAction means ONE instance of this class handles
// every button of this type, so all mutable state must be keyed by button id
// (act.id) rather than stored on `this` -- otherwise a second button silently
// overwrites the first button's timer/settings/state.
interface ButtonState {
  act: KeyAction<LiveScoreSettings>;
  settings: LiveScoreSettings;
  lastState: MatchState | null;
  prevGoalCount: number;
  flashPhase: number;
  goalFlashCount: number;
  pollTimer: ReturnType<typeof setInterval> | null;
  previewIndex: number;
}

// Shared across buttons that use the same API key, to pool the rate-limit budget.
const clients = new Map<string, FootballDataClient>();

@action({ UUID: "com.matchcenter.streamdeck.livescore" })
export class LiveScoreAction extends SingletonAction<LiveScoreSettings> {
  private buttons = new Map<string, ButtonState>();
  private flashTimer: ReturnType<typeof setInterval> | null = null;

  override async onWillAppear(ev: WillAppearEvent<LiveScoreSettings>): Promise<void> {
    const act = ev.action as KeyAction<LiveScoreSettings>;
    let settings = await ev.action.getSettings();

    if (!settings.apiKey) {
      try {
        const global = await streamDeck.settings.getGlobalSettings<{ apiKey?: string }>();
        if (global?.apiKey) {
          settings = { ...settings, apiKey: global.apiKey };
          await ev.action.setSettings(settings);
        }
      } catch (err) {
        streamDeck.logger.warn(`[MatchCenter] getGlobalSettings failed: ${String(err)}`);
      }
    }

    const btn: ButtonState = {
      act,
      settings,
      lastState: null,
      prevGoalCount: 0,
      flashPhase: 0,
      goalFlashCount: 0,
      pollTimer: null,
      previewIndex: -1,
    };
    this.buttons.set(act.id, btn);

    await this.showInitialState(btn);
    await this.refresh(btn);
    this.ensureFlashTimer();
    this.schedulePoll(btn);
  }

  override async onWillDisappear(ev: WillDisappearEvent<LiveScoreSettings>): Promise<void> {
    const act = ev.action as KeyAction<LiveScoreSettings>;
    const btn = this.buttons.get(act.id);
    if (btn) {
      this.stopPoll(btn);
      this.buttons.delete(act.id);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<LiveScoreSettings>): Promise<void> {
    const act = ev.action as KeyAction<LiveScoreSettings>;
    const btn = this.buttons.get(act.id);
    if (!btn) return;

    if (btn.settings.previewMode) {
      btn.previewIndex = (btn.previewIndex + 1) % DEMO_STATES.length;
      const demo = DEMO_STATES[btn.previewIndex];
      btn.lastState = demo;
      await this.drawButton(btn, demo);
      return;
    }

    // football-data.org's free tier has no match permalink, so open a live
    // score search for the match instead.
    const m = btn.lastState?.match ?? btn.lastState?.nextMatch;
    if (m) {
      const query = encodeURIComponent(`${m.homeTeam.name} vs ${m.awayTeam.name} score`);
      try {
        await streamDeck.system.openUrl(`https://www.google.com/search?q=${query}`);
      } catch (err) {
        streamDeck.logger.warn(`[MatchCenter] openUrl failed: ${String(err)}`);
      }
    }

    this.getClient(btn.settings)?.clearCache();
    await this.refresh(btn);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<LiveScoreSettings>): Promise<void> {
    const act = ev.action as KeyAction<LiveScoreSettings>;
    const btn = this.buttons.get(act.id);
    if (!btn) return;
    btn.settings = ev.payload.settings;
    this.getClient(btn.settings)?.clearCache();
    this.stopPoll(btn);
    await this.refresh(btn);
    this.schedulePoll(btn);
  }

  private getClient(settings: LiveScoreSettings): FootballDataClient | null {
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

  private async showInitialState(btn: ButtonState): Promise<void> {
    if (!btn.settings.apiKey) {
      await this.drawButton(btn, makeErrorState("NO_API_KEY"));
    } else if (!btn.settings.teamId) {
      await this.drawButton(btn, makeErrorState("NO_TEAM"));
    }
  }

  private async refresh(btn: ButtonState): Promise<void> {
    if (btn.settings.previewMode) return; // don't clobber the demo display with live data

    const apiKey = btn.settings.apiKey;
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
      btn.lastState = makeErrorState("NO_API_KEY");
      await this.drawButton(btn, btn.lastState);
      return;
    }

    const client = this.getClient(btn.settings);
    if (!client) return;

    if (!btn.settings.teamId) {
      btn.lastState = makeErrorState("NO_TEAM");
      await this.drawButton(btn, btn.lastState);
      return;
    }

    // Flag-only view doesn't need match data at all -- skip the API call entirely.
    if (btn.settings.viewMode === "flag_only") {
      btn.lastState = makeErrorState("FLAG_ONLY");
      await this.drawButton(btn, btn.lastState);
      return;
    }

    const teamId = Number(btn.settings.teamId);
    streamDeck.logger.info(`[MatchCenter] refresh: button=${btn.act.id} teamId=${teamId}`);

    try {
      const allMatches = await client.getTeamMatches(teamId);
      const filterCode = btn.settings.competitionFilter;
      const matches =
        filterCode && filterCode !== "ALL"
          ? allMatches.filter((m) => m.competition.code === filterCode)
          : allMatches;
      const state = deriveMatchState(matches, teamId, {
        skipPastResult: btn.settings.viewMode === "next_match",
      });

      const nowGoals = state.match?.goals?.length ?? 0;
      if (btn.lastState?.display === "LIVE" && nowGoals > btn.prevGoalCount) {
        const lastGoal = state.match?.goals?.[nowGoals - 1];
        state.goalFlashActive = true;
        state.lastGoalScorer = lastGoal?.scorer?.name ?? null;
        state.lastGoalTeamId = lastGoal?.team.id ?? null;
        btn.goalFlashCount = 0;
      } else if (btn.lastState?.goalFlashActive && btn.goalFlashCount < 8) {
        state.goalFlashActive = true;
        state.lastGoalScorer = btn.lastState.lastGoalScorer;
        state.lastGoalTeamId = btn.lastState.lastGoalTeamId;
      }

      btn.prevGoalCount = nowGoals;
      btn.lastState = state;
      await this.drawButton(btn, state);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      streamDeck.logger.warn(`[MatchCenter] Fetch error: ${msg}`);

      if (msg === "PLAN_RESTRICTED") {
        btn.lastState = makeErrorState("PLAN_RESTRICTED");
        await this.drawButton(btn, btn.lastState);
      } else if (msg.startsWith("INVALID_API_KEY")) {
        btn.lastState = makeErrorState("BAD_KEY");
        await this.drawButton(btn, btn.lastState);
      } else if (msg === "RATE_LIMIT" || msg === "TIMEOUT") {
        // silent: keep showing last state, retry on next poll
      } else if (btn.lastState && btn.lastState.display !== "ERROR") {
        // A transient/unexpected error shouldn't wipe a perfectly good
        // live score off the screen -- keep showing it and retry next poll.
        streamDeck.logger.warn(`[MatchCenter] Keeping last good state after error: ${msg}`);
      } else {
        btn.lastState = makeErrorState("ERROR");
        await this.drawButton(btn, btn.lastState);
      }
    }
  }

  private async drawButton(btn: ButtonState, state: MatchState): Promise<void> {
    const teamId = Number(btn.settings.teamId ?? 0);
    const teamLabel = { name: btn.settings.teamName, tla: btn.settings.teamTla };
    try {
      const image = await renderButton(state, teamId, btn.flashPhase, teamLabel);
      if (image) {
        await btn.act.setImage(image);
        await btn.act.setTitle("");
      } else {
        await this.textFallback(btn, state);
      }
    } catch (err) {
      streamDeck.logger.error(`[MatchCenter] Render: ${String(err)}`);
      await this.textFallback(btn, state);
    }
  }

  private async textFallback(btn: ButtonState, state: MatchState): Promise<void> {
    const act = btn.act;
    switch (state.display) {
      case "NO_API_KEY": await act.setTitle("NO\nAPI KEY"); break;
      case "BAD_KEY": await act.setTitle("BAD KEY"); break;
      case "PLAN_RESTRICTED": await act.setTitle("NOT FREE"); break;
      case "NO_TEAM": await act.setTitle("PICK TEAM"); break;
      case "NO_MATCH": await act.setTitle("NO\nMATCH"); break;
      case "FLAG_ONLY": await act.setTitle(btn.settings.teamTla ?? btn.settings.teamName ?? ""); break;
      case "PRE_MATCH": {
        const m = state.nextMatch;
        if (m) {
          const t = new Date(m.utcDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          await act.setTitle(`${m.homeTeam.tla}\nvs\n${m.awayTeam.tla}\n${t}`);
        }
        break;
      }
      case "KICKOFF_IMMINENT": await act.setTitle("⚽\nKick Off\nSoon!"); break;
      case "LIVE": await act.setTitle(`${state.minute ?? "?"}'  LIVE\n${state.homeScore}-${state.awayScore}`); break;
      case "HALF_TIME": await act.setTitle(`HT\n${state.homeScore}-${state.awayScore}`); break;
      case "EXTRA_TIME": await act.setTitle(`ET ${state.minute ?? ""}\n${state.homeScore}-${state.awayScore}`); break;
      case "PENALTIES": await act.setTitle(`PENS\n${state.homeScore}-${state.awayScore}`); break;
      case "FULL_TIME": await act.setTitle(`FT\n${state.homeScore}-${state.awayScore}`); break;
      case "POSTPONED": await act.setTitle("PPD\nPostponed"); break;
      default: await act.setTitle(String(state.display).replace(/_/g, " "));
    }
  }

  private ensureFlashTimer(): void {
    if (this.flashTimer) return;
    this.flashTimer = setInterval(async () => {
      for (const btn of this.buttons.values()) {
        if (!btn.lastState) continue;
        btn.flashPhase++;
        if (btn.lastState.goalFlashActive) {
          btn.goalFlashCount++;
          if (btn.goalFlashCount >= 8) {
            btn.lastState.goalFlashActive = false;
            btn.goalFlashCount = 0;
          }
        }
        const needsFlash =
          btn.lastState.display === "LIVE" ||
          btn.lastState.display === "KICKOFF_IMMINENT" ||
          btn.lastState.goalFlashActive;
        if (needsFlash) await this.drawButton(btn, btn.lastState);
      }
    }, 500);
  }

  private schedulePoll(btn: ButtonState): void {
    this.stopPoll(btn);
    const interval = btn.lastState ? getPollIntervalMs(btn.lastState) : 60_000;
    btn.pollTimer = setInterval(async () => {
      await this.refresh(btn);
      this.stopPoll(btn);
      this.schedulePoll(btn);
    }, interval);
  }

  private stopPoll(btn: ButtonState): void {
    if (btn.pollTimer) { clearInterval(btn.pollTimer); btn.pollTimer = null; }
  }
}

function makeErrorState(display: MatchState["display"]): MatchState {
  return {
    display,
    match: null,
    nextMatch: null,
    minutesUntilKickoff: null,
    homeScore: 0,
    awayScore: 0,
    minute: null,
    injuryTime: null,
    lastGoalScorer: null,
    lastGoalTeamId: null,
    goalFlashActive: false,
    isHomeTeam: false,
  };
}
