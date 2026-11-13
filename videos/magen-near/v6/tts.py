import json, os, soundfile as sf
os.environ['OMP_NUM_THREADS'] = '2'
from kokoro_onnx import Kokoro
m = Kokoro('/Volumes/Extreme SSD/mac-offload/hyperframes/tts/models/kokoro-v1.0.onnx', '/Volumes/Extreme SSD/mac-offload/hyperframes/tts/voices/voices-v1.0.bin')
rows = []
for s in json.load(open('narration.json')):
    p = f"voice/{s['id']}.wav"
    if not os.path.exists(p):
        a, r = m.create(s['text'], voice='am_echo', speed=1.0, lang='en-us'); sf.write(p, a, r)
    a, r = sf.read(p); rows.append({'id': s['id'], 'dur': round(len(a) / r, 2)}); print(rows[-1], flush=True)
json.dump(rows, open('voice/durations.json', 'w'), indent=1)
