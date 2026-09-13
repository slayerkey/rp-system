import streamDeck from "@elgato/streamdeck";
import { BrightnessAction, ContrastAction, VolumeAction } from "./actions/continuous.js";
import { InputAction, PowerAction, StatusAction } from "./actions/hardware.js";
import { HdrAction, OrientationAction, PrimaryAction, RefreshRateAction, ResolutionAction, TopologyAction } from "./actions/windows.js";
import { ApplyProfileAction, SaveProfileAction } from "./actions/profiles.js";
import { runtime } from "./runtime.js";

streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(new BrightnessAction());
streamDeck.actions.registerAction(new ContrastAction());
streamDeck.actions.registerAction(new VolumeAction());
streamDeck.actions.registerAction(new PowerAction());
streamDeck.actions.registerAction(new InputAction());
streamDeck.actions.registerAction(new RefreshRateAction());
streamDeck.actions.registerAction(new ResolutionAction());
streamDeck.actions.registerAction(new HdrAction());
streamDeck.actions.registerAction(new TopologyAction());
streamDeck.actions.registerAction(new PrimaryAction());
streamDeck.actions.registerAction(new OrientationAction());
streamDeck.actions.registerAction(new SaveProfileAction());
streamDeck.actions.registerAction(new ApplyProfileAction());
streamDeck.actions.registerAction(new StatusAction());

async function sendInspectorData():Promise<void>{
  try{
    const snapshot:any=await runtime.scan(true);
    const profiles=await runtime.listProfiles().catch(()=>[]);
    await streamDeck.ui.sendToPropertyInspector({
      type:"monitor-data",
      topology:snapshot.topology??"unknown",
      internalBrightness:snapshot.internalBrightness??null,
      profiles,
      monitors:(snapshot.monitors??[]).map((m:any)=>({
        monitorKey:m.monitorKey,
        deviceName:m.deviceName,
        description:m.description,
        primary:Boolean(m.primary),
        currentMode:m.currentMode,
        modes:m.modes,
        hdrState:m.hdrState,
        hdrEnabled:Boolean(m.hdrEnabled),
        capabilities:runtime.capabilitySummary(m)
      }))
    });
  }catch(error){
    try{await streamDeck.ui.sendToPropertyInspector({type:"monitor-error",message:String(error)});}catch{}
  }
}

streamDeck.ui.onDidAppear(()=>void sendInspectorData());
streamDeck.ui.onSendToPlugin((ev)=>{
  const payload=ev.payload as {type?:string}|undefined;
  if(payload?.type==="refresh-monitors") void sendInspectorData();
});
streamDeck.connect().then(()=>void sendInspectorData());
