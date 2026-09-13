import streamDeck, { SingletonAction } from "@elgato/streamdeck";
import { startMacroRecorder } from "../../../shared/macro-recorder/runtime.mjs";

startMacroRecorder({
  streamDeck,
  SingletonAction,
  pro: false,
  prefix: "com.packrat.macro-recorder-lite",
  version: "1.0.0.0",
}).catch((error) => {
  streamDeck.logger?.error?.(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
