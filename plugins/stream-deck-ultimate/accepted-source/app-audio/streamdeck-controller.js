"use strict";
const surface = require("./streamdeck-surface-model.js");

class AppAudioStreamDeckController {
  constructor(options = {}) {
    if (!options.service) throw new Error("AppAudioStreamDeckController requires a service");
    this.service = options.service;
    this.render = options.render || (() => {});
    this.instances = new Map();
    this.disposed = false;
  }

  _settings(raw = {}) { return surface.sanitizeSettings(raw); }
  _target(settings) { return surface.targetFromSettings(settings); }

  async _foreground(target) {
    return target?.kind === "current" ? await this.service.foreground() : {};
  }

  _view(state, inst) {
    const visual = surface.semanticVisual(state, inst.settings);
    const feedback = inst.controller === "Encoder" ? surface.dialFeedback(state, inst.settings) : null;
    return { state, visual, feedback, controller: inst.controller, settings: { ...inst.settings } };
  }

  async _emit(context, inst, state) {
    if (!this.instances.has(context) || this.disposed) return null;
    inst.lastState = state;
    const view = this._view(state, inst);
    inst.lastView = view;
    await this.render(context, view);
    return view;
  }

  async appear(context, rawSettings = {}, controller = "Keypad") {
    if (this.disposed) return null;
    const inst = {
      context,
      controller: controller === "Encoder" ? "Encoder" : "Keypad",
      settings: this._settings(rawSettings),
      lastState: null,
      lastView: null
    };
    this.instances.set(context, inst);
    return this.refreshContext(context, true);
  }

  async settingsChanged(context, rawSettings = {}) {
    const inst = this.instances.get(context);
    if (!inst || this.disposed) return null;
    inst.settings = this._settings(rawSettings);
    return this.refreshContext(context, true);
  }

  disappear(context) {
    return this.instances.delete(context);
  }

  async refreshContext(context, force = false) {
    const inst = this.instances.get(context);
    if (!inst || this.disposed) return null;
    if (force) this.service.invalidate();
    const target = this._target(inst.settings);
    const foreground = await this._foreground(target);
    const state = await this.service.stateFor(target, foreground);
    return this._emit(context, inst, state);
  }

  async refreshVisible(force = false) {
    if (this.disposed) return [];
    if (force) this.service.invalidate();
    const contexts = [...this.instances.keys()];
    return Promise.all(contexts.map(context => this.refreshContext(context, false)));
  }

  async dialRotate(context, ticks) {
    const inst = this.instances.get(context);
    if (!inst || this.disposed) return { executed: false, reason: "missing-instance" };
    if (inst.controller !== "Encoder") return { executed: false, reason: "not-encoder" };
    const command = surface.rotateCommand(ticks, inst.settings);
    if (!command) return { executed: false, reason: "zero-delta" };
    const target = this._target(inst.settings);
    // Capture foreground once. AppAudioService converts Current App into a concrete PID/process
    // before the coalescing timer runs, so focus changes during a fast dial burst cannot retarget it.
    const foreground = await this._foreground(target);
    const result = await this.service.adjustCoalesced(target, command.delta, foreground);
    const state = result?.after || await this.service.stateFor(target, foreground);
    await this._emit(context, inst, state);
    return result;
  }

  async press(context) {
    const inst = this.instances.get(context);
    if (!inst || this.disposed) return { executed: false, reason: "missing-instance" };
    const target = this._target(inst.settings);
    const foreground = await this._foreground(target);
    const before = await this.service.stateFor(target, foreground);
    const command = surface.pressCommand(before, inst.settings);
    if (!command) {
      await this._emit(context, inst, before);
      return { executed: false, reason: "no-safe-press-action", before, after: before };
    }
    const result = await this.service.execute(target, command, foreground);
    await this._emit(context, inst, result.after || before);
    return result;
  }

  async handle(message = {}) {
    if (this.disposed) return null;
    const event = String(message.event || message.type || "");
    const context = String(message.context || "");
    const payload = message.payload || {};
    const settings = message.settings || payload.settings || {};
    const controller = message.controller || payload.controller || "Keypad";
    if (event === "willAppear") return this.appear(context, settings, controller);
    if (event === "willDisappear") return this.disappear(context);
    if (event === "didReceiveSettings") return this.settingsChanged(context, settings);
    if (event === "dialRotate") return this.dialRotate(context, Number(message.ticks ?? payload.ticks ?? 0));
    if (event === "dialDown" || event === "touchTap" || event === "keyUp") return this.press(context);
    if (event === "refresh") return this.refreshContext(context, !!message.force);
    return null;
  }

  async dispose() {
    if (this.disposed) return;
    this.instances.clear();
    this.disposed = true;
    if (typeof this.service.dispose === "function") await this.service.dispose();
  }
}

module.exports = { AppAudioStreamDeckController };
