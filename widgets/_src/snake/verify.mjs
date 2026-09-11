import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(".");
const entry = path.join(repo, "widgets", "snake", "index.html");
if (!fs.existsSync(entry)) throw new Error(`missing shipping widget: ${entry}`);

const slots = [
  ["s-h",840,344],["s-v",696,416],["m-h",840,696],["m-v",696,840],
  ["l-h",1688,696],["l-v",696,1688],["xl-h",2536,696],["xl-v",696,2536]
];
const browser = await chromium.launch({headless:true});
const failures = [], perf = [];
const fail = (slot,msg) => failures.push(`${slot}: ${msg}`);

for (const [slot,width,height] of slots) {
  const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1,hasTouch:true,isMobile:false});
  const errors = [];
  page.on("pageerror", e => errors.push(`pageerror ${e}`));
  page.on("console", m => { if (m.type()==="error") errors.push(`console ${m.text()}`); });
  await page.addInitScript(({slot}) => {
    globalThis.uniqueId = `snake-qa-${slot}`;
    globalThis.themePreset = "matrix";
    globalThis.showTouchGuides = true;
    if (!sessionStorage.getItem("snake-qa-init")) {
      try { localStorage.removeItem(globalThis.uniqueId); } catch (_) {}
      sessionStorage.setItem("snake-qa-init","1");
    }
  }, {slot});
  await page.goto(pathToFileURL(entry).href,{waitUntil:"load"});
  await page.waitForFunction(() => !!window.__PACKRAT_SNAKE__);

  const base = await page.evaluate(() => {
    const s = __PACKRAT_SNAKE__.getState();
    const visible = el => {
      const cs=getComputedStyle(el), r=el.getBoundingClientRect();
      return cs.display!=="none" && cs.visibility!=="hidden" && r.width>0 && r.height>0;
    };
    const c=document.getElementById("gameCanvas").getBoundingClientRect();
    return {s, ox:document.documentElement.scrollWidth-innerWidth, oy:document.documentElement.scrollHeight-innerHeight,
      cw:c.width,ch:c.height,restart:visible(restartButton),pause:visible(pauseButton),
      zones:[...document.querySelectorAll(".touch-zone")].filter(visible).length};
  });
  if (base.s.slot!==slot) fail(slot,`selected ${base.s.slot}`);
  if (base.ox>.5||base.oy>.5) fail(slot,`overflow ${base.ox}x${base.oy}`);
  if (base.cw<100||base.ch<100) fail(slot,`canvas ${base.cw}x${base.ch}`);
  if (!base.restart||!base.pause||base.zones!==4) fail(slot,"required controls are not all visible");

  // Real click handlers, dispatched in-page to avoid headless focus/visibility transitions.
  await page.evaluate(() => primaryButton.click());
  if ((await page.evaluate(()=>__PACKRAT_SNAKE__.getState().state))!=="playing") fail(slot,"Play click failed");
  await page.evaluate(() => pauseButton.click());
  if ((await page.evaluate(()=>__PACKRAT_SNAKE__.getState().state))!=="paused") fail(slot,"Pause click failed");
  await page.evaluate(() => pauseButton.click());
  if ((await page.evaluate(()=>__PACKRAT_SNAKE__.getState().state))!=="playing") fail(slot,"Resume click failed");
  await page.evaluate(() => restartButton.click());
  const reset=await page.evaluate(()=>__PACKRAT_SNAKE__.getState());
  if (reset.state!=="ready"||reset.score!==0) fail(slot,"Restart click failed");

  const input=await page.evaluate(() => {
    const a=__PACKRAT_SNAKE__; a.setFixture({state:"playing",direction:"right",inputQueue:[]});
    return {reverse:a.queueDirection("left"),a:a.queueDirection("up"),b:a.queueDirection("left"),
      overflow:a.queueDirection("down"),q:a.getState().inputQueue};
  });
  if (input.reverse!==false||!input.a||!input.b||input.overflow!==false||input.q.join(",")!=="up,left")
    fail(slot,`rapid/reverse input ${JSON.stringify(input)}`);

  await page.evaluate(()=>__PACKRAT_SNAKE__.setFixture({state:"playing",direction:"right",inputQueue:[]}));
  await page.keyboard.press("ArrowUp");
  if ((await page.evaluate(()=>__PACKRAT_SNAKE__.getState().inputQueue[0]))!=="up") fail(slot,"keyboard ArrowUp input failed");
  await page.evaluate(()=>__PACKRAT_SNAKE__.setFixture({state:"playing",direction:"right",inputQueue:[]}));
  await page.keyboard.press("ArrowLeft");
  if ((await page.evaluate(()=>__PACKRAT_SNAKE__.getState().inputQueue.length))!==0) fail(slot,"keyboard reverse-direction protection failed");

  await page.evaluate(()=>__PACKRAT_SNAKE__.setFixture({state:"playing",direction:"right",inputQueue:[]}));
  await page.locator('[data-direction="up"]').dispatchEvent("pointerdown",{pointerId:22,pointerType:"touch",isPrimary:true});
  if ((await page.evaluate(()=>__PACKRAT_SNAKE__.getState().inputQueue[0]))!=="up") fail(slot,"touch-zone pointer input failed");

  await page.evaluate(()=>__PACKRAT_SNAKE__.setFixture({state:"playing",direction:"right",inputQueue:[]}));
  const box=await page.locator("#boardShell").boundingBox();
  if (!box) fail(slot,"board missing");
  else {
    const x=box.x+box.width/2,y=box.y+box.height*.6;
    await page.locator("#boardShell").dispatchEvent("pointerdown",{pointerId:31,pointerType:"touch",clientX:x,clientY:y,button:0});
    await page.locator("#boardShell").dispatchEvent("pointerup",{pointerId:31,pointerType:"touch",clientX:x,clientY:y-80,button:0});
    if ((await page.evaluate(()=>__PACKRAT_SNAKE__.getState().inputQueue[0]))!=="up") fail(slot,"swipe input failed");
  }

  const rules=await page.evaluate(() => {
    const a=__PACKRAT_SNAKE__;
    a.setFixture({snake:[{x:0,y:0},{x:1,y:0},{x:2,y:0}],food:{x:5,y:5},direction:"left",state:"playing",score:0}); a.step();
    const wall=a.getState().state;
    a.setFixture({snake:[{x:2,y:2},{x:2,y:3},{x:1,y:3},{x:1,y:2},{x:1,y:1},{x:2,y:1},{x:3,y:1},{x:3,y:2}],
      food:{x:6,y:6},direction:"down",state:"playing",score:0}); a.step(); const self=a.getState().state;
    a.setFixture({snake:[{x:2,y:2},{x:2,y:3},{x:1,y:3},{x:1,y:2}],food:{x:7,y:7},direction:"left",state:"playing",score:0}); a.step();
    const tail=a.getState();
    a.setFixture({snake:[{x:2,y:2},{x:1,y:2},{x:0,y:2}],food:{x:3,y:2},direction:"right",state:"playing",score:0,highScore:0}); a.step();
    const eat=a.getState();
    return {wall,self,tail:{state:tail.state,head:tail.snake[0]},eat:{score:eat.score,len:eat.snake.length,best:eat.highScore,
      foodOnSnake:!!eat.food&&eat.snake.some(p=>p.x===eat.food.x&&p.y===eat.food.y)}};
  });
  if (rules.wall!=="gameover"||rules.self!=="gameover") fail(slot,`collision rules ${JSON.stringify(rules)}`);
  if (rules.tail.state!=="playing"||rules.tail.head.x!==1||rules.tail.head.y!==2) fail(slot,"legal tail-vacate move failed");
  if (rules.eat.score!==10||rules.eat.len!==4||rules.eat.best!==10||rules.eat.foodOnSnake) fail(slot,`eat/grow ${JSON.stringify(rules.eat)}`);

  const food=await page.evaluate(() => {
    const a=__PACKRAT_SNAKE__,{cols,rows}=a.getState().config,last={x:cols-1,y:rows-1},occ=[];
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(x!==last.x||y!==last.y)occ.push({x,y});
    const samples=[0,.01,.2,.5,.8,.999999].map(r=>a.chooseFood([{x:0,y:0}],cols,rows,r));
    return {last,only:a.chooseFood(occ,cols,rows,.91),full:a.chooseFood([...occ,last],cols,rows,.4),samples};
  });
  if (food.only?.x!==food.last.x||food.only?.y!==food.last.y||food.full!==null) fail(slot,`near/full food ${JSON.stringify(food)}`);
  if (food.samples.some(p=>p.x===0&&p.y===0)) fail(slot,"food sample spawned on snake");

  const won=await page.evaluate(() => {
    const a=__PACKRAT_SNAKE__,{cols,rows}=a.getState().config,body=[];
    for(let y=0;y<rows;y++){const xs=y%2?[...Array(cols).keys()].reverse():[...Array(cols).keys()];for(const x of xs)if(x||y)body.push({x,y});}
    const i=body.findIndex(p=>p.x===1&&p.y===0), ordered=body.slice(i).concat(body.slice(0,i));
    a.setFixture({snake:ordered,food:{x:0,y:0},direction:"left",state:"playing",score:500,highScore:500}); a.step();
    const s=a.getState(); return {state:s.state,food:s.food};
  });
  if (won.state!=="won"||won.food!==null) fail(slot,`board-clear ${JSON.stringify(won)}`);

  await page.evaluate(() => {
    const a=__PACKRAT_SNAKE__;
    a.setFixture({snake:[{x:5,y:5},{x:4,y:5},{x:3,y:5},{x:2,y:5}],food:{x:8,y:5},direction:"right",state:"paused",score:50,highScore:120}); a.save();
  });
  await page.reload({waitUntil:"load"}); await page.waitForFunction(()=>!!window.__PACKRAT_SNAKE__);
  const saved=await page.evaluate(()=>__PACKRAT_SNAKE__.getState());
  if (saved.state!=="paused"||saved.score!==50||saved.highScore!==120) fail(slot,`persistence ${JSON.stringify({state:saved.state,score:saved.score,best:saved.highScore})}`);

  const bench=await page.evaluate(() => {
    const a=__PACKRAT_SNAKE__,{cols,rows}=a.getState().config,snake=[];
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)snake.push({x,y});
    a.setFixture({snake,food:null,direction:"right",state:"paused",score:900,highScore:900});
    return a.benchmark(120);
  });
  perf.push({slot,avg:bench.averageMs,total:bench.totalMs,cells:base.s.config.cols*base.s.config.rows});
  if (bench.averageMs>16) fail(slot,`heavy-board draw ${bench.averageMs.toFixed(2)}ms > 16ms`);
  if (errors.length) fail(slot,errors.join(" | "));
  await page.close();
}
await browser.close();

console.log("SNAKE PERFORMANCE (FULL BOARD RENDER)");
for(const r of perf) console.log(`${r.slot}: ${r.avg.toFixed(3)} ms/draw, ${r.cells} cells (${r.total.toFixed(1)} ms / 120)`);
if(failures.length){console.error("SNAKE QA FAIL");for(const f of failures)console.error(f);process.exit(1);}
console.log("SNAKE QA PASS: 8 layouts, UI controls, keyboard arrows, touch/swipe, rapid/reverse input, collisions, food edge cases, board clear, persistence, preview runtime, and full-board rendering passed");
