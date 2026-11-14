"""Magen v16 compose (iOS only): the landing take, then the iPhone takes shown whole (rounded screen, centred on the W2
magenta backdrop), hard cuts, no captions or overlays. Voice is Kokoro am_echo; the bed is v15's drone."""
import json, subprocess
from pathlib import Path
import numpy as np, soundfile as sf
from PIL import Image, ImageDraw, ImageFont, ImageFilter
R = Path(__file__).resolve().parent; W = R / 'work'; W.mkdir(exist_ok=True)
E = json.loads((R / 'edit.json').read_text()); V = {r['id']: r for r in json.loads((R / 'voice-timing.json').read_text())}
def ff(*a):
    for k in range(3):   # retry: ffmpeg was killed once mid-run (exit 255) by something outside this script
        r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *map(str, a)], capture_output=True, text=True)
        if r.returncode == 0: return
        print('ffmpeg retry', k, r.returncode, r.stderr[-300:], flush=True)
    raise SystemExit('ffmpeg failed')
def dur(p): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)]))
FONT = '/Volumes/Extreme SSD/Projects/grokbot/projects/magen/web/public/commissioner.ttf'
PH = 1040; PW = round(1206 * PH / 2622 / 2) * 2   # whole phone screen, 20 px margin top and bottom
def backdrop():
    im = Image.new('RGB', (1920, 1080), (10, 8, 11)); g = Image.new('L', (1920, 1080), 0); d = ImageDraw.Draw(g)
    d.ellipse((560, 140, 1360, 940), fill=70); g = g.filter(ImageFilter.GaussianBlur(180))
    tint = Image.new('RGB', (1920, 1080), (120, 30, 105)); return Image.composite(tint, im, g.point(lambda v: v * 0.55))
