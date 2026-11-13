import json,glob,subprocess,os
root='videos/magen-near';v=root+'/versions/v1';timing=json.load(open(root+'/timing.json'));main=json.load(open(v+'/capture.json'))['marks'];tail=json.load(open(v+'/tail-capture.json'))['marks'];raw=glob.glob(v+'/raw/*.webm')[0];rawtail=glob.glob(v+'/tail/*.webm')[0];clips=[];t=0
for i,(shot,voice) in enumerate(zip(main+tail,timing)):
 src=raw if i<7 else rawtail;dur=voice['duration'];start=shot['start']+.08;actual=shot['end']-start
 out=v+'/scene-%02d.mp4'%i
 # Slowing the real recording and holding its last frame does not invent a new state.
 ratio=max(1,dur/actual);flt=f'setpts={ratio:.8f}*(PTS-STARTPTS),scale=1920:1200:flags=lanczos,crop=1920:1080:0:0,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=2'
 subprocess.run(['ffmpeg','-y','-loglevel','error','-ss',str(start),'-t',str(actual),'-i',src,'-i',voice['file'],'-vf',flt,'-af','apad=pad_dur=4,loudnorm=I=-16:TP=-1.5:LRA=9','-t',str(dur),'-c:v','libx264','-preset','fast','-crf','18','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k',out],check=True)
 clips.append(out);print('SCENE',i,round(dur,2),flush=True);t+=dur
open(v+'/concat.txt','w').write(''.join("file 'scene-%02d.mp4'\n"%i for i in range(len(clips))))
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',v+'/concat.txt','-c','copy','-movflags','+faststart',v+'/magen-near-film.mp4'],check=True)
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',v+'/magen-near-film.mp4','-vf','scale=1280:720','-c:v','libx264','-preset','fast','-crf','22','-threads','2','-c:a','aac','-b:a','128k','-movflags','+faststart',v+'/magen-near-film-share.mp4'],check=True)
print('TOTAL',t,flush=True)
