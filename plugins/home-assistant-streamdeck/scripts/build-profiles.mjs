import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {profileAction,writeProfiles} from '../../../tools/streamdeck/profile-builder.mjs';
const prefix='com.packrat.home-assistant-streamdeck.',dir=resolve(dirname(fileURLToPath(import.meta.url)),'../com.packrat.home-assistant-streamdeck.sdPlugin/profiles');
const a=(variant,kind,seed)=>profileAction(`home-dashboard:${variant}:${kind}:${seed}`,prefix+kind,kind==='overview'?'Home Overview':kind==='graph'?'Live History':kind==='trigger'?'Scene / Script':kind==='control'?'Smart Control':kind==='brightness'?'Brightness Dial':'Entity Status',{});
const simple=(v,rows)=>Object.fromEntries(rows.map(([col,row,kind,seed])=>[col+','+row,a(v,kind,seed)]));
const specs=[
 {file:'home-dashboard-mk2',name:'PackRat Smart Home Dashboard',width:5,height:3,keypad:simple('mk2',[
  [0,0,'overview','main'],[1,0,'status','climate'],[2,0,'status','energy'],[3,0,'status','air'],[4,0,'status','temperature'],
  [0,1,'graph','energy'],[1,1,'graph','climate'],[2,1,'graph','air'],[3,1,'control','main-light'],[4,1,'control','secondary-light'],
  [0,2,'trigger','morning'],[1,2,'trigger','night'],[2,2,'status','presence'],[3,2,'control','switch'],[4,2,'overview','second']])},
 {file:'home-dashboard-xl',name:'PackRat Smart Home Dashboard XL',width:8,height:4,keypad:simple('xl',[
  ...Array.from({length:8},(_,i)=>[i,0,i%4===0?'overview':'status','overview-'+i]),
  ...Array.from({length:8},(_,i)=>[i,1,i<5?'graph':'status','insights-'+i]),
  ...Array.from({length:8},(_,i)=>[i,2,i<6?'control':'trigger','controls-'+i]),
  ...Array.from({length:8},(_,i)=>[i,3,i<4?'trigger':i<6?'graph':'overview','scenes-'+i])])},
 {file:'home-dashboard-plus',name:'PackRat Smart Home Dashboard +',width:4,height:2,keypad:simple('plus',[
  [0,0,'overview','room'],[1,0,'status','temp'],[2,0,'status','power'],[3,0,'graph','history'],
  [0,1,'control','light'],[1,1,'control','switch'],[2,1,'trigger','night'],[3,1,'overview','extra']]),
  encoder:{'0,0':a('plus','brightness','dial-1'),'1,0':a('plus','brightness','dial-2')}},
 {file:'home-dashboard-neo',name:'PackRat Smart Home Dashboard Neo',width:4,height:2,keypad:simple('neo',[
  [0,0,'overview','room'],[1,0,'status','temp'],[2,0,'status','power'],[3,0,'graph','history'],
  [0,1,'control','light'],[1,1,'control','switch'],[2,1,'trigger','night'],[3,1,'status','air']])},
];
await writeProfiles(dir,specs);for(const s of specs)console.log(s.file,Object.keys(s.keypad).length);
