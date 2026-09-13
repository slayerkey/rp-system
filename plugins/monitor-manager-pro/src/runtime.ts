import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { MonitorLiteRuntime, type MonitorSettings } from "../../monitor-manager-lite/src/runtime.js";
import { classifyProfileResult, matchSavedMonitor, modeSupported, SAFE_VCP, SUPPORT, vcpSupport } from "../../_shared/monitor-manager/monitor-utils.mjs";

export type ProSettings = MonitorSettings & {
  contrast?: number;
  volume?: number;
  inputValue?: number;
  width?: number;
  height?: number;
  frequency?: number;
  orientation?: number;
  hdr?: "toggle" | "on" | "off";
  topology?: "internal" | "duplicate" | "extend" | "external";
  profileName?: string;
};

type ProfileMonitor = {
  monitorKey: string;
  description: string;
  deviceName: string;
  mode?: { width:number; height:number; frequency:number; orientation:number };
  primary?: boolean;
  hdr?: boolean;
  brightness?: number;
  contrast?: number;
  input?: number;
  volume?: number;
};

type MonitorProfile = {
  name: string;
  savedAt: string;
  topology?: string;
  internalBrightness?: number;
  monitors: ProfileMonitor[];
};

type Step = { item:string; status:"COMPLETE"|"SKIPPED"|"FAILED"; message?:string };

const INPUT_LABELS = new Map([
  [0x0f,"DISPLAYPORT 1"], [0x10,"DISPLAYPORT 2"],
  [0x11,"HDMI 1"], [0x12,"HDMI 2"], [0x1b,"USB-C"]
]);

function percent(min:number,current:number,max:number): number {
  return Math.round(((current-min)/Math.max(1,max-min))*100);
}
function nativePercent(min:number,max:number,value:number): number {
  return Math.round(min+(Math.max(0,Math.min(100,value))/100)*Math.max(1,max-min));
}

export class MonitorProRuntime extends MonitorLiteRuntime {
  private profilePath(): string {
    const appData=process.env.APPDATA || path.join(os.homedir(),"AppData","Roaming");
    return path.join(appData,"PackRat","Monitor Manager","profiles.json");
  }

  inputLabel(value:number): string {
    return INPUT_LABELS.get(value) ?? ("INPUT 0x"+value.toString(16).toUpperCase().padStart(2,"0"));
  }

  async contrastPercent(settings: ProSettings): Promise<number|null> {
    const { monitor }=await this.selected(settings);
    if(!monitor.ddcContrast) return null;
    return percent(Number(monitor.contrastMin??0),Number(monitor.contrast??0),Number(monitor.contrastMax??100));
  }

