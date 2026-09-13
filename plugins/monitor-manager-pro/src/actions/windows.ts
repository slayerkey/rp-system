import { action, type DidReceiveSettingsEvent, type KeyDownEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";
import { runtime, type ProSettings } from "../runtime.js";

type ModeState={width:number;height:number;frequency:number;orientation:number};
function actionKey(target:any):string{return String(target?.id??target?.uuid??"monitor-action");}
function sameMode(a:ModeState|null|undefined,b:ModeState|null|undefined):boolean{
  return Boolean(a&&b&&a.width===b.width&&a.height===b.height&&a.frequency===b.frequency&&Number(a.orientation??0)===Number(b.orientation??0));
}
async function fail(target:any,title="ERROR"):Promise<void>{if(target.isKey?.()){await target.setTitle(title);await target.showAlert();}}

abstract class ModeToggleAction extends SingletonAction<ProSettings>{
  protected previous=new Map<string,{before:ModeState;applied:ModeState}>();
  protected clear(target:any):void{this.previous.delete(actionKey(target));}
  protected async maybeRestore(target:any,settings:ProSettings):Promise<ModeState|null>{
    const key=actionKey(target);
    const remembered=this.previous.get(key);
    if(!remembered)return null;
    const current=await runtime.currentModeState(settings);
    if(!sameMode(current,remembered.applied))return null;
    const restored=await runtime.setModeState(settings,remembered.before);
    this.previous.delete(key);
    return restored;
  }
  protected remember(target:any,before:ModeState,applied:ModeState):void{
    if(!sameMode(before,applied))this.previous.set(actionKey(target),{before,applied});
  }
}

@action({UUID:"com.packrat.monitormanagerpro.refresh-rate"})
export class RefreshRateAction extends ModeToggleAction{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{this.clear(ev.action);await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    const s=ev.payload.settings??{};
    try{
      const restored=await this.maybeRestore(ev.action,s);
      if(restored){await ev.action.setTitle(String(restored.frequency)+"HZ");await ev.action.showOk();return;}
      const before=await runtime.currentModeState(s);
      const rate=await runtime.setRefreshRate(s);
      const applied=await runtime.currentModeState(s);
      if(before&&applied)this.remember(ev.action,before,applied);
      await ev.action.setTitle(String(rate)+"HZ");await ev.action.showOk();
    }catch{await fail(ev.action,"HZ\nN/A");}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{
    const rate=Number(s.refreshRate??60);
    await target.setTitle(rate<=0?"MAX\nHZ":String(Math.round(rate))+"HZ");
  }
}

@action({UUID:"com.packrat.monitormanagerpro.resolution"})
export class ResolutionAction extends ModeToggleAction{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{this.clear(ev.action);await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    const s=ev.payload.settings??{};
    try{
      const restored=await this.maybeRestore(ev.action,s);
      if(restored){await ev.action.setTitle(restored.width+"×"+restored.height+"\n"+restored.frequency+"HZ");await ev.action.showOk();return;}
      const before=await runtime.currentModeState(s);
      await runtime.setExactMode(s);
      const applied=await runtime.currentModeState(s);
      if(before&&applied)this.remember(ev.action,before,applied);
      if(applied)await ev.action.setTitle(applied.width+"×"+applied.height+"\n"+applied.frequency+"HZ");
      await ev.action.showOk();
    }catch{await fail(ev.action,"MODE\nN/A");}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{
    if(s.modePreset==="best"){await target.setTitle("MAX\nMODE");return;}
    if(s.modePreset==="1080p-best"){await target.setTitle("1080P\nMAX");return;}
    await target.setTitle(s.width&&s.height?String(s.width)+"×"+String(s.height):"RESOLUTION");
  }
}

@action({UUID:"com.packrat.monitormanagerpro.hdr"})
export class HdrAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{const enabled=await runtime.setHdr(ev.payload.settings??{});await ev.action.setTitle(enabled?"HDR\nON":"HDR\nOFF");await ev.action.showOk();}catch{await fail(ev.action,"HDR\nN/A");}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{
    const state=await runtime.hdrDisplayState(s).catch(()=>"UNKNOWN");
    await target.setTitle(state==="ON"?"HDR\nON":state==="OFF"?"HDR\nOFF":state==="UNSUPPORTED"?"HDR\nN/A":"HDR\n?");
  }
}

@action({UUID:"com.packrat.monitormanagerpro.topology"})
export class TopologyAction extends SingletonAction<ProSettings>{
  private previous=new Map<string,{before:string;applied:string}>();
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{this.previous.delete(actionKey(ev.action));await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    const s=ev.payload.settings??{};
    const key=actionKey(ev.action);
    try{
      const current=await runtime.currentTopology();
      const remembered=this.previous.get(key);
      if(remembered&&current===remembered.applied){
        await runtime.setTopology({...s,topology:remembered.before as ProSettings["topology"]});
        this.previous.delete(key);
        await ev.action.setTitle(remembered.before.toUpperCase());await ev.action.showOk();return;
      }
      const applied=await runtime.setTopology(s);
      if(["internal","duplicate","extend","external"].includes(current)&&current!==applied)this.previous.set(key,{before:current,applied});
      await ev.action.setTitle(applied.toUpperCase());await ev.action.showOk();
    }catch{await fail(ev.action,"DISPLAY\nN/A");}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{await target.setTitle(String(s.topology??"extend").toUpperCase());}
}

@action({UUID:"com.packrat.monitormanagerpro.primary"})
export class PrimaryAction extends SingletonAction<ProSettings>{
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{await runtime.setPrimary(ev.payload.settings??{});await ev.action.setTitle("PRIMARY");await ev.action.showOk();}catch{await fail(ev.action,"PRIMARY\nN/A");}
  }
}

@action({UUID:"com.packrat.monitormanagerpro.orientation"})
export class OrientationAction extends ModeToggleAction{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{this.clear(ev.action);await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    const s=ev.payload.settings??{};
    try{
      const restored=await this.maybeRestore(ev.action,s);
      if(restored){await this.paint(ev.action,{...s,orientation:restored.orientation});await ev.action.showOk();return;}
      const before=await runtime.currentModeState(s);
      await runtime.setOrientation(s);
      const applied=await runtime.currentModeState(s);
      if(before&&applied)this.remember(ev.action,before,applied);
      await this.paint(ev.action,s);await ev.action.showOk();
    }catch{await fail(ev.action,"ROTATE\nN/A");}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{
    const labels=["LAND","PORTRAIT","LAND FLIP","PORT FLIP"];
    await target.setTitle(labels[Number(s.orientation??0)]??"ROTATE");
  }
}
