import { action, type DidReceiveSettingsEvent, type KeyDownEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";
import { setKey, type KeyKind } from "../key-visuals.js";
import { runtime, type ProSettings } from "../runtime.js";

async function fail(target:any,kind:KeyKind,lines=["N/A"]):Promise<void>{if(target.isKey?.()){await setKey(target,kind,lines);await target.showAlert();}}

@action({UUID:"com.packrat.monitormanagerpro.power"})
export class PowerAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{const v=await runtime.power(ev.payload.settings??{});await setKey(ev.action,"power",[v]);await ev.action.showOk();}catch{await fail(ev.action,"power");}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{
    try{await setKey(target,"power",[(await runtime.powerState(s))??"N/A"]);}catch{await setKey(target,"power",["N/A"]);}
  }
}

@action({UUID:"com.packrat.monitormanagerpro.input"})
export class InputAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{await runtime.setInput(ev.payload.settings??{});await this.paint(ev.action,ev.payload.settings??{});await ev.action.showOk();}catch{await fail(ev.action,"input");}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{
    const v=Number(s.inputValue);
    await setKey(target,"input",Number.isInteger(v)?[runtime.inputLabel(v)]:["SELECT","INPUT"]);
  }
}

@action({UUID:"com.packrat.monitormanagerpro.status"})
export class StatusAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{runtime.invalidate();await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{runtime.invalidate();await this.paint(ev.action,ev.payload.settings??{});await ev.action.showOk();}
  private async paint(target:any,s:ProSettings):Promise<void>{
    try{await setKey(target,"status",(await runtime.status(s)).split("\n"));}catch{await setKey(target,"status",["NO","DISPLAY"]);}
  }
}
