import { action, type DidReceiveSettingsEvent, type KeyDownEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";
import { compactResolutionLabel, setKey, type KeyKind } from "../key-visuals.js";
import { runtime, type ProSettings } from "../runtime.js";

type ModeState={width:number;height:number;frequency:number;orientation:number};
function actionKey(target:any):string{return String(target?.id??target?.uuid??"monitor-action");}
function sameMode(a:ModeState|null|undefined,b:ModeState|null|undefined):boolean{
  return Boolean(a&&b&&a.width===b.width&&a.height===b.height&&a.frequency===b.frequency&&Number(a.orientation??0)===Number(b.orientation??0));
}
async function fail(target:any,kind:KeyKind,lines=["N/A"]):Promise<void>{if(target.isKey?.()){await setKey(target,kind,lines);await target.showAlert();}}
function refreshLines(s:ProSettings):string[]{const rate=Number(s.refreshRate??60);return [rate<=0?"MAX HZ":String(Math.round(rate))+"HZ"];}
function resolutionLines(s:ProSettings):string[]{
  if(s.modePreset==="best")return["MAX","MODE"];
  if(s.modePreset==="1080p-best")return["1080P","MAX"];
  if(s.width&&s.height)return [compactResolutionLabel(s.width,s.height),s.frequency?String(Math.round(Number(s.frequency)))+"HZ":""].filter(Boolean);
  return["RES"];
}
function topologyLines(s:ProSettings):string[]{
  return [{extend:"EXTEND",duplicate:"DUP",internal:"PC ONLY",external:"2ND ONLY"}[String(s.topology??"extend")]??"DISPLAY"];
}
function orientationLines(s:ProSettings):string[]{return [["LAND"],["PORT"],["LAND","FLIP"],["PORT","FLIP"]][Number(s.orientation??0)]??["ROTATE"];}

abstract class ModeToggleAction extends SingletonAction<ProSettings>{
  protected previous=new Map<string,{before:ModeState;applied:ModeState}>();
  protected clear(target:any):void{this.previous.delete(actionKey(target));}
  protected async maybeRestore(target:any,settings:ProSettings):Promise<ModeState|null>{
    const key=actionKey(target),remembered=this.previous.get(key);
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
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await setKey(ev.action,"refresh-rate",refreshLines(ev.payload.settings??{}));}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{this.clear(ev.action);await setKey(ev.action,"refresh-rate",refreshLines(ev.payload.settings??{}));}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    const s=ev.payload.settings??{};
    try{
      const restored=await this.maybeRestore(ev.action,s);
      if(!restored){
        const before=await runtime.currentModeState(s);
        await runtime.setRefreshRate(s);
        const applied=await runtime.currentModeState(s);
        if(before&&applied)this.remember(ev.action,before,applied);
      }
      await setKey(ev.action,"refresh-rate",refreshLines(s));await ev.action.showOk();
    }catch{await fail(ev.action,"refresh-rate");}
  }
}

@action({UUID:"com.packrat.monitormanagerpro.resolution"})
export class ResolutionAction extends ModeToggleAction{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await setKey(ev.action,"resolution",resolutionLines(ev.payload.settings??{}));}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{this.clear(ev.action);await setKey(ev.action,"resolution",resolutionLines(ev.payload.settings??{}));}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    const s=ev.payload.settings??{};
    try{
      const restored=await this.maybeRestore(ev.action,s);
      if(!restored){
        const before=await runtime.currentModeState(s);
        await runtime.setExactMode(s);
        const applied=await runtime.currentModeState(s);
        if(before&&applied)this.remember(ev.action,before,applied);
      }
      await setKey(ev.action,"resolution",resolutionLines(s));await ev.action.showOk();
    }catch{await fail(ev.action,"resolution");}
  }
}

@action({UUID:"com.packrat.monitormanagerpro.hdr"})
export class HdrAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{const enabled=await runtime.setHdr(ev.payload.settings??{});await setKey(ev.action,"hdr",[enabled?"ON":"OFF"]);await ev.action.showOk();}catch{await fail(ev.action,"hdr");}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{
    const state=await runtime.hdrDisplayState(s).catch(()=>"UNKNOWN");
    await setKey(target,"hdr",[state==="UNSUPPORTED"?"N/A":state==="UNKNOWN"?"?":state]);
  }
}

@action({UUID:"com.packrat.monitormanagerpro.topology"})
export class TopologyAction extends SingletonAction<ProSettings>{
  private previous=new Map<string,{before:string;applied:string}>();
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await setKey(ev.action,"topology",topologyLines(ev.payload.settings??{}));}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{this.previous.delete(actionKey(ev.action));await setKey(ev.action,"topology",topologyLines(ev.payload.settings??{}));}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    const s=ev.payload.settings??{},key=actionKey(ev.action);
    try{
      const current=await runtime.currentTopology(),remembered=this.previous.get(key);
      if(remembered&&current===remembered.applied){
        await runtime.setTopology({...s,topology:remembered.before as ProSettings["topology"]});
        this.previous.delete(key);
      }else{
        const applied=await runtime.setTopology(s);
        if(["internal","duplicate","extend","external"].includes(current)&&current!==applied)this.previous.set(key,{before:current,applied});
      }
      await setKey(ev.action,"topology",topologyLines(s));await ev.action.showOk();
    }catch{await fail(ev.action,"topology");}
  }
}

@action({UUID:"com.packrat.monitormanagerpro.primary"})
export class PrimaryAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await setKey(ev.action,"primary",["PRIMARY"]);}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await setKey(ev.action,"primary",["PRIMARY"]);}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{await runtime.setPrimary(ev.payload.settings??{});await setKey(ev.action,"primary",["PRIMARY"]);await ev.action.showOk();}catch{await fail(ev.action,"primary");}
  }
}

@action({UUID:"com.packrat.monitormanagerpro.orientation"})
export class OrientationAction extends ModeToggleAction{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await setKey(ev.action,"orientation",orientationLines(ev.payload.settings??{}));}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{this.clear(ev.action);await setKey(ev.action,"orientation",orientationLines(ev.payload.settings??{}));}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    const s=ev.payload.settings??{};
    try{
      const restored=await this.maybeRestore(ev.action,s);
      if(!restored){
        const before=await runtime.currentModeState(s);
        await runtime.setOrientation(s);
        const applied=await runtime.currentModeState(s);
        if(before&&applied)this.remember(ev.action,before,applied);
      }
      await setKey(ev.action,"orientation",orientationLines(s));await ev.action.showOk();
    }catch{await fail(ev.action,"orientation",["ROTATE","N/A"]);}
  }
}
