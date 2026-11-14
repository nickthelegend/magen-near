"""EDIT ONLY: v12 master + six existing v13 approval/receipt pairs. No network or app commands.
Outputs exclusively to the shared versions/v14 directory. All source media is immutable.
"""
import json,subprocess,hashlib,os
from pathlib import Path
import numpy as np
import soundfile as sf
R=Path(__file__).resolve().parent
REPO=R.parents[3]
OUT=Path('/Volumes/Extreme SSD/Projects/grokbot/videos/magen-near/versions/v14');WORK=OUT/'work';WORK.mkdir(parents=True,exist_ok=True)
BASE=Path('/Volumes/Extreme SSD/Projects/grokbot/videos/magen-near/versions/v12/magen-near-film.mp4')
RAW=R.parent/'v13'/'raw'
PROTECTED=[REPO/'videos/magen-near/magen-near-film.mp4',Path('/Volumes/Extreme SSD/Projects/grokbot/videos/magen-near/magen-near-film.mp4')]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
protected={str(p):digest(p)for p in PROTECTED}
assert digest(BASE)=='12ea46b8ab9db2e21488169d673aef9c2581d70492e0f3877acf1e6d3956ebdb','Wrong v12 source'
def run(a):
 r=subprocess.run(['ffmpeg','-v','error','-y',*map(str,a)],capture_output=True,text=True)
 if r.returncode:raise RuntimeError(r.stderr[-2500:])
def duration(p):return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)]))
ENC=['-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-r','30','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv','-threads','2','-an']
clips=[];timeline=[];audio=[];t=0.;voice={x['id']:x for x in json.loads((R/'voice-timing.json').read_text())}
def cut(id,source,a,b,seconds=None,kind='base',tx=None):
 global t
 frames=round((seconds if seconds is not None else b-a)*30);seconds=frames/30;p=WORK/(id+'.mp4')
 if kind=='base':vf='setsar=1'
 elif kind=='approval':vf='crop=1440:810:0:45,scale=1920:1080,setsar=1'
 else:vf="crop=1280:720:100:150,scale=1920:1080,zoompan=z='1+0.035*min(on/120,1)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=30,setsar=1"
 # Preserve recorded click motion. Only waiting holds and moderate playback speed are edited.
 if seconds>b-a+.1 and kind=='base':vf+=f',setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={seconds-(b-a)+.1}'
 else:vf+=f',setpts=(PTS-STARTPTS)/{(b-a)/seconds}'
 run(['-ss',a,'-to',b,'-i',source,'-vf',vf+',fps=30,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709','-frames:v',frames,*ENC,p]);actual=duration(p)
 assert abs(actual-seconds)<.04,(id,actual,seconds)
 timeline.append({'id':id,'start':round(t,6),'end':round(t+actual,6),'duration':actual,'source':str(source),'in':a,'out':b,'kind':kind,**({'transaction':tx}if tx else{})});clips.append(p);t+=actual
 print(id,round(t-actual,3),round(t,3),flush=True)
 return t-actual

def say(id,at,until):
 d=voice[id]['speech'];assert at+d<=until+.01,f'Voice {id} overruns by {at+d-until:.3f}s'
 audio.append({'id':id,'start':round(at,6),'end':round(at+d,6),'text':voice[id]['text']})
ledger=json.loads((REPO/'deployments/signing-pass-v13.json').read_text());txs={x['step']:x['hash']for x in ledger['transactions']}
insert_specs={'upgrade':('app.webm',6.,8.6),'send':('app-rest2.webm',3.,6.2),'chains':('app-rest2.webm',20.55,23.4),'qday':('app-rest4.webm',18.85,22.),'private':('app-rest2.webm',41.55,44.4),'recovery':('app-rest4.webm',3.,5.4)}
def pair(name):
 src,a,b=insert_specs[name];start=cut(name+'-approval',RAW/src,a,b,3.5,'approval',txs[name]);p=RAW/(name+'-explorer.webm');d=duration(p);cut(name+'-explorer',p,d-4.15,d-.15,4,'explorer',txs[name]);say(name+'-insert',start+.1,t)
