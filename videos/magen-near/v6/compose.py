#!/usr/bin/env python3
"""Magen film v6: cut real captures (Playwright Chromium + extension, iOS Simulator, NEAR Rocks) into a 1080p film.
No text is drawn over app footage; side labels appear only beside the phone/extension, on a calm background."""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
RAW, WORK = f'{HERE}/raw', f'{HERE}/work'
os.makedirs(WORK, exist_ok=True)
FONT = os.path.abspath(f'{HERE}/../../../web/public/commissioner.ttf')
ICON = os.path.abspath(f'{HERE}/../../../art-incoming/magen-icon.png')
W, H, FPS = 1920, 1080, 30
INK, COBALT = (11, 14, 20), (51, 102, 255)
VERSION = sys.argv[1] if len(sys.argv) > 1 else 'v6'

def run(args):
    r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *args], capture_output=True, text=True)
    if r.returncode: raise SystemExit('FFMPEG FAILED: ' + r.stderr[-1500:])

def font(size, weight=500):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([weight])
    except Exception: pass
    return f

def bg():
    p = f'{WORK}/bg.png'
    if os.path.exists(p): return p
    im = Image.new('RGB', (W, H), (238, 241, 246))
    glow = Image.new('L', (W, H), 0); d = ImageDraw.Draw(glow)
    d.ellipse((-300, -200, 1300, 1300), fill=255); glow = glow.filter(ImageFilter.GaussianBlur(260))
    tint = Image.new('RGB', (W, H), (214, 224, 255))
    im = Image.composite(tint, im, glow); im.save(p); return p

def frame(name, box, radius, shadow=True):
    """bg with a transparent rounded hole at box (x, y, w, h), a soft shadow and a thin bezel."""
    p = f'{WORK}/frame-{name}.png'
    if os.path.exists(p): return p
    base = Image.open(bg()).convert('RGBA'); x, y, w, h = box
    if shadow:
        sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).rounded_rectangle((x + 10, y + 30, x + w - 10, y + h + 20), radius, fill=120)
        sh = sh.filter(ImageFilter.GaussianBlur(40))
        base = Image.composite(Image.new('RGBA', (W, H), (20, 30, 70, 255)), base, sh)
    hole = Image.new('L', (W, H), 255); ImageDraw.Draw(hole).rounded_rectangle((x, y, x + w, y + h), radius, fill=0)
    base.putalpha(hole)
    ImageDraw.Draw(base).rounded_rectangle((x - 2, y - 2, x + w + 2, y + h + 2), radius + 2, outline=(11, 14, 20, 255), width=6 if radius > 40 else 2)
    base.save(p); return p

def label(name, title, sub, x=1060, y=None):
    """Big side label with a cobalt accent bar (only beside phone / extension, never over app footage)."""
    p = f'{WORK}/label-{name}.png'
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    ft, fs = font(78, 650), font(34, 450)
    lines = title.split('\n'); lh = 92
    total = lh * len(lines) + (20 + 44 * len(sub.split('\n')) if sub else 0)
    y0 = y if y is not None else (H - total) // 2
    d.rounded_rectangle((x - 34, y0 + 10, x - 24, y0 + lh * len(lines) - 6), 5, fill=COBALT + (255,))
    for i, l in enumerate(lines): d.text((x, y0 + i * lh), l, font=ft, fill=INK + (255,))
    if sub:
        for i, l in enumerate(sub.split('\n')): d.text((x, y0 + lh * len(lines) + 20 + i * 44), l, font=fs, fill=(75, 84, 102, 255))
    logo = Image.open(ICON).convert('RGBA').resize((64, 64)); im.alpha_composite(logo, (x - 34, 70))
    d.text((x + 46, 78), 'magen', font=font(40, 650), fill=INK + (255,))
    im.save(p); return p

