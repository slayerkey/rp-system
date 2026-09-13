import {
  action,
  type DialRotateEvent,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent
} from "@elgato/streamdeck";
import { runtime, type ProSettings } from "../runtime.js";

async function fail(target:any):Promise<void>{
  if(target.isKey?.()) await target.showAlert();
  if(target.isDial?.()) await target.setFeedback({title:"UNSUPPORTED",value:0});
}

abstract class ContinuousAction extends SingletonAction<ProSettings>{
  protected abstract label:string;
  protected abstract read(settings:ProSettings):Promise<number|null>;
  protected abstract set(settings:ProSettings,value:number):Promise<number>;
  protected abstract adjust(settings:ProSettings,delta:number):Promise<number>;

  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    const s=ev.payload.settings??{};
    try{
      const value=await this.set(s,Number(s.value??65));
      await ev.action.setTitle(String(value)+"%\n"+this.label);
      await ev.action.showOk();
    }catch{await fail(ev.action);}
  }
  override async onDialRotate(ev:DialRotateEvent<ProSettings>):Promise<void>{
    const s=ev.payload.settings??{};
    try{
      const value=await this.adjust(s,ev.payload.ticks*Math.max(1,Number(s.step??2)));
      await ev.action.setFeedback({title:this.label,value});
    }catch{await fail(ev.action);}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{
    try{
      const value=await this.read(s);
      if(target.isKey()) await target.setTitle(value===null?"UNKNOWN\n"+this.label:String(value)+"%\n"+this.label);
      if(target.isDial()) await target.setFeedback({title:this.label,value:value??0});
    }catch{if(target.isKey()) await target.setTitle("NO MONITOR");}
  }
}

@action({UUID:"com.packrat.monitormanagerpro.brightness"})
export class BrightnessAction extends ContinuousAction{
  protected label="BRIGHTNESS";
  protected read(s:ProSettings){return runtime.brightnessPercent(s);}
  protected set(s:ProSettings,v:number){return runtime.setBrightness(s,v);}
  protected adjust(s:ProSettings,d:number){return runtime.adjustBrightness(s,d);}
}

@action({UUID:"com.packrat.monitormanagerpro.contrast"})
export class ContrastAction extends ContinuousAction{
  protected label="CONTRAST";
  protected read(s:ProSettings){return runtime.contrastPercent(s);}
  protected set(s:ProSettings,v:number){return runtime.setContrastPercent(s,Number(s.contrast??v));}
  protected adjust(s:ProSettings,d:number){return runtime.adjustContrast(s,d);}
}

@action({UUID:"com.packrat.monitormanagerpro.volume"})
export class VolumeAction extends ContinuousAction{
  protected label="VOLUME";
  protected read(s:ProSettings){return runtime.volumePercent(s);}
  protected set(s:ProSettings,v:number){return runtime.setVolumePercent(s,Number(s.volume??v));}
  protected adjust(s:ProSettings,d:number){return runtime.adjustVolume(s,d);}
}
