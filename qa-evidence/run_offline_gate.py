"""Offline structural checks. Not a replacement for canonical RatPack or Elgato CLI audits."""
from pathlib import Path
from zipfile import ZipFile
import hashlib, json, sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'plugins/home-assistant-streamdeck/com.packrat.home-assistant-streamdeck.sdPlugin'
M=json.loads((P/'manifest.json').read_text())
expected={0:(15,0),2:(32,0),7:(8,2),9:(8,0)}
seen=set();rows=[]
assert M['UUID']=='com.packrat.home-assistant-streamdeck'
assert {a['UUID'] for a in M['Actions']}=={M['UUID']+'.'+k for k in ('status','graph','overview','control','trigger','brightness','neo-infobar')}
assert sorted(p['DeviceType'] for p in M['Profiles'])==sorted(expected)
for act in M['Actions']:
    assert act['States'] and all(s['ShowTitle'] is False for s in act['States'])
    assert (P/(act['Icon'] if Path(act['Icon']).suffix else act['Icon']+'.png')).exists()
    assert (P/(act['States'][0]['Image']+'.png')).exists()
for record in M['Profiles']:
    prefix=Path(record['Name']).name
    path=P/'profiles'/(prefix+'.streamDeckProfile')
    assert path.exists(),path
    with ZipFile(path) as archive:
        assert archive.testzip() is None
        manifest=json.loads(archive.read([n for n in archive.namelist() if n.endswith('/manifest.json') and '/Profiles/' not in n][0]))
        counts=[0,0]
        for name in archive.namelist():
            if '/Profiles/' not in name or not name.endswith('/manifest.json'):continue
            page=json.loads(archive.read(name))
            for ctl in page['Controllers']:
                index=0 if ctl['Type']=='Keypad' else 1
                for action in ctl['Actions'].values():
                    counts[index]+=1
                    assert action['UUID'] in {a['UUID'] for a in M['Actions']}
                    assert action['ActionID'] not in seen,action['ActionID']
                    seen.add(action['ActionID'])
                    assert action['States'][0]['ShowTitle'] is False
                    assert action['States'][0]['Title']==''
                    assert action['Settings']=={},'Default profiles must be unconfigured'
        assert tuple(counts)==expected[record['DeviceType']],(record['DeviceType'],counts)
        rows.append({'device':record['DeviceType'],'keypad':counts[0],'encoder':counts[1],'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
for name,size in [('imgs/plugin/icon.png',(256,256)),('imgs/plugin/icon@2x.png',(512,512))]:
    path=P/name
    with Image.open(path) as img: assert img.size==size,(name,img.size)
report={'gate':'OFFLINE STRUCTURAL ONLY','manifest_actions':len(M['Actions']),'unique_action_ids':len(seen),'profiles':rows,'vendor_cli':'NOT RUN','real_home_assistant':'NOT RUN','physical_hardware':'NOT RUN','canonical_art':'NOT RUN'}
out=ROOT/'artifacts/home-assistant/offline-structure.json'\nout.parent.mkdir(parents=True,exist_ok=True)\nout.write_text(json.dumps(report,indent=2)+'\n')
print('OFFLINE STRUCTURE PASS: 7 actions, 4 profiles, %d unique action identities'%len(seen))
for row in rows:print('device %s keys %s encoders %s'% (row['device'],row['keypad'],row['encoder']))