# Unchanged opening, including the actual extension approval and the entire drill.
a=cut('landing-extension-drill',BASE,0,17.533333);say('s1',a+.15,t)
a=cut('readiness-scan',BASE,17.533333,34.1);say('s2',a+.15,t)
a=cut('extension-upgrade-how-home',BASE,34.1,52.9);say('s3',a+.15,t);pair('upgrade')
# All phone shots retained; remove four seconds of repeated send-success hold.
a=cut('phone-upgrade-send',BASE,52.9,71.9);say('s4',a+.15,t);pair('send')
# Remove one pending second and three repeated refusal seconds; keep all addresses and the refusal.
a=cut('phone-chains-addresses',BASE,75.9,84.4);cut('phone-chains-refusal',BASE,85.4,95.9);say('s5',a+.15,t);pair('chains')
# Keep native confirmation, switched-on state and the original NOA explorer key-list evidence.
a=cut('phone-qday-confirm',BASE,99.2,106.9);cut('phone-qday-native-key',BASE,113.2,115.9);cut('phone-qday-original-explorer',BASE,115.9,122.1);say('s6',a+.15,t);pair('qday')
a=cut('private-original',BASE,122.1,125.4,4.0);say('private-original',a+.1,t);pair('private')
a=cut('swap-original',BASE,125.8,127.95,2.9);say('swap-original',a+.1,t)
a=cut('guardians-original',BASE,128.1,130.95,4.1);say('recovery-original',a+.1,t);pair('recovery')
a=cut('extension-activity',BASE,131.45,134.766667,4.1);say('activity-original',a+.1,t)
a=cut('get-magen-close',BASE,134.766667,146.466667);say('s8',a+.15,t)
assert t<=180.,t
for x,y in zip(sorted(audio,key=lambda x:x['start']),sorted(audio,key=lambda x:x['start'])[1:]):assert x['end']<=y['start'],f'Voice overlap {x} {y}'
manifest={'duration':round(t,6),'fps':30,'sourceV12':str(BASE),'sourceV12SHA256':digest(BASE),'canonicalPreserved':protected,'timeline':timeline,'voice':audio,'insertedBeats':[r for r in timeline if r['kind']!='base'],'notes':'Each v13 approval/explorer shares one actual hash. Separate-web narration prevents conflating v13 with older v12 phone/extension transactions.'}
(R/'edit.json').write_text(json.dumps(manifest,indent=2))
(WORK/'concat.txt').write_text(''.join("file '"+str(p)+"'\n"for p in clips));run(['-f','concat','-safe','0','-i',WORK/'concat.txt','-c','copy',WORK/'picture.mp4'])
# Original v13 drone design, extended continuously across the restored v12 story.
sr=24000;u=np.arange(int((t+.2)*sr))/sr;bed=(.45*np.sin(2*np.pi*55*u)+.24*np.sin(2*np.pi*82.4069*u+.2*np.sin(.11*u))+.16*np.sin(2*np.pi*110*u))*(.68+.18*np.sin(.12*u));fade=np.minimum(1,np.minimum(u/2,(t-u)/3));sf.write(WORK/'drone.wav',bed*np.maximum(0,fade),sr)
inputs=['-i',WORK/'picture.mp4','-i',WORK/'drone.wav'];filters=['[1:a]loudnorm=I=-21:TP=-3:LRA=7,volume=0.14[bed]'];labels=['[bed]']
for i,row in enumerate(audio):
 inputs+=['-i',OUT/'voice'/(row['id']+'.wav')];delay=round(row['start']*1000);label=f'v{i}';filters.append(f'[{i+2}:a]loudnorm=I=-16:TP=-2:LRA=7,adelay={delay}|{delay}[{label}]');labels.append(f'[{label}]')
filters.append(''.join(labels)+f'amix=inputs={len(labels)}:normalize=0,alimiter=limit=0.95[a]')
run([*inputs,'-filter_complex',';'.join(filters),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','160k','-t',t,'-movflags','+faststart',OUT/'magen-near-film.mp4'])
run(['-i',OUT/'magen-near-film.mp4','-vf','scale=1280:720','-c:v','libx264','-preset','veryfast','-crf','25','-threads','2','-c:a','aac','-b:a','96k','-movflags','+faststart',OUT/'magen-near-film-share.mp4'])
assert (OUT/'magen-near-film-share.mp4').stat().st_size<25_000_000
assert all(digest(Path(p))==h for p,h in protected.items()),'A canonical file changed'
print('FINAL',round(t,3),str(OUT/'magen-near-film.mp4'),flush=True)
