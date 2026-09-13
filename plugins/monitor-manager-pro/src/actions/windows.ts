import { action, type DidReceiveSettingsEvent, type KeyDownEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";
import { runtime, type ProSettings } from "../runtime.js";

async function fail(target:any):Promise<void>{if(target.isKey?.())await target.showAlert();}

@action({UUID:"com.packrat.monitormanagerpro.refresh-rate"})
export class RefreshRateAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{const rate=await runtime.setRefreshRate(ev.payload.settings??{});await ev.action.setTitle(String(rate)+" HZ");await ev.action.showOk();}catch{await fail(ev.action);}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{await target.setTitle(String(Math.round(Number(s.refreshRate??60)))+" HZ");}
}

@action({UUID:"com.packrat.monitormanagerpro.resolution"})
export class ResolutionAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{const value=await runtime.setExactMode(ev.payload.settings??{});await ev.action.setTitle(value.replace(" @ ","\n"));await ev.action.showOk();}catch{await fail(ev.action);}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{await target.setTitle(s.width&&s.height?String(s.width)+"x"+String(s.height):"RESOLUTION");}
}

@action({UUID:"com.packrat.monitormanagerpro.hdr"})
export class HdrAction extends SingletonAction<ProSettings>{
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{const enabled=await runtime.setHdr(ev.payload.settings??{});await ev.action.setTitle(enabled?"HDR\nON":"HDR\nOFF");await ev.action.showOk();}catch{await fail(ev.action);}
  }
}

@action({UUID:"com.packrat.monitormanagerpro.topology"})
export class TopologyAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{const v=await runtime.setTopology(ev.payload.settings??{});await ev.action.setTitle(v.toUpperCase());await ev.action.showOk();}catch{await fail(ev.action);}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{await target.setTitle(String(s.topology??"extend").toUpperCase());}
}

@action({UUID:"com.packrat.monitormanagerpro.primary"})
export class PrimaryAction extends SingletonAction<ProSettings>{
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{await runtime.setPrimary(ev.payload.settings??{});await ev.action.setTitle("PRIMARY\nDISPLAY");await ev.action.showOk();}catch{await fail(ev.action);}
  }
}

@action({UUID:"com.packrat.monitormanagerpro.orientation"})
export class OrientationAction extends SingletonAction<ProSettings>{
  override async onWillAppear(ev:WillAppearEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onDidReceiveSettings(ev:DidReceiveSettingsEvent<ProSettings>):Promise<void>{await this.paint(ev.action,ev.payload.settings??{});}
  override async onKeyDown(ev:KeyDownEvent<ProSettings>):Promise<void>{
    try{await runtime.setOrientation(ev.payload.settings??{});await ev.action.showOk();}catch{await fail(ev.action);}
  }
  private async paint(target:any,s:ProSettings):Promise<void>{
    const labels=["LANDSCAPE","PORTRAIT","LANDSCAPE FLIP","PORTRAIT FLIP"];
    await target.setTitle(labels[Number(s.orientation??0)]??"ORIENTATION");
  }
}
