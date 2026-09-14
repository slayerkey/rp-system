import streamDeck from "@elgato/streamdeck";
import { BrightnessAction, ContrastAction, VolumeAction } from "./actions/continuous.js";
import { InputAction, PowerAction, StatusAction } from "./actions/hardware.js";
import { HdrAction, OrientationAction, PrimaryAction, RefreshRateAction, ResolutionAction, TopologyAction } from "./actions/windows.js";
import { ApplyProfileAction, SaveProfileAction } from "./actions/profiles.js";
import { runtime } from "./runtime.js";
streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(new BrightnessAction());streamDeck.actions.registerAction(new ContrastAction());streamDeck.actions.registerAction(new VolumeAction());streamDeck.actions.registerAction(new PowerAction());streamDeck.actions.registerAction(new InputAction());streamDeck.actions.registerAction(new RefreshRateAction());streamDeck.actions.registerAction(new ResolutionAction());streamDeck.actions.registerAction(new HdrAction());streamDeck.actions.registerAction(new TopologyAction());streamDeck.actions.registerAction(new PrimaryAction());streamDeck.actions.registerAction(new OrientationAction());streamDeck.actions.registerAction(new SaveProfileAction());streamDeck.actions.registerAction(new ApplyProfileAction());streamDeck.actions.registerAction(new StatusAction());
async function sendInspectorData():Promise<void>{
  try{
    const snapshot:any=await runtime.scan(true);let profiles:string[]=[];let profileError:string|null=null;
    try{profiles=await runtime.listProfiles();}catch(error){profileError=error instanceof Error?error.message:String(error);}
    await streamDeck.ui.sendToPropertyInspector({type:"monitor-data",topology:snapshot.topology??"unknown",internalBrightness:snapshot.internalBrightness??null,profiles,profileError,monitors:(snapshot.monitors??[]).map((m:any)=>({monitorKey:m.monitorKey,deviceName:m.deviceName,description:m.description,primary:Boolean(m.primary),currentMode:m.currentMode,modes:m.modes,hdrState:m.hdrState,hdrEnabled:Boolean(m.hdrEnabled),capabilities:runtime.capabilitySummary(m,snapshot)}))});
  }catch(error){try{await streamDeck.ui.sendToPropertyInspector({type:"monitor-error",message:error instanceof Error?error.message:String(error)});}catch{}}
}
process.once("exit",()=>runtime.dispose());process.once("SIGTERM",()=>{runtime.dispose();process.exit(0);});process.once("SIGINT",()=>{runtime.dispose();process.exit(0);});
streamDeck.ui.onDidAppear(()=>void sendInspectorData());
streamDeck.ui.onSendToPlugin((ev)=>{const payload=ev.payload as {type?:string}|undefined;void (async()=>{if(payload?.type==="refresh-monitors"){runtime.invalidate();await sendInspectorData();return;}if(payload?.type==="reset-profiles"){try{await runtime.resetProfileStore();await sendInspectorData();}catch(error){try{await streamDeck.ui.sendToPropertyInspector({type:"monitor-error",message:error instanceof Error?error.message:String(error)});}catch{}}}})();});
streamDeck.connect().then(()=>void sendInspectorData());
