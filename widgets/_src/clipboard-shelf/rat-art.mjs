const FIXED='2026-09-10T20:00:00.000Z';
const longText='Long clipboard text stays readable instead of shrinking into tiny type. This deterministic fixture deliberately includes several sentences, punctuation, line breaks, and a verylongunbrokenvalue_that_must_wrap_safely_without_overflowing_the_card_or_the_XENEON_viewport.';
const entries=[
 {id:'current',text:'Ship the XENEON release candidate after all automated gates pass.',createdAt:'2026-09-10T20:00:00.000Z',pinned:false,favorite:true},
 {id:'url',text:'https://docs.elgato.com/icue/widgets/',createdAt:'2026-09-10T19:58:00.000Z',pinned:true,favorite:true},
 {id:'snippet',text:'Thanks! I tested the update and everything is working on my side.',createdAt:'2026-09-10T19:54:00.000Z',pinned:true,favorite:false},
 {id:'multi',text:'Release checklist:\n• validate package\n• verify all eight layouts\n• run Rat Art\n• build ship kit',createdAt:'2026-09-10T19:48:00.000Z'},
 {id:'long',text:longText,createdAt:'2026-09-10T19:43:00.000Z'},
 {id:'url2',text:'https://github.com/slayerkey/rp-system',createdAt:'2026-09-10T19:39:00.000Z'},
 {id:'copy',text:'one touch copy from the shelf',createdAt:'2026-09-10T19:30:00.000Z',favorite:true},
 {id:'notes',text:'<b>not markup</b> — café 日本語 🐀 stays plain clipboard text.',createdAt:'2026-09-10T19:25:00.000Z'},
 {id:'nine',text:'glyph safety: gypqj descenders stay readable while pinned items survive pruning.',createdAt:'2026-09-10T19:20:00.000Z'},
 {id:'ten',text:'Private Mode pauses new capture and hides history on screen.',createdAt:'2026-09-10T19:10:00.000Z'}
];
export const variants=[
 {name:'private',slot:'L_H',privateMode:true},
 {name:'links',slot:'M_H',filter:'links'},
 {name:'favorites',slot:'L_V',filter:'favorites'}
];
export async function prepare(page,context){
 await page.addInitScript(({fixture,variant})=>{
  globalThis.maxHistory=40;globalThis.textColor='#F5F7FA';globalThis.accentColor='#63E6BE';globalThis.backgroundColor='#080B10';
  globalThis.tr=async v=>v;
  globalThis.__clipboardShelfFixture={...fixture,privateMode:Boolean(variant&&variant.privateMode)};
 },{fixture:{maxHistory:40,currentId:'current',entries},variant:context.variant});
}
export async function ready(page,context){
 await page.waitForFunction(()=>globalThis.__clipboardShelfReady===true,{timeout:5000});
 if(context.variant&&context.variant.filter){
  const b=page.locator('[data-filter="'+context.variant.filter+'"]');if(await b.count())await b.click();
 }
 await page.waitForTimeout(80);
}
export async function assert(page,context){
 const expected=context.slot.toLowerCase().replace('_','-');
 const report=await page.evaluate(()=>({
  slot:document.body.dataset.slot,
  overflowX:document.documentElement.scrollWidth-innerWidth,
  overflowY:document.documentElement.scrollHeight-innerHeight,
  cards:document.querySelectorAll('.clip-card').length,
  current:document.querySelectorAll('.clip-card.current').length,
  minButton:Math.min(...Array.from(document.querySelectorAll('.icon-button,.top-button,.filter,.resume-button')).map(x=>Math.min(x.getBoundingClientRect().width,x.getBoundingClientRect().height))),
  markupNodes:document.querySelectorAll('#shelf b,#shelf script,#shelf img').length,
  hostileText:Array.from(document.querySelectorAll('.preview')).some(x=>x.textContent.includes('<b>not markup</b>'))
 }));
 if(report.slot!==expected)throw new Error('slot mismatch '+JSON.stringify(report));
 if(report.overflowX>.5||report.overflowY>.5)throw new Error('page overflow '+JSON.stringify(report));
 if(!context.variant?.privateMode&&report.cards<1)throw new Error('fixture cards missing');
 if(!context.variant&&report.current!==1)throw new Error('current copy highlight missing');
 if(report.minButton<40)throw new Error('touch target too small '+JSON.stringify(report));
 if(!context.variant&&report.markupNodes!==0)throw new Error('clipboard text rendered as markup '+JSON.stringify(report));
 if(!context.variant&&!report.hostileText)throw new Error('hostile text fixture missing '+JSON.stringify(report));
}