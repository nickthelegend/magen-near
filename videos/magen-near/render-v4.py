import json,glob,subprocess,os,time,shutil
R='videos/magen-near';V=R+'/versions/v4';T=json.load(open(V+'/timing.json'));A=glob.glob(R+'/versions/v1/raw/*.webm')[0];B=glob.glob(R+'/versions/v2/retakes/*.webm')[0];C=glob.glob(V+'/capture/*.webm')[0]
T[5]['duration']+=2.6;T[7]['duration']+=2.4;T[8]['duration']+=2.0
scenes=[
 None,
 [(C,1.8,5.0,7,(1152,648,258,110)),(C,5.0,8.5,T[1]['duration']-7,(1152,648,258,160))],
 [(B,10.5,12.5,5,(1152,648,258,210)),(B,12.5,15.65,T[2]['duration']-5,(960,540,275,355))],
 [(A,30.6,34.0,3.4,(1152,648,258,135)),(A,34.0,37.0,3,(1152,648,258,135)),(A,37.0,40.0,3,(1152,648,258,135)),(A,40.0,44.2,T[3]['duration']-9.4,(720,405,265,190))],
 None,
 [(C,9.0,11.25,5,(1152,648,258,120)),(C,11.25,13.8,4.5,(960,540,345,140)),(C,13.8,17.1,T[5]['duration']-9.5,(1152,648,258,150))],
 [(A,63.1,67.5,7,(560,315,870,270)),(A,67.5,72.5,6,(560,315,870,340)),(A,72.5,76.3,T[6]['duration']-13,(560,315,870,400))],
 [(B,25.8,30.5,10.5,(800,450,285,450)),(B,32.5,37.8,T[7]['duration']-10.5,(1152,648,258,140))],
 [(C,17.8,21.7,6,(1152,648,258,140)),(C,21.7,23.2,5,(800,450,430,235)),(C,23.2,26.5,T[8]['duration']-11,(800,450,430,235))]
]
os.makedirs(V,exist_ok=True);cuts=[]
for i,(parts,voice) in enumerate(zip(scenes,T)):
 if i==0:
  out=V+'/scene-00.mp4';shutil.copyfile(R+'/versions/v3/scene-00.mp4',out);cuts.append(out);print('SCENE 0 preserved',flush=True);continue
 if i==4:
  for _ in range(900):
   if os.path.exists(V+'/lock-receipt.json'):break
   time.sleep(1)
  else:raise RuntimeError('Read-only lock receipt capture unavailable')
  j=json.load(open(V+'/lock-receipt.json'));D=glob.glob(V+'/lock-receipt/*.webm')[0]
  parts=[(A,44.8,48.7,5,(1152,648,258,180)),(A,48.7,53.5,4,(1152,648,258,240)),(D,j['end']-5.7,j['end']-.2,voice['duration']-9,(1152,648,258,160))]
 paths=[]
 for j,(src,a,b,d,crop) in enumerate(parts):
  out=V+'/part-%02d-%02d.mp4'%(i,j);w,h,x,y=crop;ratio=d/(b-a)
  vf=f'setpts={ratio:.9f}*(PTS-STARTPTS),crop={w}:{h}:{x}:{y},scale=1920:1080:flags=lanczos,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=2'
  subprocess.run(['ffmpeg','-y','-loglevel','error','-ss',str(a),'-t',str(b-a),'-i',src,'-vf',vf,'-t',str(d),'-an','-c:v','libx264','-preset','fast','-crf','18','-threads','2','-pix_fmt','yuv420p',out],check=True);paths.append(out)
 txt=V+'/parts-%02d.txt'%i;open(txt,'w').write(''.join("file '%s'\n"%os.path.basename(p) for p in paths));out=V+'/scene-%02d.mp4'%i
 subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',txt,'-i',voice['file'],'-map','0:v','-map','1:a','-c:v','copy','-af','apad=pad_dur=5,loudnorm=I=-16:TP=-2.5:LRA=9','-t',str(voice['duration']),'-c:a','aac','-b:a','192k',out],check=True);cuts.append(out);print('SCENE',i,flush=True)
open(V+'/concat.txt','w').write(''.join("file '%s'\n"%os.path.basename(p) for p in cuts))
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',V+'/concat.txt','-c:v','copy','-af','loudnorm=I=-16:TP=-2.5:LRA=9,alimiter=limit=0.84:level=false','-c:a','aac','-b:a','192k','-movflags','+faststart',V+'/magen-near-film.mp4'],check=True)
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',V+'/magen-near-film.mp4','-vf','scale=1280:720','-c:v','libx264','-preset','fast','-crf','21','-threads','2','-c:a','aac','-b:a','128k','-movflags','+faststart',V+'/magen-near-film-share.mp4'],check=True)
json.dump(T,open(V+'/render-timing.json','w'),indent=2);shutil.copyfile(R+'/narration.txt',V+'/narration.txt');print('TOTAL',sum(x['duration'] for x in T),flush=True)
