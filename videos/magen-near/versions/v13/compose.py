"""Cut only recorded product/explorer footage. No captions, overlays, success substitutions or generated UI."""
import os,json,subprocess,math
import numpy as np
import soundfile as sf
R=os.path.dirname(os.path.abspath(__file__));W=R+'/work';os.makedirs(W,exist_ok=True)
def run(a):
 p=subprocess.run(['ffmpeg','-v','error','-y',*a],capture_output=True,text=True)
 if p.returncode:raise RuntimeError(p.stderr[-2200:])
def dur(p):return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]))
ENC=['-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-r','30','-threads','2','-an']
clips=[];chapters=[]
def clip(name,file,start,end,length=None,kind='app'):
 out=W+'/'+name+'.mp4';length=length or end-start
 # App uses a 16:9 crop with the complete approval sheet, explorer begins wide then a measured 5% push.
 if kind=='explorer':
  vf="crop=1280:720:100:150,scale=1920:1080,zoompan=z='1+0.04*min(on/150,1)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=30"
 elif kind=='landing':vf='crop=1440:810:0:0,scale=1920:1080'
 else:vf='crop=1440:810:0:45,scale=1920:1080'
 # speed changes and end holds are editing only; the Approve click and real response remain in sequence.
 ratio=(end-start)/length
 run(['-ss',str(start),'-to',str(end),'-i',R+'/raw/'+file,'-vf',vf+f',setpts=(PTS-STARTPTS)/{ratio},fps=30','-t',str(length),*ENC,out]);clips.append(out);return length
ledger=json.load(open(os.path.join(R,'../../../../deployments/signing-pass-v13.json')))
scene={x['name']:x for x in ledger['scenes']}
start=0
def chapter(name,parts):
 global start
 before=len(clips);total=sum(clip(*p)for p in parts);chapters.append({'id':name,'start':round(start,3),'duration':round(total,3),'clips':[os.path.basename(x)for x in clips[before:]]});start+=total
chapter('landing',[('landing','app.webm',.901,4.503,3.6,'landing')])
chapter('upgrade',[('upgrade-approve','app.webm',5.0,7.85,10.5),('upgrade-receipt','upgrade-explorer.webm',max(0,dur(R+'/raw/upgrade-explorer.webm')-5.6),dur(R+'/raw/upgrade-explorer.webm')-.1,5.5,'explorer')])
for name,voice in [('send',14.8),('chains',19.1),('private',15),('recovery',16.1),('qday',13.0)]:
 s=scene[name];a=s['start'];b=s['end'];file=s['file'];e=R+'/raw/'+name+'-explorer.webm';ed=dur(e)
 # First 4.8 recorded seconds include the 2.2s review, Approve and the first broadcast state.
 t=min(a+4.8,b-.4);head=9.4 if name=='chains' else 8.3 if name=='recovery' else 5.7;tail=voice-head-5.5
 chapter(name,[(name+'-approve',file,a,t,head),(name+'-receipt',name+'-explorer.webm',ed-5.6,ed-.1,5.5,'explorer'),(name+'-result',file,max(a,b-1.6),b,tail)])
# Later continuous source state after the finalized Q-Day view refresh.
clip('native-key','app-rest4.webm',30,34.5,5,'app');start+=5
s=scene['closing'];chapter('close',[('close',s['file'],s['start'],s['end'],6.4,'landing')])
json.dump(chapters,open(R+'/edit.json','w'),indent=2)
open(W+'/concat.txt','w').write(''.join("file '"+p+"'\n"for p in clips));run(['-f','concat','-safe','0','-i',W+'/concat.txt','-c','copy',W+'/picture.mp4'])
# An original deterministic cinematic drone: quiet harmonic movement, no third-party music.
sr=24000;length=dur(W+'/picture.mp4');t=np.arange(int((length+.2)*sr))/sr
bed=(.45*np.sin(2*np.pi*55*t)+.24*np.sin(2*np.pi*82.4069*t+.2*np.sin(.11*t))+.16*np.sin(2*np.pi*110*t))*(.68+.18*np.sin(.12*t))
fade=np.minimum(1,np.minimum(t/2,(length-t)/3));bed*=np.maximum(0,fade);sf.write(W+'/drone.wav',bed,sr)
inputs=['-i',W+'/picture.mp4','-i',W+'/drone.wav'];filters=["[1:a]loudnorm=I=-21:TP=-3:LRA=7,volume=0.14[bed]"];labels=['[bed]']
for i,ch in enumerate(chapters):
 inputs+=['-i',R+'/voice/'+ch['id']+'.wav'];delay=round((ch['start']+.12)*1000);label='v'+str(i);filters.append(f'[{i+2}:a]loudnorm=I=-16:TP=-2:LRA=7,adelay={delay}|{delay}[{label}]');labels.append('['+label+']')
filters.append(''.join(labels)+f'amix=inputs={len(labels)}:normalize=0,alimiter=limit=0.95[a]')
run([*inputs,'-filter_complex',';'.join(filters),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','160k','-t',str(length),'-movflags','+faststart',R+'/magen-near-film.mp4'])
run(['-i',R+'/magen-near-film.mp4','-vf','scale=1280:720','-c:v','libx264','-preset','veryfast','-crf','26','-threads','2','-c:a','aac','-b:a','96k','-movflags','+faststart',R+'/magen-near-film-share.mp4'])
print('RENDERED',length,flush=True)
