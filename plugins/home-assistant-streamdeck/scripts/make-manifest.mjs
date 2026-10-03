import {writeFile} from 'node:fs/promises';
const prefix='com.packrat.home-assistant-streamdeck',dir=new URL('../com.packrat.home-assistant-streamdeck.sdPlugin/manifest.json',import.meta.url);
const specs=[
 ['status','Entity Status','Shows a selected entity with live state and unit.', ['Keypad']],
 ['graph','Live History','Observed rolling history for numeric sensors.',['Keypad']],
 ['overview','Home Overview','Three live entity values at a glance.',['Keypad']],
 ['control','Smart-Home Control','Toggle a supported light or switch.',['Keypad']],
 ['trigger','Scene / Script','Activate a configured Home Assistant scene or script.',['Keypad']],
 ['brightness','Brightness Dial','Adjust a supported light brightness with Stream Deck +.',['Encoder']],
 ['neo-infobar','Neo Home Infobar','Show three selected household values on Neo.',['Neo']],
];
const actions=specs.map(([slug,name,tooltip,controllers])=>({
 UUID:prefix+'.'+slug,Name:name,Tooltip:tooltip,Icon:`imgs/actions/${slug}/icon`,Controllers:controllers,
 SupportedInMultiActions:false,DisableAutomaticStates:true,UserTitleEnabled:false,
 ...(slug==='brightness'?{Encoder:{layout:'$B1',TriggerDescription:{Rotate:'Adjust brightness',Push:'Toggle light'}}}:{}),
 States:[{Image:`imgs/actions/${slug}/key`,ShowTitle:false}],
}));
const manifest={
 $schema:'https://schemas.elgato.com/streamdeck/plugins/manifest.json',Name:'Home Assistant Dashboard',Author:'PackRat',Category:'Home Assistant Dashboard',
 CategoryIcon:'imgs/category/icon',Icon:'imgs/plugin/icon',UUID:prefix,Version:'0.1.0.0',SDKVersion:3,Nodejs:{Version:'24'},CodePath:'bin/plugin.js',
 PropertyInspectorPath:'ui/inspector.html',Description:'Glanceable smart-home dashboard: real-time statuses, shared live history and selective controls.',
 Software:{MinimumVersion:'7.6'},OS:[{Platform:'windows',MinimumVersion:'10'}],Actions:actions,
 Profiles:[
 {Name:'profiles/home-dashboard-mk2',DeviceType:0,Readonly:false,DontAutoSwitchWhenInstalled:true,AutoInstall:true},
 {Name:'profiles/home-dashboard-xl',DeviceType:2,Readonly:false,DontAutoSwitchWhenInstalled:true,AutoInstall:true},
 {Name:'profiles/home-dashboard-plus',DeviceType:7,Readonly:false,DontAutoSwitchWhenInstalled:true,AutoInstall:true},
 {Name:'profiles/home-dashboard-neo',DeviceType:9,Readonly:false,DontAutoSwitchWhenInstalled:true,AutoInstall:true},
 ]};
await writeFile(dir,JSON.stringify(manifest,null,2)+'\n');console.log('Generated manifest');
