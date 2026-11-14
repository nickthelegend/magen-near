# Turn a screencast take (raw/<name>/rec.json + JPEG frames) into a 30 fps 1920x1080 mp4 with true timing; t=0 is the 'start' mark.
import json, subprocess, sys, os
name = sys.argv[1]; d = f'raw/{name}'; r = json.load(open(f'{d}/rec.json'))
fr = r['frames']; t0 = r['t0']; end = r['end']
lines = ['ffconcat version 1.0']
# hold the first frame from t0
first_gap = max(0, fr[0]['t'] - t0)
for i, f in enumerate(fr):
    nxt = fr[i + 1]['t'] if i + 1 < len(fr) else end
    dur = max(0.001, nxt - f['t']) + (first_gap if i == 0 else 0)
    lines += [f"file 'f/{os.path.basename(f['file'])}'", f'duration {dur:.4f}']
lines.append(f"file 'f/{os.path.basename(fr[-1]['file'])}'")
open(f'{d}/list.txt', 'w').write('\n'.join(lines) + '\n')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{d}/list.txt',
  '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0A080B,fps=30,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', f'{d}.mp4'], check=True)
marks = {m['label']: round(float(m['t']) - t0, 2) for m in r['marks'] if isinstance(m['t'], (int, float))}
print(name, round(end - t0, 1), 's', marks)
