import { action, type DidReceiveSettingsEvent, type KeyDownEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";
import { setKey } from "../key-visuals.js";
import { runtime, type ProSettings } from "../runtime.js";

function shortName(name:string):string{return (name.trim()||"PROFILE").slice(0,8).toUpperCase();}
async function fail(target:any,kind:"save-profile"|"apply-profile",lines:string[]):Promise<void>{if(target.isKey?.()){await setKey(target,kind,lines);await target.showAlert();}}

@action({UUID:"com.packrat.monitormanagerpro.save-profile"})
export class SaveProfileAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    const name=String(ev.payload.settings?.profileName??"").trim();
    try{await runtime.saveProfile(name);await setKey(ev.action,"save-profile",["SAVED",shortName(name)]);await ev.action.showOk();}
    catch{await fail(ev.action,"save-profile",["SAVE","FAILED"]);}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{await setKey(target,"save-profile",["SAVE",shortName(String(s.profileName??""))]);}
}

@action({UUID:"com.packrat.monitormanagerpro.apply-profile"})
export class ApplyProfileAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    const name=String(ev.payload.settings?.profileName??"");
    try{
      const result=await runtime.applyProfile(name);
      await setKey(ev.action,"apply-profile",[result.status,shortName(name)]);
      if(result.status==="FAILED")await ev.action.showAlert();else await ev.action.showOk();
    }catch{await fail(ev.action,"apply-profile",["APPLY","FAILED"]);}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{await setKey(target,"apply-profile",["APPLY",shortName(String(s.profileName??""))]);}
}