bg = backdrop()
# soft shadow + thin rim behind the phone screen, baked into the backdrop
sh = Image.new('L', (1920, 1080), 0); ImageDraw.Draw(sh).rounded_rectangle(((1920 - PW) // 2 - 6, 14, (1920 + PW) // 2 + 6, 1066), 62, fill=150)
bg = Image.composite(Image.new('RGB', (1920, 1080), (0, 0, 0)), bg, sh.filter(ImageFilter.GaussianBlur(22)))
ImageDraw.Draw(bg).rounded_rectangle(((1920 - PW) // 2 - 5, 15, (1920 + PW) // 2 + 4, 1064), 60, fill=(28, 24, 30))
bg.save(W / 'bg.png')
mask = Image.new('L', (PW, PH), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, PW - 1, PH - 1), 56, fill=255); mask.save(W / 'mask.png')
def card():
    im = backdrop(); d = ImageDraw.Draw(im); s = 0.62; ox, oy = 960 - 121.5 * s, 300
    P = lambda pts: [(ox + x * s, oy + y * s) for x, y in pts]
    d.polygon(P([(0,0),(121.5,70),(243,0),(243,127),(208,127),(208,84),(121.5,133),(35,84),(35,127),(0,127)]), fill=(255,255,255))
    d.polygon(P([(0,137),(121.5,209),(243,137),(243,201),(121.5,274),(0,201)]), fill=(224,64,200))
    f1 = ImageFont.truetype(FONT, 76); f2 = ImageFont.truetype(FONT, 30); f3 = ImageFont.truetype(FONT, 21)
    def c(t, y, f, col): w = d.textlength(t, font=f); d.text((960 - w / 2, y), t, font=f, fill=col)
    c('magen', 495, f1, (255, 255, 255)); c('One seed. Every chain. A quantum-safe lock on every move.', 600, f2, (225, 214, 226))
    c('NEAR testnet · not audited · the Bitcoin and Zcash deposits shown were sent earlier from testnet wallets and minted on NEAR', 930, f3, (150, 138, 152))
    return im
card().save(W / 'card.png')
ENC = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', '30']
clips = []; t = 0; sched = []
for i, s in enumerate(E['segments']):
    out = W / f"{i:02d}-{s['id']}.mp4"; d = round(s['b'] - s['a'], 3)
    if s['kind'] == 'card':
        ff('-loop', '1', '-t', d, '-i', W / 'card.png', '-vf', 'fps=30,format=yuv420p,fade=in:0:15', *ENC, out)
    elif s['kind'] == 'phone':
        ff('-loop', '1', '-i', W / 'bg.png', '-ss', s['a'], '-t', d, '-i', R / s['src'], '-loop', '1', '-i', W / 'mask.png', '-filter_complex',
           f'[1:v]fps=30,scale={PW}:{PH}:flags=lanczos,format=rgba[p];[2:v]format=gray[m];[p][m]alphamerge[pm];[0:v]format=rgba[b];[b][pm]overlay=(W-w)/2:20:shortest=1,format=yuv420p',
           '-t', d, *ENC, out)
    else:
        ff('-ss', s['a'], '-t', d, '-i', R / s['src'], '-vf', 'scale=1920:1080,fps=30,format=yuv420p', '-an', *ENC, out)
    real = dur(out); clips.append(out)
    if s.get('voice'): sched.append({'id': s['voice'], 'anchor': t + s.get('vat', 0.3), 'seg': s['id']})
    s['start'] = round(t, 2); t += real
total = t
(W / 'list.txt').write_text(''.join(f"file '{c.name}'\n" for c in clips))
ff('-f', 'concat', '-safe', '0', '-i', W / 'list.txt', '-c', 'copy', W / 'picture.mp4')
prev = 0; warn = []
for v in sched:
    v['start'] = round(max(v['anchor'], prev + 0.35), 2); v['speech'] = V[v['id']]['speech']; prev = v['start'] + v['speech']
    if v['start'] - v['anchor'] > 1.6: warn.append(f"{v['id']} late by {v['start'] - v['anchor']:.1f}s")
if prev > total: warn.append(f'voice runs past the end ({prev:.1f} > {total:.1f})')
sr = 24000; u = np.arange(int((total + .5) * sr)) / sr
bed = (.40 * np.sin(2*np.pi*73.42*u) + .22 * np.sin(2*np.pi*110.0*u + .3*np.sin(.07*u)) + .12 * np.sin(2*np.pi*146.83*u) * (.5 + .5*np.sin(.05*u))
       + .05 * np.sin(2*np.pi*587.33*u) * (.5 + .5*np.sin(.13*u + 1)))
pulse = np.exp(-((u % 2.4) / .18)) * np.sin(2*np.pi*55*u) * .35
bed = (bed + pulse) * (.7 + .15*np.sin(.09*u)); fade = np.minimum(1, np.minimum(u / 2.5, (total - u) / 3))
sf.write(W / 'drone.wav', (bed * np.maximum(0, fade) * .5).astype(np.float32), sr)
inputs = ['-i', W / 'picture.mp4', '-i', W / 'drone.wav']; filt = ['[1:a]loudnorm=I=-21:TP=-3:LRA=7,volume=0.16[bed]']; labs = ['[bed]']
for i, v in enumerate(sched):
    inputs += ['-i', R / 'voice' / (v['id'] + '.wav')]; dl = round(v['start'] * 1000)
    filt.append(f"[{i+2}:a]loudnorm=I=-16:TP=-2:LRA=7,adelay={dl}|{dl}[v{i}]"); labs.append(f'[v{i}]')
filt.append(''.join(labs) + f'amix=inputs={len(labs)}:normalize=0,alimiter=limit=0.95,atrim=0:{total:.3f}[a]')
final = R / 'magen-near-film-v16.mp4'
ff(*inputs, '-filter_complex', ';'.join(filt), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', final)
ff('-i', final, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', R / 'magen-near-film-v16-share.mp4')
(R / 'timing.json').write_text(json.dumps({'total': round(total, 2), 'segments': [{k: s[k] for k in ('id', 'src', 'a', 'b', 'kind', 'start')} for s in E['segments']], 'voice': sched, 'warnings': warn}, indent=1))
print('total', round(total, 1), 'warnings', warn)