def endcard():
    p = f'{WORK}/endcard.png'
    im = Image.new('RGB', (W, H), INK); glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse((560, 140, 1360, 940), fill=200); glow = glow.filter(ImageFilter.GaussianBlur(200))
    im = Image.composite(Image.new('RGB', (W, H), (28, 46, 120)), im, glow).convert('RGBA'); d = ImageDraw.Draw(im)
    logo = Image.open(ICON).convert('RGBA').resize((180, 180)); im.alpha_composite(logo, ((W - 180) // 2, 250))
    def c(t, f, y, fill):
        w = d.textlength(t, font=f); d.text(((W - w) / 2, y), t, font=f, fill=fill)
    c('Magen', font(96, 650), 470, (255, 255, 255))
    c('Keep your NEAR account. Add a second lock.', font(46, 500), 600, (210, 220, 240))
    c('Chrome extension  ·  iPhone app  ·  Web', font(34, 450), 700, (143, 168, 255))
    c('NEAR testnet preview · not audited', font(26, 450), 960, (110, 120, 140))
    im.convert('RGB').save(p); return p

ENC = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-an']

def seg_web(out, src, t0, t1, speed=1.0, crop_y=0, zoom=None):
    """Full-frame browser footage (1440x900 → 1920 wide). zoom=(x, y, w, h) in 1440 space crops first."""
    pre = f'crop={zoom[2]}:{zoom[3]}:{zoom[0]}:{zoom[1]},scale={W}:{H}' if zoom else f'scale={W}:1200,crop={W}:{H}:0:{crop_y}'
    run(['-ss', str(t0), '-to', str(t1), '-i', f'{RAW}/{src}', '-vf', f'{pre},setpts=(PTS-STARTPTS)/{speed},fps={FPS}', *ENC, out])

def seg_popup(out, src, t0, t1, name, title, sub, speed=1.0, ph=700):
    """Extension popup (top-left 400 x ph of the recording) shown large beside a label."""
    s = 1.42; w, h = int(400 * s), int(ph * s); x, y = 300, (H - h) // 2
    fr = frame(f'popup{ph}', (x, y, w, h), 22); lb = label(name, title, sub, x=1080)
    run(['-ss', str(t0), '-to', str(t1), '-i', f'{RAW}/{src}', '-loop', '1', '-i', fr, '-loop', '1', '-i', lb, '-filter_complex',
         f'[0]crop=400:{ph}:0:0,scale={w}:{h},setpts=(PTS-STARTPTS)/{speed},fps={FPS}[v];color=c=0xeef1f6:s={W}x{H}:r={FPS}[b];'
         f'[b][v]overlay={x}:{y}:shortest=1[a];[a][1]overlay=0:0:shortest=1[c];[c][2]overlay=0:0:shortest=1', *ENC, out])

def seg_phone(out, parts, name, title, sub):
    """iOS Simulator footage as a big phone beside a label. parts = [(t0, t1, speed), ...]"""
    ph = 1000; pw = round(1206 * ph / 2622); x, y = 360, (H - ph) // 2
    fr = frame('phone', (x, y, pw, ph), 64); lb = label(name, title, sub, x=1040)
    pieces = []
    for i, (a, b, sp) in enumerate(parts):
        o = f'{WORK}/{name}-p{i}.mp4'
        run(['-ss', str(a), '-to', str(b), '-i', f'{RAW}/' + parts_src[name], '-vf', f'scale={pw}:{ph},setpts=(PTS-STARTPTS)/{sp},fps={FPS}', '-t', f'{(b - a) / sp:.3f}', *ENC, o]); pieces.append(o)
    lst = f'{WORK}/{name}-list.txt'; open(lst, 'w').write(''.join(f"file '{p}'\n" for p in pieces))
    joined = f'{WORK}/{name}-joined.mp4'; run(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', joined])
    run(['-i', joined, '-loop', '1', '-i', fr, '-loop', '1', '-i', lb, '-filter_complex',
         f'color=c=0xeef1f6:s={W}x{H}:r={FPS}[b];[b][0]overlay={x}:{y}:shortest=1[a];[a][1]overlay=0:0:shortest=1[c];[c][2]overlay=0:0:shortest=1', *ENC, out])

def seg_dapp(out, t0, t1, open_at):
    """The demo dApp full frame with Magen's approval window over it, where Chrome puts extension pop-ups."""
    s = 1.42; w, h = int(400 * s), int(668 * s); x, y = W - w - 80, 50
    sh = f'{WORK}/popshadow.png'
    if not os.path.exists(sh):
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); m = Image.new('L', (W, H), 0)
        ImageDraw.Draw(m).rounded_rectangle((x, y + 20, x + w, y + h + 20), 18, fill=150); m = m.filter(ImageFilter.GaussianBlur(30))
        im.putalpha(m); im.save(sh)
    d = open_at - t0
    run(['-ss', str(t0), '-to', str(t1), '-i', f'{RAW}/dapp.webm', '-i', f'{RAW}/approve.webm', '-loop', '1', '-i', sh, '-filter_complex',
         f'[0]scale={W}:1200,crop={W}:{H}:0:0,setpts=PTS-STARTPTS,fps={FPS}[d];'
         f'[1]crop=400:668:0:0,scale={w}:{h},setpts=PTS-STARTPTS+{d}/TB,fps={FPS}[a];'
         f'[d][2]overlay=0:0:shortest=1:enable=\'gte(t,{d})\'[ds];[ds][a]overlay={x}:{y}:eof_action=pass:enable=\'gte(t,{d})\'', *ENC, out])

def still(out, img, dur):
    run(['-loop', '1', '-t', str(dur), '-i', img, '-vf', f'fps={FPS},format=yuv420p', *ENC, out])

def cat(out, files):
    lst = f'{WORK}/cat-{os.path.basename(out)}.txt'; open(lst, 'w').write(''.join(f"file '{f}'\n" for f in files))
    run(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', out])

def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode())

M = json.load(open(f'{HERE}/marks.json'))
parts_src = {}
S = {}
# s1: landing → dApp approval signed twice → drill (all within ~15 s)
L = {k: v / 1000 for k, v in M['landing'].items()}
seg_web(f'{WORK}/s1a.mp4', 'landing.webm', L['hero'], L['hero'] + 2.4)
seg_dapp(f'{WORK}/s1b.mp4', 4.3, 11.2, M['dapp']['approveOpen'] / 1000)
seg_web(f'{WORK}/s1c.mp4', 'drill.webm', 4.9, 17.6, speed=1.7)
cat(f'{WORK}/s1.mp4', [f'{WORK}/s1a.mp4', f'{WORK}/s1b.mp4', f'{WORK}/s1c.mp4'])
# s2: readiness scan of root.near
seg_web(f'{WORK}/s2.mp4', 'landing.webm', L['type'] - 1.3, L['how'] + 4.3)
# s3: upgrade in place from the extension, then the one-transaction explainer
seg_popup(f'{WORK}/s3a.mp4', 'upgrade.webm', 1.0, 12.0, 's3', 'Upgrade in place.\nOne transaction.', 'Same account name, same balance.\nYour key stays as lock 1.')
seg_web(f'{WORK}/s3b.mp4', 'landing.webm', L['how'] + 4.3, L['how'] + 8.5)
seg_popup(f'{WORK}/s3c.mp4', 'tour.webm', 3.2, 6.8, 's3c', 'Two locks on.', 'ed25519 + ML-DSA-65,\nchecked on chain.')
cat(f'{WORK}/s3.mp4', [f'{WORK}/s3a.mp4', f'{WORK}/s3b.mp4', f'{WORK}/s3c.mp4'])
# s4/s5/s6: the phone app (final build, magen-noa.testnet), then the explorer
parts_src.update({'s4': 'phone3.mov', 's5': 'phone3.mov', 's6': 'phone3.mov'})
seg_phone(f'{WORK}/s4.mp4', [(29, 33, 1), (45, 50, 1), (58, 66, 2), (66, 76, 1)], 's4', 'Upgrade. Send.\nSigned twice.', 'Keys made on the phone.\nZero classical keys on NEAR.')
seg_phone(f'{WORK}/s5.mp4', [(98, 106, 1), (113, 121, 2), (121, 132, 1)], 's5', 'Every chain,\none quantum key.', 'ETH · BTC · SOL · Cosmos via\nNEAR Chain Signatures.')
seg_phone(f'{WORK}/s6a.mp4', [(146, 152, 1), (152, 162, 2), (162, 168, 1)], 's6', 'The Q-Day\nswitch.', 'A native post-quantum key\non the same account.')
seg_web(f'{WORK}/s6b.mp4', 'explorer.webm', 2.0, 4.6, zoom=(130, 0, 1180, 664))
seg_web(f'{WORK}/s6c.mp4', 'explorer.webm', 4.6, 8.2, zoom=(150, 40, 1067, 600))
cat(f'{WORK}/s6.mp4', [f'{WORK}/s6a.mp4', f'{WORK}/s6b.mp4', f'{WORK}/s6c.mp4'])
# s7: web phase 2 (private send, swap quote, guardians) and the extension popup
P2 = {k: v / 1000 for k, v in M['p2'].items()}
seg_web(f'{WORK}/s7a.mp4', 'p2.webm', P2['private'] - 3.5, P2['private'], speed=1.0)
seg_web(f'{WORK}/s7b.mp4', 'p2.webm', P2['swap'] - 2.5, P2['swap'], speed=1.0)
seg_web(f'{WORK}/s7c.mp4', 'p2.webm', P2['guardians'] - 3.0, P2['guardians'], speed=1.0)
seg_popup(f'{WORK}/s7d.mp4', 'tour.webm', 7.6, 11.0, 's7', 'In your browser.', 'dApps connect with window.magen.\nEvery request: signed twice.')
cat(f'{WORK}/s7.mp4', [f'{WORK}/s7a.mp4', f'{WORK}/s7b.mp4', f'{WORK}/s7c.mp4', f'{WORK}/s7d.mp4'])
# s8: get Magen + end card
seg_web(f'{WORK}/s8a.mp4', 'landing.webm', L['get'] + 0.25, L['get'] + 5.75)
still(f'{WORK}/s8b.mp4', endcard(), 6.0)
cat(f'{WORK}/s8.mp4', [f'{WORK}/s8a.mp4', f'{WORK}/s8b.mp4'])

# Audio: each scene's narration starts 0.35 s in; the scene lasts at least narration + 0.7 s (hold the last frame).
voices = {r['id']: r['dur'] for r in json.load(open(f'{HERE}/voice/durations.json'))}
scenes, t, inputs, filt = [], 0.0, [], []
for i, sid in enumerate(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']):
    v = f'{WORK}/{sid}.mp4'; need = voices[sid] + 1.05
    if dur(v) < need:
        pad = f'{WORK}/{sid}-pad.mp4'
        run(['-i', v, '-vf', f'tpad=stop_mode=clone:stop_duration={need - dur(v):.2f}', *ENC, pad]); v = pad
    scenes.append(v); inputs += ['-i', f'{HERE}/voice/{sid}.wav']
    filt.append(f'[{i}]adelay={int((t + 0.35) * 1000)}|{int((t + 0.35) * 1000)}[a{i}]'); t += dur(v)
picture = f'{WORK}/picture.mp4'; cat(picture, scenes)
audio = f'{WORK}/voice.wav'
run([*inputs, '-filter_complex', ';'.join(filt) + ';' + ''.join(f'[a{i}]' for i in range(len(scenes))) + f'amix=inputs={len(scenes)}:normalize=0,apad,atrim=0:{t:.2f},loudnorm=I=-16:TP=-1.5', '-ar', '48000', audio])
os.makedirs(f'{HERE}/../versions/{VERSION}', exist_ok=True)
final = f'{HERE}/../versions/{VERSION}/magen-near-film.mp4'
run(['-i', picture, '-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', final])
share = f'{HERE}/../versions/{VERSION}/magen-near-film-share.mp4'
run(['-i', final, '-vf', 'scale=1280:720', '-c:v', 'libx264', '-crf', '26', '-preset', 'medium', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', share])
print('FILM', final, round(dur(final), 2), 's; share', round(os.path.getsize(share) / 1e6, 1), 'MB')
