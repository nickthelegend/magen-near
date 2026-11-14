from pathlib import Path
import subprocess,json
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent;P=R.parent/'v13';O=R/'frames';rows=[('upgrade','app.webm',5.,8.),('send','app-rest2.webm',2.44,7.24),('chains','app-rest2.webm',19.56,24.36),('private','app-rest2.webm',41.02,45.82),('recovery','app-rest4.webm',2.5,7.3),('qday','app-rest4.webm',18.63,23.43)]
for name,file,a,b in rows:
 d=O/name;d.mkdir(exist_ok=True);subprocess.run(['ffmpeg','-y','-v','error','-ss',str(a),'-to',str(b),'-i',str(P/'raw'/file),'-vf','fps=4,scale=240:150',str(d/'f-%03d.jpg')],check=True)
 fs=sorted(d.glob('f-*.jpg'));im=Image.new('RGB',(960,5*168),(235,235,235));draw=ImageDraw.Draw(im)
 for k,p in enumerate(fs):
  x=k%4*240;y=k//4*168;im.paste(Image.open(p),(x,y));draw.text((x+4,y+151),f'{a+k/4:.2f}s',fill='black')
 im.save(O/f'{name}-source.jpg')
