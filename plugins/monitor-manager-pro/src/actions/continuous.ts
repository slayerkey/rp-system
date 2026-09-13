import {
  action,
  type DialRotateEvent,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent
} from "@elgato/streamdeck";
import { runtime, type ProSettings } from "../runtime.js";

function actionKey(target:any):string{return String(target?.id??target?.uuid??"monitor-action");}
async function fail(target:any):Promise<void>{
  if(target.isKey?.()){await target.setTitle("N/A");await target.showAlert();}
  if(target.isDial?.()) await target.setFeedback({title:"UNSUPPORTED",value:"N/A",indicator:0});
}

abstract class ContinuousAction extends SingletonAction<ProSettings>{
  protected abstract label:string;
  private previous=new Map<string,number>();
  protected abstract read(settings:ProSettings):Promise<number|null>;
  protected abstract set(settings:ProSettings,value:number):Promise<number>;
  protected abstract adjust(settings:ProSettings,delta:number):Promise<number>;
  protected abstract configured(settings:ProSettings):number;

  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{this.previous.delete(actionKey(ev.action));await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    const s=ev.payload.settings??{};
    const key=actionKey(ev.action);
    try{
      const target=this.configured(s);
      const current=await this.read(s);
      const remembered=this.previous.get(key);
      let value:number;
      if(remembered!==undefined&&current!==null&&Math.abs(current-target)<=1){
        value=await this.set(s,remembered);
        this.previous.delete(key);
      }else{
        if(current!==null&&Math.abs(current-target)>1)this.previous.set(key,current);
        value=await this.set(s,target);
      }
      await ev.action.setTitle(String(value)+"%");
      await ev.action.showOk();
    }catch{await fail(ev.action);}
  }
  override async onDialRotate(ev:DialRotateEvent<ProSettings>):Promise<void>{
    const s=ev.payload.settings??{};
    try{
      this.previous.delete(actionKey(ev.action));
      const value=await this.adjust(s,ev.payload.ticks*Math.max(1,Number(s.step??2)));
      await ev.action.setFeedback({title:this.label,value:String(value)+"%",indicator:value});
    }catch{await fail(ev.action);}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{
    try{
      const value=await this.read(s);
      if(target.isKey()) await target.setTitle(value===null?"N/A":String(value)+"%");
      if(target.isDial()) await target.setFeedback({title:this.label,value:value===null?"N/A":String(value)+"%",indicator:value??0});
    }catch{if(target.isKey()) await target.setTitle("NO\nDISPLAY");}
  }
}

@action({UUID:"com.packrat.monitormanagerpro.brightness"})
export class BrightnessAction extends ContinuousAction{
  protected label="BRIGHTNESS";
  protected read(s:ProSettings){return runtime.brightnessPercent(s);}
  protected set(s:ProSettings,v:number){return runtime.setBrightness(s,v);}
  protected adjust(s:ProSettings,d:number){return runtime.adjustBrightness(s,d);}
  protected configured(s:ProSettings){return Number(s.value??65);}
}

@action({UUID:"com.packrat.monitormanagerpro.contrast"})
export class ContrastAction extends ContinuousAction{
  protected label="CONTRAST";
  protected read(s:ProSettings){return runtime.contrastPercent(s);}
  protected set(s:ProSettings,v:number){return runtime.setContrastPercent(s,v);}
  protected adjust(s:ProSettings,d:number){return runtime.adjustContrast(s,d);}
  protected configured(s:ProSettings){return Number(s.contrast??50);}
}

@action({UUID:"com.packrat.monitormanagerpro.volume"})
export class VolumeAction extends ContinuousAction{
  protected label="VOLUME";
  protected read(s:ProSettings){return runtime.volumePercent(s);}
  protected set(s:ProSettings,v:number){return runtime.setVolumePercent(s,v);}
  protected adjust(s:ProSettings,d:number){return runtime.adjustVolume(s,d);}
  protected configured(s:ProSettings){return Number(s.volume??50);}
}
