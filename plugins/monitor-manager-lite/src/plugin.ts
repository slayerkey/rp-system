import streamDeck from "@elgato/streamdeck";
import { BrightnessAction } from "./actions.js";
import { runtime } from "./runtime.js";
import { verifiedProMarketplaceUrl } from "./product.js";

type LiteGlobalSettings={monitorKey?:string};

streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(new BrightnessAction());

async function sendInspectorData():Promise<void>{
  try{
    const snapshot=await runtime.scan(true);
    if(!runtime.getConfiguredMonitorKey()&&snapshot.monitors?.[0]?.monitorKey){
      runtime.setConfiguredMonitorKey(snapshot.monitors[0].monitorKey);
      await streamDeck.settings.setGlobalSettings({monitorKey:snapshot.monitors[0].monitorKey});
    }
    await streamDeck.ui.sendToPropertyInspector({
      type:"monitor-data",
      monitors:(snapshot.monitors??[]).map((m:any)=>({
        monitorKey:m.monitorKey,
        deviceName:m.deviceName,
        description:m.description,
        currentMode:m.currentMode,
        capabilities:{brightness:runtime.capabilitySummary(m,snapshot).brightness}
      })),
      configuredMonitorKey:runtime.getConfiguredMonitorKey(),
      proMarketplaceUrl:verifiedProMarketplaceUrl()
    });
  }catch(error){
    try{await streamDeck.ui.sendToPropertyInspector({type:"monitor-error",message:String(error)});}catch{}
  }
}

streamDeck.settings.onDidReceiveGlobalSettings((ev:any)=>{
  const settings=(ev?.settings??ev?.payload?.settings??{}) as LiteGlobalSettings;
  runtime.setConfiguredMonitorKey(settings.monitorKey);
  void sendInspectorData();
});

process.once("exit",()=>runtime.dispose());
process.once("SIGTERM",()=>{runtime.dispose();process.exit(0);});
process.once("SIGINT",()=>{runtime.dispose();process.exit(0);});

streamDeck.ui.onDidAppear(()=>void sendInspectorData());
streamDeck.ui.onSendToPlugin((ev)=>{
  const payload=ev.payload as {type?:string}|undefined;
  if(payload?.type==="refresh-monitors")void sendInspectorData();
});

streamDeck.connect().then(async()=>{
  const settings=await streamDeck.settings.getGlobalSettings<LiteGlobalSettings>();
  runtime.setConfiguredMonitorKey(settings.monitorKey);
  await sendInspectorData();
});
