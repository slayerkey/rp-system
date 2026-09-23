import { chromium } from "playwright";
import path from "node:path";
import { pathToFileURL } from "node:url";
const entry=path.resolve(process.argv[2]||"widgets/hwinfo-sensor-dashboard/index.html");
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:840,height:696}});
const errors=[];page.on("pageerror",e=>errors.push(String(e)));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
try{
 await page.goto(pathToFileURL(entry).href,{waitUntil:"load"});
 await page.waitForFunction(()=>document.body.dataset.state==="ok",{timeout:15000});
 const status=await page.locator("#statusText").textContent();
 if(!/HWiNFO LIVE/.test(status||""))throw new Error("fixture bridge did not reach live state: "+status);
 await page.click("#configureButton");
 await page.waitForFunction(()=>document.querySelectorAll(".sensor-option").length>=100);
 const count=await page.locator(".sensor-option").count();
 if(count<100)throw new Error("expected 100+ discovered sensors, got "+count);
 await page.fill("#sensorSearch","GPU Hot Spot");
 await page.waitForTimeout(100);
 const filtered=await page.locator(".sensor-option").count();
 if(filtered<1)throw new Error("searchable picker did not find GPU Hot Spot");
 await page.locator(".sensor-option").first().click();
 await page.click("#closeConfig");
 const label=await page.locator(".sensor-card .label").first().textContent();
 if(!label)throw new Error("selected sensor did not render");
 if(errors.length)throw new Error("browser runtime errors: "+errors.join(" | "));
 console.log("EXACT PACKAGE HWiNFO BRIDGE INTEGRATION PASS", {count,filtered,label});
}finally{await browser.close()}