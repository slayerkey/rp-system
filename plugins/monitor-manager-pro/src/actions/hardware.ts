import { action, type DidReceiveSettingsEvent, type KeyDownEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";
import { runtime, type ProSettings } from "../runtime.js";

async function fail(target:any):Promise<void>{if(target.isKey?.())await target.showAlert();}

@action({UUID:"com.packrat.monitormanagerpro.power"})
export class PowerAction extends SingletonAction<ProSettings>{
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{const v=await runtime.power(ev.payload.settings??{});await ev.action.setTitle(v+"\nPOWER");await ev.action.showOk();}catch{await fail(ev.action);}
  }
}

@action({UUID:"com.packrat.monitormanagerpro.input"})
export class InputAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{await ev.action.setTitle(await runtime.setInput(ev.payload.settings??{}));await ev.action.showOk();}catch{await fail(ev.action);}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{
    const v=Number(s.inputValue);
    await target.setTitle(Number.isInteger(v)?runtime.inputLabel(v):"SELECT\nINPUT");
  }
}

@action({UUID:"com.packrat.monitormanagerpro.status"})
export class StatusAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{runtime.invalidate();await this.paint(ev.action,ev.payload.settings??{});}
  private async paint(target:any,s:ProSettings):Promise<void>{try{await target.setTitle(await runtime.status(s));}catch{await target.setTitle("NO DISPLAY");}}
}
