"""Local Kokoro only. Media outputs stay on the SSD in shared versions/v14."""
import os,json
from pathlib import Path
os.environ['OMP_NUM_THREADS']='2'
from kokoro_onnx import Kokoro
import soundfile as sf
R=Path(__file__).resolve().parent
OUT=Path('/Volumes/Extreme SSD/Projects/grokbot/videos/magen-near/versions/v14');(OUT/'voice').mkdir(parents=True,exist_ok=True)
k=Kokoro('/Volumes/Extreme SSD/mac-offload/hyperframes/tts/models/kokoro-v1.0.onnx','/Volumes/Extreme SSD/mac-offload/hyperframes/tts/voices/voices-v1.0.bin');result=[]
for row in json.loads((R/'narration.json').read_text()):
 p=OUT/'voice'/(row['id']+'.wav');spoken=row['text'].replace('NEAR','near')
 if not p.exists():
  a,sr=k.create(spoken,voice='am_echo',speed=.95,lang='en-us');sf.write(p,a,sr)
 a,sr=sf.read(p);row['speech']=len(a)/sr;result.append(row);print(row['id'],round(row['speech'],3),flush=True)
(R/'voice-timing.json').write_text(json.dumps(result,indent=2))
