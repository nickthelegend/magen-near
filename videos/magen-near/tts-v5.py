from kokoro_onnx import Kokoro
import soundfile as sf
import os,json
m=Kokoro('/Volumes/Extreme SSD/mac-offload/hyperframes/tts/models/kokoro-v1.0.onnx','/Volumes/Extreme SSD/mac-offload/hyperframes/tts/voices/voices-v1.0.bin')
blocks=open('videos/magen-near/narration.txt').read().strip().split('\n\n');rows=[]
for i,s in enumerate(blocks):
 p='videos/magen-near/versions/v5/assets/voice-%02d.wav'%i
 if os.path.exists(p): a,r=sf.read(p)
 else:
  a,r=m.create(s.replace('NEAR','Near').replace('ML DSA','M L D S A'),voice='am_echo',speed=0.9,lang='en-us');sf.write(p,a,r)
 d=len(a)/r;rows.append({'scene':i,'speech':d,'duration':max(15 if i==0 else 0,d+0.6),'file':p});print(i,round(d,2),flush=True)
json.dump(rows,open('videos/magen-near/versions/v5/timing.json','w'),indent=2);print('TOTAL',sum(x['duration'] for x in rows),flush=True)
