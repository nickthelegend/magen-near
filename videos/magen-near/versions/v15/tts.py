"""Kokoro (ONNX, local) am_echo at 0.95 for Magen v15. Never Chatterbox. Writes voice/<id>.wav and voice-timing.json."""
import os, json, sys
from pathlib import Path
os.environ['OMP_NUM_THREADS'] = '2'
from kokoro_onnx import Kokoro
import soundfile as sf
R = Path(__file__).resolve().parent; (R / 'voice').mkdir(exist_ok=True)
k = Kokoro('/Volumes/Extreme SSD/mac-offload/hyperframes/tts/models/kokoro-v1.0.onnx', '/Volumes/Extreme SSD/mac-offload/hyperframes/tts/voices/voices-v1.0.bin')
redo = set(sys.argv[1:]); res = []
for row in json.loads((R / 'narration.json').read_text()):
    p = R / 'voice' / (row['id'] + '.wav'); spoken = row['text'].replace('NEAR', 'near')
    if not p.exists() or row['id'] in redo:
        a, sr = k.create(spoken, voice='am_echo', speed=.95, lang='en-us'); sf.write(p, a, sr)
    a, sr = sf.read(p); row['speech'] = round(len(a) / sr, 3); res.append(row); print(row['id'], row['speech'], flush=True)
(R / 'voice-timing.json').write_text(json.dumps(res, indent=1))
print('total', round(sum(r['speech'] for r in res), 1))
