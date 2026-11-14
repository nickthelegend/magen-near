"""Transcribe every v15 voice line with whisper.cpp (small.en) and compare to the script."""
import subprocess, json, re, difflib
from pathlib import Path
R = Path(__file__).resolve().parent; out = []
for s in json.loads((R / 'narration.json').read_text()):
    p = R / 'voice' / s['id']; k = R / 'work' / (s['id'] + '-16k.wav')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', f'{p}.wav', '-ar', '16000', '-ac', '1', k], check=True)
    r = subprocess.run(['whisper-cli', '-m', '/Users/jaibajrang/.cache/hyperframes/whisper/models/ggml-small.en.bin', '-f', k, '-nt', '-np', '-t', '4'], capture_output=True, text=True)
    n = lambda t: re.sub('[^a-z0-9 ]', '', t.lower().replace('-', ' ')).split()
    sim = difflib.SequenceMatcher(None, n(s['text']), n(r.stdout)).ratio()
    out.append({'id': s['id'], 'expected': s['text'], 'transcript': r.stdout.strip(), 'similarity': round(sim, 3)})
    print(f"{sim:.2f} {s['id']}: {r.stdout.strip()}", flush=True)
(R / 'whisper-check.json').write_text(json.dumps(out, indent=1))
