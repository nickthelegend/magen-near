from kokoro_onnx import Kokoro
import soundfile as sf
import json,os,subprocess,re,difflib
root='videos/magen-near/versions/v13'
k=Kokoro('/Volumes/Extreme SSD/mac-offload/hyperframes/tts/models/kokoro-v1.0.onnx','/Volumes/Extreme SSD/mac-offload/hyperframes/tts/voices/voices-v1.0.bin')
rows=json.load(open(root+'/narration.json'));out=[]
for s in rows:
 p=root+'/voice/'+s['id']+'.wav'
 if not os.path.exists(p):
  a,r=k.create(s['text'].replace('Magen','May gen').replace('NEAR','near').replace('MPC','M P C').replace('ML DSA','M L D S A'),voice='am_echo',speed=.95,lang='en-us');sf.write(p,a,r)
 a,r=sf.read(p);s['speech']=len(a)/r;out.append(s);print(s['id'],round(s['speech'],2),flush=True)
json.dump(out,open(root+'/timing.json','w'),indent=2)
