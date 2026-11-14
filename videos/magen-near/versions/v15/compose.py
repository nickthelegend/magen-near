"""Magen v15 compose: real screen takes only (no captions, no overlays). Phone and extension popup are shown whole on a
plain dark backdrop; explorer takes get one measured 1.3x top-centred zoom; voice is Kokoro am_echo; bed is a new drone."""
import json, subprocess, os, sys
from pathlib import Path
import numpy as np, soundfile as sf
from PIL import Image, ImageDraw, ImageFont, ImageFilter
R = Path(__file__).resolve().parent; W = R / 'work'; W.mkdir(exist_ok=True)
E = json.loads((R / 'edit.json').read_text()); V = {r['id']: r for r in json.loads((R / 'voice-timing.json').read_text())}
def ff(*a): subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *map(str, a)], check=True)
def dur(p): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)]))
FONT = '/Volumes/Extreme SSD/Projects/grokbot/projects/magen/web/public/commissioner.ttf'

# 1. blur the fresh test wallet's 12 words
b = E['blur']; blurred = R / 'raw/A-create-blur.mp4'
if not blurred.exists() or blurred.stat().st_mtime < (R / b['src']).stat().st_mtime:
    ff('-i', R / b['src'], '-filter_complex',
       f"[0]split[m][c];[c]crop={b['w']}:{b['h']}:{b['x']}:{b['y']},boxblur=28:4[bl];[m][bl]overlay={b['x']}:{b['y']}:enable='between(t,{b['from']},{b['to']})'",
       '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', blurred)

# 2. backdrop for phone/popup, and the closing card
def backdrop():
    im = Image.new('RGB', (1920, 1080), (10, 8, 11)); g = Image.new('L', (1920, 1080), 0); d = ImageDraw.Draw(g)
    d.ellipse((560, 140, 1360, 940), fill=70); g = g.filter(ImageFilter.GaussianBlur(180))
    tint = Image.new('RGB', (1920, 1080), (120, 30, 105)); im = Image.composite(tint, im, g.point(lambda v: v * 0.55)); return im
bg = W / 'bg.png'; backdrop().save(bg)
def card():
    im = backdrop(); d = ImageDraw.Draw(im); s = 0.62; ox, oy = 960 - 121.5 * s, 300
    P = lambda pts: [(ox + x * s, oy + y * s) for x, y in pts]
    d.polygon(P([(0,0),(121.5,70),(243,0),(243,127),(208,127),(208,84),(121.5,133),(35,84),(35,127),(0,127)]), fill=(255,255,255))
    d.polygon(P([(0,137),(121.5,209),(243,137),(243,201),(121.5,274),(0,201)]), fill=(224,64,200))
    f1 = ImageFont.truetype(FONT, 76); f2 = ImageFont.truetype(FONT, 30); f3 = ImageFont.truetype(FONT, 22)
    def c(t, y, f, col): w = d.textlength(t, font=f); d.text((960 - w / 2, y), t, font=f, fill=col)
    c('magen', 495, f1, (255, 255, 255))
    c('One seed. Every chain. A quantum-safe lock on every move.', 600, f2, (225, 214, 226))
    c('NEAR testnet · not audited · every NEAR and Solana transaction in this film was signed live on Nov 14;', 900, f3, (150, 138, 152))
    c('the Bitcoin and Zcash deposits were sent earlier from testnet wallets and minted on NEAR by the Omni bridge.', 932, f3, (150, 138, 152))
    return im
cardp = W / 'card.png'; card().save(cardp)

# 3. segments
z = E['explorer_zoom']['z']; cw, ch = round(1920 / z), round(1080 / z); cx = (1920 - cw) // 2
VF = {'web': 'scale=1920:1080:out_range=tv,setsar=1',
      'explorer': f'crop={cw}:{ch}:{cx}:0,scale=1920:1080:flags=lanczos:out_range=tv,setsar=1',
      'phone': None, 'popup': None}
clips = []; t = 0; sched = []
for i, s in enumerate(E['segments']):
    out = W / f"{i:02d}-{s['id']}.mp4"; d = s['b'] - s['a']
    if s['kind'] == 'card':
        ff('-loop', '1', '-t', d, '-i', cardp, '-vf', 'fps=30,scale=out_range=tv,format=yuv420p,fade=in:0:12', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', out)
    elif s['kind'] in ('phone', 'popup'):
        ff('-loop', '1', '-i', bg, '-ss', s['a'], '-t', d, '-i', R / s['src'], '-filter_complex',
           '[0:v]scale=out_range=tv,format=yuv420p[b];[1:v]fps=30,scale=-2:1080:flags=lanczos:out_range=tv,format=yuv420p[f];[b][f]overlay=(W-w)/2:0:shortest=1,format=yuv420p', '-t', d,
           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', '30', out)
    else:
        vf = VF['web'] if s['kind'] == 'explorer' and s.get('zoom') == 1.0 else VF[s['kind']]
        ff('-ss', s['a'], '-t', d, '-i', R / s['src'], '-vf', vf + ',fps=30,format=yuv420p', '-an',
           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', '30', out)
    real = dur(out); clips.append(out)
    if s.get('voice'): sched.append({'id': s['voice'], 'anchor': t + s.get('vat', 0.3), 'seg': s['id']})
    s['start'] = round(t, 2); t += real
total = t
(W / 'list.txt').write_text(''.join(f"file '{c.name}'\n" for c in clips))
ff('-f', 'concat', '-safe', '0', '-i', W / 'list.txt', '-c', 'copy', W / 'picture.mp4')

# 4. voice schedule (never overlapping) and a new drone bed
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
final = R / 'magen-near-film-v15.mp4'
ff(*inputs, '-filter_complex', ';'.join(filt), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', final)
ff('-i', final, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', R / 'magen-near-film-v15-share.mp4')
(R / 'timing.json').write_text(json.dumps({'total': round(total, 2), 'segments': [{k: s[k] for k in ('id', 'src', 'a', 'b', 'kind', 'start')} for s in E['segments']], 'voice': sched, 'warnings': warn}, indent=1))
print('total', round(total, 1), 'warnings', warn)
