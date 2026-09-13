import { action, type DidReceiveSettingsEvent, type KeyDownEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";
import { runtime, type ProSettings } from "../runtime.js";

async function fail(target:any):Promise<void>{if(target.isKey?.())await target.showAlert();}

@action({UUID:"com.packrat.monitormanagerpro.save-profile"})
export class SaveProfileAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{
      const name=String(ev.payload.settings?.profileName??"").trim();
      await runtime.saveProfile(name);
      await ev.action.setTitle("SAVED\n"+name.toUpperCase());
      await ev.action.showOk();
    }catch{await fail(ev.action);}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{await target.setTitle("SAVE\n"+String(s.profileName??"PROFILE").toUpperCase());}
}

@action({UUID:"com.packrat.monitormanagerpro.apply-profile"})
export class ApplyProfileAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{
      const result=await runtime.applyProfile(String(ev.payload.settings?.profileName??""));
      await ev.action.setTitle(result.status+"\nPROFILE");
      if(result.status==="FAILED") await ev.action.showAlert(); else await ev.action.showOk();
    }catch{await fail(ev.action);}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{await target.setTitle(String(s.profileName??"PROFILE").toUpperCase()+"\nMODE");}
}