  async setContrastPercent(settings: ProSettings, requested:number): Promise<number> {
    const { monitor }=await this.selected(settings);
    if(!monitor.ddcContrast) throw new Error("Contrast is not supported by this monitor.");
    const value=Math.max(0,Math.min(100,Math.round(requested)));
    const native=nativePercent(Number(monitor.contrastMin??0),Number(monitor.contrastMax??100),value);
    await this.bridge.request("set-contrast",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,value:native});
    this.invalidate();
    return value;
  }

  async adjustContrast(settings: ProSettings, delta:number): Promise<number> {
    const current=await this.contrastPercent(settings);
    if(current===null) throw new Error("Contrast is not supported by this monitor.");
    return this.setContrastPercent(settings,current+delta);
  }

  async volumePercent(settings: ProSettings): Promise<number|null> {
    const { monitor }=await this.selected(settings);
    const support=vcpSupport(monitor.capabilities,SAFE_VCP.AUDIO_VOLUME);
    if(support.state!==SUPPORT.SUPPORTED) return null;
    const value=await this.bridge.request("get-vcp",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,code:SAFE_VCP.AUDIO_VOLUME});
    if(Number(value.maximum)<=0) return null;
    return Math.round((Number(value.current)/Number(value.maximum))*100);
  }

  async setVolumePercent(settings: ProSettings, requested:number): Promise<number> {
    const { monitor }=await this.selected(settings);
    const support=vcpSupport(monitor.capabilities,SAFE_VCP.AUDIO_VOLUME);
    if(support.state!==SUPPORT.SUPPORTED) throw new Error("Monitor volume is not advertised by DDC/CI.");
    const current=await this.bridge.request("get-vcp",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,code:SAFE_VCP.AUDIO_VOLUME});
    const max=Number(current.maximum);
    if(!Number.isFinite(max)||max<=0) throw new Error("Monitor volume range is unknown.");
    const value=Math.max(0,Math.min(100,Math.round(requested)));
    const native=Math.round((value/100)*max);
    await this.bridge.request("set-vcp",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,code:SAFE_VCP.AUDIO_VOLUME,value:native});
    this.invalidate();
    return value;
  }

  async adjustVolume(settings: ProSettings, delta:number): Promise<number> {
    const current=await this.volumePercent(settings);
    if(current===null) throw new Error("Monitor volume is not supported by this monitor.");
    return this.setVolumePercent(settings,current+delta);
  }

  async setInput(settings: ProSettings): Promise<string> {
    const { monitor }=await this.selected(settings);
    const support=vcpSupport(monitor.capabilities,SAFE_VCP.INPUT_SOURCE);
    if(support.state!==SUPPORT.SUPPORTED) throw new Error("Input switching is not advertised by DDC/CI.");
    const value=Number(settings.inputValue);
    if(!Number.isInteger(value)||!support.values.includes(value)) throw new Error("Requested input is not advertised by this monitor.");
    await this.bridge.request("set-vcp",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,code:SAFE_VCP.INPUT_SOURCE,value});
    this.invalidate();
    return this.inputLabel(value);
  }

  async setHdr(settings: ProSettings): Promise<boolean> {
    const { monitor }=await this.selected(settings);
    if(monitor.hdrState!==SUPPORT.SUPPORTED) throw new Error("Windows HDR is not supported on this active display.");
    const requested=settings.hdr??"toggle";
    const enabled=requested==="on"||(requested==="toggle"&&!Boolean(monitor.hdrEnabled));
    await this.bridge.request("set-hdr",{deviceName:monitor.deviceName,enabled});
    this.invalidate();
    return enabled;
  }

  async setTopology(settings: ProSettings): Promise<string> {
    const topology=settings.topology??"extend";
    await this.bridge.request("set-topology",{mode:topology},12000);
    this.invalidate();
    return topology;
  }

  async setPrimary(settings: ProSettings): Promise<void> {
    const { monitor }=await this.selected(settings);
    const mode=monitor.currentMode;
    if(!mode) throw new Error("Current display mode is unavailable.");
    await this.bridge.request("set-mode",{
      deviceName:monitor.deviceName,width:mode.width,height:mode.height,frequency:mode.frequency,
      orientation:mode.orientation??0,primary:true
    },12000);
    this.invalidate();
  }

  async setOrientation(settings: ProSettings): Promise<number> {
    const { monitor }=await this.selected(settings);
    const current=monitor.currentMode;
    if(!current) throw new Error("Current display mode is unavailable.");
    const wanted=Number(settings.orientation??0);
    if(![0,1,2,3].includes(wanted)) throw new Error("Invalid orientation.");
    const currentPortrait=[1,3].includes(Number(current.orientation??0));
    const wantedPortrait=[1,3].includes(wanted);
    const width=currentPortrait===wantedPortrait?Number(current.width):Number(current.height);
    const height=currentPortrait===wantedPortrait?Number(current.height):Number(current.width);
    const request={width,height,frequency:Number(current.frequency),orientation:wanted};
    if(!modeSupported(monitor.modes,request)) throw new Error("Requested orientation is not available at the current refresh rate.");
    await this.bridge.request("set-mode",{
      deviceName:monitor.deviceName,...request,primary:false
    },12000);
    this.invalidate();
    return wanted;
  }

  async setExactMode(settings: ProSettings): Promise<string> {
    const { monitor }=await this.selected(settings);
    const current=monitor.currentMode;
    const request={
      width:Number(settings.width??current?.width),
      height:Number(settings.height??current?.height),
      frequency:Number(settings.frequency??settings.refreshRate??current?.frequency),
      orientation:Number(settings.orientation??current?.orientation??0)
    };
    if(!modeSupported(monitor.modes,request)) throw new Error("Requested resolution / Hz / orientation combination is not available.");
    await this.bridge.request("set-mode",{deviceName:monitor.deviceName,...request,primary:false},12000);
    this.invalidate();
    return request.width+"x"+request.height+" @ "+request.frequency+" Hz";
  }

  private async readStore(): Promise<{schemaVersion:number;profiles:MonitorProfile[]}> {
    const file=this.profilePath();
    try {
      const raw=await readFile(file,"utf8");
      const parsed=JSON.parse(raw);
      if(parsed?.schemaVersion!==1||!Array.isArray(parsed.profiles)) throw new Error("invalid schema");
      return parsed;
    } catch(error:any) {
      if(error?.code==="ENOENT") return {schemaVersion:1,profiles:[]};
      throw new Error("Saved Monitor Profiles file is corrupt or incompatible. It was not overwritten.");
    }
  }

  private async writeStore(store:{schemaVersion:number;profiles:MonitorProfile[]}): Promise<void> {
    const file=this.profilePath();
    await mkdir(path.dirname(file),{recursive:true});
    await writeFile(file,JSON.stringify(store,null,2)+"\n","utf8");
  }

  async listProfiles(): Promise<string[]> {
    const store=await this.readStore();
    return store.profiles.map(p=>p.name).sort((a,b)=>a.localeCompare(b));
  }

  private async capture(name:string): Promise<MonitorProfile> {
    const snapshot:any=await this.scan(true);
    const monitors:ProfileMonitor[]=[];
    for(const monitor of snapshot.monitors??[]) {
      const item:ProfileMonitor={
        monitorKey:monitor.monitorKey,
        description:String(monitor.description??monitor.deviceName),
        deviceName:String(monitor.deviceName),
        mode:monitor.currentMode?{
          width:Number(monitor.currentMode.width),height:Number(monitor.currentMode.height),
          frequency:Number(monitor.currentMode.frequency),orientation:Number(monitor.currentMode.orientation??0)
        }:undefined,
        primary:Boolean(monitor.primary)
      };
      if(monitor.hdrState===SUPPORT.SUPPORTED) item.hdr=Boolean(monitor.hdrEnabled);
      if(monitor.ddcBrightness) item.brightness=percent(Number(monitor.brightnessMin??0),Number(monitor.brightness??0),Number(monitor.brightnessMax??100));
      if(monitor.ddcContrast) item.contrast=percent(Number(monitor.contrastMin??0),Number(monitor.contrast??0),Number(monitor.contrastMax??100));
      for(const [field,code] of [["volume",SAFE_VCP.AUDIO_VOLUME],["input",SAFE_VCP.INPUT_SOURCE]] as const) {
        const support=vcpSupport(monitor.capabilities,code);
        if(support.state!==SUPPORT.SUPPORTED) continue;
        try {
          const v=await this.bridge.request("get-vcp",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,code});
          if(field==="volume"&&Number(v.maximum)>0) {
            item.volume=Math.round((Number(v.current)/Number(v.maximum))*100);
          } else if(field==="input") {
            const current=Number(v.current);
            if(support.values.length&&support.values.includes(current)) item.input=current;
          }
        } catch {}
      }
      monitors.push(item);
    }
    return {
      name,
      savedAt:new Date().toISOString(),
      topology:String(snapshot.topology??"unknown"),
      internalBrightness:snapshot.internalBrightness?.available?Number(snapshot.internalBrightness.current):undefined,
      monitors
    };
  }

  async saveProfile(name:string): Promise<MonitorProfile> {
    const clean=name.trim().slice(0,48);
    if(!clean) throw new Error("Profile name is required.");
    const profile=await this.capture(clean);
    const store=await this.readStore();
    const index=store.profiles.findIndex(p=>p.name.toLowerCase()===clean.toLowerCase());
    if(index>=0) store.profiles[index]=profile; else store.profiles.push(profile);
    await this.writeStore(store);
    return profile;
  }

  private async restoreSnapshot(profile:MonitorProfile): Promise<string[]> {
    const errors:string[]=[];
    try {
      if(profile.topology&&profile.topology!=="unknown") await this.bridge.request("set-topology",{mode:profile.topology},12000);
    } catch(e:any) { errors.push("topology: "+e.message); }
    this.invalidate();

    const pendingInputs:ProfileMonitor[]=[];
    const current:any=await this.scan(true);
    for(const saved of profile.monitors) {
      const monitor=matchSavedMonitor(saved,current.monitors??[]);
      if(!monitor) continue;
      try {
        if(saved.mode&&modeSupported(monitor.modes,saved.mode)) await this.bridge.request("set-mode",{deviceName:monitor.deviceName,...saved.mode,primary:false},12000);
      } catch(e:any) { errors.push(saved.description+" mode: "+e.message); }
      try {
        if(saved.hdr!==undefined&&monitor.hdrState===SUPPORT.SUPPORTED) await this.bridge.request("set-hdr",{deviceName:monitor.deviceName,enabled:saved.hdr});
      } catch(e:any) { errors.push(saved.description+" hdr: "+e.message); }
      try {
        if(saved.brightness!==undefined&&monitor.ddcBrightness) {
          const native=nativePercent(Number(monitor.brightnessMin??0),Number(monitor.brightnessMax??100),saved.brightness);
          await this.bridge.request("set-brightness",{kind:"ddc",deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,value:native});
        }
      } catch(e:any) { errors.push(saved.description+" brightness: "+e.message); }
      try {
        if(saved.contrast!==undefined&&monitor.ddcContrast) {
          const native=nativePercent(Number(monitor.contrastMin??0),Number(monitor.contrastMax??100),saved.contrast);
          await this.bridge.request("set-contrast",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,value:native});
        }
      } catch(e:any) { errors.push(saved.description+" contrast: "+e.message); }
      if(saved.volume!==undefined) {
        try {
          const support=vcpSupport(monitor.capabilities,SAFE_VCP.AUDIO_VOLUME);
          if(support.state===SUPPORT.SUPPORTED) {
            const currentV=await this.bridge.request("get-vcp",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,code:SAFE_VCP.AUDIO_VOLUME});
            if(Number(currentV.maximum)>0) {
              const native=Math.round((Number(saved.volume)/100)*Number(currentV.maximum));
              await this.bridge.request("set-vcp",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,code:SAFE_VCP.AUDIO_VOLUME,value:native});
            }
          }
        } catch(e:any) { errors.push(saved.description+" volume: "+e.message); }
      }
      if(saved.input!==undefined) pendingInputs.push(saved);
    }

    const savedPrimary=profile.monitors.find((item)=>item.primary);
    if(savedPrimary) {
      try {
        this.invalidate();
        const live:any=await this.scan(true);
        const monitor=matchSavedMonitor(savedPrimary,live.monitors??[]);
        if(monitor?.currentMode) {
          await this.bridge.request("set-mode",{
            deviceName:monitor.deviceName,
            width:Number(monitor.currentMode.width),
            height:Number(monitor.currentMode.height),
            frequency:Number(monitor.currentMode.frequency),
            orientation:Number(monitor.currentMode.orientation??0),
            primary:true
          },12000);
        }
      } catch(e:any) { errors.push("primary display: "+e.message); }
    }

    if(profile.internalBrightness!==undefined) {
      try { await this.bridge.request("set-brightness",{kind:"internal",value:profile.internalBrightness}); }
      catch(e:any) { errors.push("internal brightness: "+e.message); }
    }

    // Inputs are restored last because changing a monitor away from the PC can
    // remove that display/DDC path and invalidate work still pending elsewhere.
    for(const saved of pendingInputs) {
      try {
        this.invalidate();
        const live:any=await this.scan(true);
        const monitor=matchSavedMonitor(saved,live.monitors??[]);
        if(!monitor) continue;
        const support=vcpSupport(monitor.capabilities,SAFE_VCP.INPUT_SOURCE);
        const native=Number(saved.input);
        if(support.state!==SUPPORT.SUPPORTED) continue;
        if(!support.values.length||!support.values.includes(native)) continue;
        await this.bridge.request("set-vcp",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,code:SAFE_VCP.INPUT_SOURCE,value:native});
      } catch(e:any) { errors.push(saved.description+" input: "+e.message); }
    }

    this.invalidate();
    return errors;
  }

  async applyProfile(name:string): Promise<{status:string;steps:Step[];rollbackErrors:string[]}> {
    const store=await this.readStore();
    const profile=store.profiles.find(p=>p.name.toLowerCase()===name.trim().toLowerCase());
    if(!profile) throw new Error("Monitor Profile not found: "+name);
    const before=await this.capture("__rollback__");
    const steps:Step[]=[];
    const pendingInputs:ProfileMonitor[]=[];

    try {
      if(profile.topology&&profile.topology!=="unknown") {
        await this.bridge.request("set-topology",{mode:profile.topology},12000);
        steps.push({item:"Display topology",status:"COMPLETE"});
        this.invalidate();
      }

      const snapshot:any=await this.scan(true);
      for(const saved of profile.monitors) {
        const monitor=matchSavedMonitor(saved,snapshot.monitors??[]);
        if(!monitor) {
          steps.push({item:saved.description,status:"SKIPPED",message:"Monitor is not present or matching is ambiguous."});
          continue;
        }

        if(saved.mode) {
          if(modeSupported(monitor.modes,saved.mode)) {
            await this.bridge.request("set-mode",{deviceName:monitor.deviceName,...saved.mode,primary:false},12000);
            steps.push({item:saved.description+" display mode",status:"COMPLETE"});
          } else {
            steps.push({item:saved.description+" display mode",status:"SKIPPED",message:"Saved resolution / Hz / orientation is unavailable."});
          }
        }

        if(saved.hdr!==undefined) {
          if(monitor.hdrState===SUPPORT.SUPPORTED) {
            await this.bridge.request("set-hdr",{deviceName:monitor.deviceName,enabled:saved.hdr});
            steps.push({item:saved.description+" HDR",status:"COMPLETE"});
          } else {
            steps.push({item:saved.description+" HDR",status:"SKIPPED",message:"True HDR support is not proven on the current Windows display path."});
          }
        }

        if(saved.brightness!==undefined) {
          if(monitor.ddcBrightness) {
            const native=nativePercent(Number(monitor.brightnessMin??0),Number(monitor.brightnessMax??100),saved.brightness);
            await this.bridge.request("set-brightness",{kind:"ddc",deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,value:native});
            steps.push({item:saved.description+" brightness",status:"COMPLETE"});
          } else {
            steps.push({item:saved.description+" brightness",status:"SKIPPED",message:"DDC brightness unavailable."});
          }
        }

        if(saved.contrast!==undefined) {
          if(monitor.ddcContrast) {
            const native=nativePercent(Number(monitor.contrastMin??0),Number(monitor.contrastMax??100),saved.contrast);
            await this.bridge.request("set-contrast",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,value:native});
            steps.push({item:saved.description+" contrast",status:"COMPLETE"});
          } else {
            steps.push({item:saved.description+" contrast",status:"SKIPPED",message:"DDC contrast unavailable."});
          }
        }

        if(saved.volume!==undefined) {
          const support=vcpSupport(monitor.capabilities,SAFE_VCP.AUDIO_VOLUME);
          if(support.state!==SUPPORT.SUPPORTED) {
            steps.push({item:saved.description+" volume",status:"SKIPPED",message:"VCP volume is not advertised."});
          } else {
            const v=await this.bridge.request("get-vcp",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,code:SAFE_VCP.AUDIO_VOLUME});
            if(Number(v.maximum)<=0) {
              steps.push({item:saved.description+" volume",status:"SKIPPED",message:"Volume range unknown."});
            } else {
              const native=Math.round((Number(saved.volume)/100)*Number(v.maximum));
              await this.bridge.request("set-vcp",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,code:SAFE_VCP.AUDIO_VOLUME,value:native});
              steps.push({item:saved.description+" volume",status:"COMPLETE"});
            }
          }
        }

        if(saved.input!==undefined) pendingInputs.push(saved);
      }

      const savedPrimary=profile.monitors.find((item)=>item.primary);
      if(savedPrimary) {
        this.invalidate();
        const live:any=await this.scan(true);
        const monitor=matchSavedMonitor(savedPrimary,live.monitors??[]);
        if(monitor?.currentMode) {
          await this.bridge.request("set-mode",{
            deviceName:monitor.deviceName,
            width:Number(monitor.currentMode.width),
            height:Number(monitor.currentMode.height),
            frequency:Number(monitor.currentMode.frequency),
            orientation:Number(monitor.currentMode.orientation??0),
            primary:true
          },12000);
          steps.push({item:savedPrimary.description+" primary display",status:"COMPLETE"});
        } else {
          steps.push({item:savedPrimary.description+" primary display",status:"SKIPPED",message:"Saved primary display is not currently available."});
        }
      }

      if(profile.internalBrightness!==undefined&&snapshot.internalBrightness?.available) {
        await this.bridge.request("set-brightness",{kind:"internal",value:profile.internalBrightness});
        steps.push({item:"Internal panel brightness",status:"COMPLETE"});
      } else if(profile.internalBrightness!==undefined) {
        steps.push({item:"Internal panel brightness",status:"SKIPPED",message:"No internal brightness device is active."});
      }

      // Input changes are intentionally the final transaction phase.
      for(const saved of pendingInputs) {
        this.invalidate();
        const live:any=await this.scan(true);
        const monitor=matchSavedMonitor(saved,live.monitors??[]);
        if(!monitor) {
          steps.push({item:saved.description+" input",status:"SKIPPED",message:"Monitor disappeared before the final input-switch phase."});
          continue;
        }
        const support=vcpSupport(monitor.capabilities,SAFE_VCP.INPUT_SOURCE);
        const native=Number(saved.input);
        if(support.state!==SUPPORT.SUPPORTED) {
          steps.push({item:saved.description+" input",status:"SKIPPED",message:"Input switching is not advertised."});
          continue;
        }
        if(!support.values.length||!support.values.includes(native)) {
          steps.push({item:saved.description+" input",status:"SKIPPED",message:"Saved input is not an advertised value on the current monitor."});
          continue;
        }
        await this.bridge.request("set-vcp",{deviceName:monitor.deviceName,physicalIndex:monitor.physicalIndex,code:SAFE_VCP.INPUT_SOURCE,value:native});
        steps.push({item:saved.description+" input",status:"COMPLETE"});
      }

      this.invalidate();
      return {status:classifyProfileResult(steps),steps,rollbackErrors:[]};
    } catch(error:any) {
      steps.push({item:"Profile transaction",status:"FAILED",message:error?.message??String(error)});
      const rollbackErrors=await this.restoreSnapshot(before);
      return {status:"FAILED",steps,rollbackErrors};
    }
  }
}

export const runtime=new MonitorProRuntime();
