import json,glob,subprocess,os
R='videos/magen-near';V=R+'/versions/v2';T=json.load(open(R+'/timing.json'));M=json.load(open(R+'/versions/v1/capture.json'))['marks'];N=json.load(open(V+'/retakes.json'));A=glob.glob(R+'/versions/v1/raw/*.webm')[0];B=glob.glob(V+'/retakes/*.webm')[0]
# Each cut is a crop of the real browser recording; all live actions are reused exactly once.
# tuple source,start,end,duration,crop(width,height,x,y)
scenes=[
 [(A,2.55,4.15,3.3,(720,405,345,330)),(A,4.15,6.0,3.2,(720,405,345,485)),(A,6.0,8.7,4,(1056,594,275,170)),(A,8.7,12.65,4.5,(1056,594,275,190))],
 [(B,1.9,5.7,8,(1056,594,265,100)),(B,5.8,9.6,T[1]['duration']-8,(1056,594,270,180))],
 [(B,10.5,12.5,5,(1056,594,275,300)),(B,12.5,15.65,T[2]['duration']-5,(960,540,275,360))],
 [(A,30.6,35,6,(960,540,280,200)),(A,35,40,6,(1056,594,275,155)),(A,40,44.2,T[3]['duration']-12,(1056,594,275,150))],
 [(A,44.8,49,8,(1056,594,275,185)),(A,49,53.5,7,(1056,594,275,240)),(B,12.1,15.5,T[4]['duration']-15,(960,540,275,355))],
 [(B,16.3,18.4,4.5,(960,540,275,170)),(B,19,23.4,T[5]['duration']-4.5,(1056,594,275,190))],
 [(A,63.1,67.5,7,(720,405,710,235)),(A,67.5,72.5,6,(1056,594,275,150)),(A,72.5,76.3,T[6]['duration']-13,(720,405,710,240))],
 [(B,25.8,30.5,10,(800,450,285,450)),(B,32.5,37.8,T[7]['duration']-10,(1056,594,275,160))],
 [(B,38.6,44.1,T[8]['duration'],(720,405,265,190))]
]
os.makedirs(V,exist_ok=True);cuts=[]
for i,(parts,voice) in enumerate(zip(scenes,T)):
 paths=[]
 for j,(src,a,b,d,crop) in enumerate(parts):
  out=V+'/part-%02d-%02d.mp4'%(i,j);w,h,x,y=crop;ratio=d/(b-a)
  vf=f'setpts={ratio:.9f}*(PTS-STARTPTS),crop={w}:{h}:{x}:{y},scale=1920:1080:flags=lanczos,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=2'
  subprocess.run(['ffmpeg','-y','-loglevel','error','-ss',str(a),'-t',str(b-a),'-i',src,'-vf',vf,'-t',str(d),'-an','-c:v','libx264','-preset','fast','-crf','18','-threads','2','-pix_fmt','yuv420p',out],check=True);paths.append(out)
 txt=V+'/parts-%02d.txt'%i;open(txt,'w').write(''.join("file '%s'\n"%os.path.basename(p) for p in paths));out=V+'/scene-%02d.mp4'%i
 subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',txt,'-i',voice['file'],'-map','0:v','-map','1:a','-c:v','copy','-af','apad=pad_dur=4,loudnorm=I=-16:TP=-1.5:LRA=9','-t',str(voice['duration']),'-c:a','aac','-b:a','192k',out],check=True);cuts.append(out);print('SCENE',i,flush=True)
open(V+'/concat.txt','w').write(''.join("file '%s'\n"%os.path.basename(p) for p in cuts))
subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',V+'/concat.txt','-c','copy','-movflags','+faststart',V+'/magen-near-film.mp4'],check=True)
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',V+'/magen-near-film.mp4','-vf','scale=1280:720','-c:v','libx264','-preset','fast','-crf','21','-threads','2','-c:a','aac','-b:a','128k','-movflags','+faststart',V+'/magen-near-film-share.mp4'],check=True)
