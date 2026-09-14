import {
  action,
  type DialRotateEvent,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent
} from "@elgato/streamdeck";
import { setBrightnessKey } from "./key-visuals.js";
import { runtime, type MonitorSettings } from "./runtime.js";

async function showFailure(target:any):Promise<void>{
  if(target.isKey?.()){await setBrightnessKey(target,{mode:"set",value:0});await target.showAlert();}
  if(target.isDial?.())await target.setFeedback({title:"BRIGHTNESS",value:"N/A",indicator:0});
}

@action({UUID:"com.packrat.monitormanagerlite.brightness"})
export class BrightnessAction extends SingletonAction<MonitorSettings>{
  override async onWillAppear(ev:WillAppearEvent<MonitorSettings>):Promise<void>{
    await this.paint(ev.action,ev.payload.settings??{});
  }
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<MonitorSettings>):Promise<void>{
    await this.paint(ev.action,ev.payload.settings??{});
  }
  override async onKeyDown(ev:KeyDownEvent<MonitorSettings>):Promise<void>{
    const settings=ev.payload.settings??{};
    try{
      const mode=settings.mode??"set";
      const step=Math.max(1,Number(settings.step??5));
      if(mode==="up")await runtime.adjustBrightness(settings,step);
      else if(mode==="down")await runtime.adjustBrightness(settings,-step);
      else await runtime.setBrightness(settings,Number(settings.value??65));
      await setBrightnessKey(ev.action,settings);
      await ev.action.showOk();
    }catch{await showFailure(ev.action);}
  }
  override async onDialRotate(ev:DialRotateEvent<MonitorSettings>):Promise<void>{
    const settings=ev.payload.settings??{};
    try{
      const step=Math.max(1,Number(settings.step??2));
      const value=await runtime.adjustBrightness(settings,ev.payload.ticks*step);
      await ev.action.setFeedback({title:"BRIGHTNESS",value:String(value)+"%",indicator:value});
    }catch{await showFailure(ev.action);}
  }
  private async paint(target:any,settings:MonitorSettings):Promise<void>{
    try{
      const current=await runtime.brightnessPercent(settings);
      if(target.isKey())await setBrightnessKey(target,settings);
      if(target.isDial())await target.setFeedback({title:"BRIGHTNESS",value:current===null?"N/A":String(current)+"%",indicator:current??0});
    }catch{
      if(target.isKey()){await target.setTitle("");await target.showAlert();}
      if(target.isDial())await target.setFeedback({title:"BRIGHTNESS",value:"N/A",indicator:0});
    }
  }
}
