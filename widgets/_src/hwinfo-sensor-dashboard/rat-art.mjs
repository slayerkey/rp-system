export const variants = [
  { name: "picker", slot: "M_H", openPicker: true },
  { name: "warning", slot: "M_H", warning: true }
];

function fixtureSensors() {
  return [
    {key:"cpu-temp",fingerprint:"CPU [#0]: AMD Ryzen 9 9950X␟CPU (Tctl/Tdie)␟°C␟Temperature",sensorId:1,sensorInstance:0,readingId:1,sensorName:"CPU [#0]: AMD Ryzen 9 9950X",label:"CPU (Tctl/Tdie)",unit:"°C",type:"Temperature",value:67.3,min:38.1,max:79.4,avg:55.7,available:true},
    {key:"gpu-hot",fingerprint:"GPU [#0]: NVIDIA GeForce RTX 5090␟GPU Hot Spot Temperature␟°C␟Temperature",sensorId:2,sensorInstance:0,readingId:2,sensorName:"GPU [#0]: NVIDIA GeForce RTX 5090",label:"GPU Hot Spot Temperature",unit:"°C",type:"Temperature",value:74.8,min:36,max:84.2,avg:61.4,available:true},
    {key:"gpu-power",fingerprint:"GPU [#0]: NVIDIA GeForce RTX 5090␟GPU Power␟W␟Power",sensorId:2,sensorInstance:0,readingId:3,sensorName:"GPU [#0]: NVIDIA GeForce RTX 5090",label:"GPU Power",unit:"W",type:"Power",value:318.6,min:22,max:421.2,avg:246.8,available:true},
    {key:"ram",fingerprint:"Physical Memory␟Physical Memory Load␟%␟Usage",sensorId:3,sensorInstance:0,readingId:4,sensorName:"Physical Memory",label:"Physical Memory Load",unit:"%",type:"Usage",value:62.1,min:31.4,max:71.3,avg:55,available:true},
    {key:"nvme",fingerprint:"S.M.A.R.T.: Samsung SSD 990 PRO␟Drive Temperature␟°C␟Temperature",sensorId:4,sensorInstance:0,readingId:5,sensorName:"S.M.A.R.T.: Samsung SSD 990 PRO",label:"Drive Temperature",unit:"°C",type:"Temperature",value:46,min:31,max:53,avg:43,available:true},
    {key:"pump",fingerprint:"Corsair Hydro X␟Pump␟RPM␟Fan",sensorId:5,sensorInstance:0,readingId:6,sensorName:"Corsair Hydro X",label:"Pump",unit:"RPM",type:"Fan",value:2480,min:2370,max:2590,avg:2472,available:true},
    {key:"vrm",fingerprint:"ASUS ROG CROSSHAIR X870E HERO␟VRM MOS␟°C␟Temperature",sensorId:6,sensorInstance:0,readingId:7,sensorName:"ASUS ROG CROSSHAIR X870E HERO",label:"VRM MOS",unit:"°C",type:"Temperature",value:51.2,min:34.1,max:58.4,avg:46.9,available:true},
    {key:"net",fingerprint:"Network: Intel 2.5GbE␟Current UP Rate␟KB/s␟Other",sensorId:7,sensorInstance:0,readingId:8,sensorName:"Network: Intel 2.5GbE",label:"Current UP Rate",unit:"KB/s",type:"Other",value:842.4,min:0,max:9580,avg:421.2,available:true},
    {key:"unicode",fingerprint:"主板 センサー 🎮␟ポンプ温度 gyqp␟°C␟Temperature",sensorId:8,sensorInstance:0,readingId:9,sensorName:"主板 センサー 🎮",label:"ポンプ温度 gyqp <b>not markup</b>",unit:"°C",type:"Temperature",value:42.25,min:30,max:49,avg:39,available:true}
  ];
}

export async function prepare(page, context) {
  const data = fixtureSensors();
  await page.addInitScript(({data}) => {
    globalThis.bridgeKey = "rat-art-hwinfo-key";
    globalThis.historyWindow = "180";
    globalThis.staleSeconds = 8;
    globalThis.textColor = "#F4F6F8";
    globalThis.accentColor = "#2BE86A";
    globalThis.backgroundColor = "#070A0D";
    globalThis.graphColor = "#55D6FF";
    globalThis.icueEvents = {};
    globalThis.tr = async value => value;
    globalThis.__PACKRAT_HWINFO_FIXTURE__ = {
      sensors: data,
      selected: data.slice(0, 8).map(item => item.fingerprint)
    };
  }, {data});
}

export async function ready(page, context) {
  await page.waitForFunction(() => Boolean(globalThis.__PACKRAT_HWINFO_TEST__) && document.body?.getAttribute("data-connection") === "live", {timeout:10000});
  for (let i = 0; i < 24; i++) {
    await page.evaluate((step) => {
      const state = globalThis.__PACKRAT_HWINFO_TEST__.getState();
      const stamp = Date.now() + step * 1000;
      const next = state.sensors.map((sensor, index) => ({
        ...sensor,
        value: Number(sensor.value) + Math.sin(step / 3 + index) * ((index % 3) + 1.4),
        sampleTime: stamp
      }));
      globalThis.__PACKRAT_HWINFO_TEST__.inject({type:"snapshot",pollTime:stamp,status:{code:"live"},sensors:next});
    }, i);
  }
  if (context.variant?.warning) {
    await page.evaluate(() => {
      const state = globalThis.__PACKRAT_HWINFO_TEST__.getState();
      const key = state.sensors[0].fingerprint;
      const saved = state.persist;
      saved.slots["m-h"] = [key, state.sensors[1].fingerprint, state.sensors[2].fingerprint, state.sensors[3].fingerprint];
      saved.thresholds[key] = {warning:"60",critical:"80"};
      localStorage.setItem("packrat.hwinfo-dashboard.v1", JSON.stringify(saved));
      location.reload();
    });
    await page.waitForFunction(() => document.querySelector(".sensorCard"), {timeout:10000});
  }
  if (context.variant?.openPicker) await page.click("#configureButton");
  await page.waitForTimeout(250);
}

export async function assert(page, context) {
  const state = await page.evaluate(() => globalThis.__PACKRAT_HWINFO_TEST__.getState());
  if (state.connection !== "live" || state.provider !== "live") throw new Error("HWiNFO fixture did not reach live state");
  if (state.sensors.length !== 9) throw new Error("expected nine fixture sensors");
  const literal = "ポンプ温度 gyqp <b>not markup</b>";
  const labels = await page.locator(".sensorLabel").allTextContents();
  const pickerLabels = await page.locator(".pickerLabel").allTextContents();
  const renderedLiteral = labels.includes(literal) || pickerLabels.includes(literal);
  if (!renderedLiteral && context.variant?.openPicker) throw new Error("adversarial sensor label was not rendered as literal text");
  if (await page.locator(".sensorLabel b, .pickerLabel b").count()) throw new Error("HTML-looking sensor label rendered as markup");
  if (context.variant?.openPicker) {
    if (await page.locator("#configSheet[hidden]").count()) throw new Error("picker variant did not open");
    if (await page.locator(".pickerRow").count() < 9) throw new Error("picker omitted discovered sensors");
  }
}
