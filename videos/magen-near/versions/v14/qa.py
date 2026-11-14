"""Offline edit verification, Whisper line check, and numbered one-second contact sheets."""
import json,subprocess,re,difflib,hashlib,sys
from pathlib import Path
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent;OUT=Path('/Volumes/Extreme SSD/Projects/grokbot/videos/magen-near/versions/v14');F=OUT/'frames';F.mkdir(exist_ok=True)
MODEL='/Users/jaibajrang/.cache/hyperframes/whisper/models/ggml-small.en.bin'
if '--frames-only' not in sys.argv:
 rows=[]
 for s in json.loads((R/'narration.json').read_text()):
  p=OUT/'voice'/s['id'];w=p.with_name(p.name+'-16k.wav');subprocess.run(['ffmpeg','-v','error','-y','-i',str(p)+'.wav','-ar','16000','-ac','1',str(w)],check=True)
  r=subprocess.run(['whisper-cli','-m',MODEL,'-f',str(w),'-nt','-np'],capture_output=True,text=True,check=True)
  norm=lambda x:re.sub('[^a-z0-9 ]','',x.lower()).split();row={'id':s['id'],'expected':s['text'],'transcript':r.stdout.strip(),'wordSimilarity':round(difflib.SequenceMatcher(None,norm(s['text']),norm(r.stdout)).ratio(),3)};rows.append(row);print(s['id'],row['wordSimilarity'],row['transcript'],flush=True)
  (R/'whisper-check.json').write_text(json.dumps(rows,indent=2))
p=OUT/'magen-near-film.mp4'
if not p.exists():raise SystemExit('Run again after render for frame QA.')
for old in F.glob('frame-*.jpg'):old.unlink()
subprocess.run(['ffmpeg','-v','error','-y','-i',str(p),'-vf',r'select=not(mod(n\,30)),scale=240:135','-fps_mode','vfr',str(F/'frame-%03d.jpg')],check=True)
files=sorted(F.glob('frame-*.jpg'))
for i in range(0,len(files),24):
 im=Image.new('RGB',(960,918),(235,235,235));d=ImageDraw.Draw(im)
 for k,f in enumerate(files[i:i+24]):
  x=k%4*240;y=k//4*153;im.paste(Image.open(f),(x,y));d.text((x+4,y+136),f'{i+k//1:03d}s',fill='black')
 im.save(F/f'sheet-{i//24+1}.jpg')
manifest=json.loads((R/'edit.json').read_text());assert manifest['duration']<=180
for f,h in manifest['canonicalPreserved'].items():assert hashlib.sha256(Path(f).read_bytes()).hexdigest()==h
subprocess.run(['ffmpeg','-hide_banner','-i',str(p),'-vf','blackdetect=d=0.15:pic_th=0.98','-af','silencedetect=noise=-55dB:d=1','-f','null','-'],stdout=open(F/'media-qc.log','w'),stderr=subprocess.STDOUT,check=True)
print('Frames',len(files),'canonical files unchanged',flush=True)
