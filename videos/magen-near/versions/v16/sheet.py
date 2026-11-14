# Contact sheet of a take: one labelled thumbnail just after each active interval ends (or at given times).
import subprocess, sys, json, os
from PIL import Image, ImageDraw, ImageFont
f, out = sys.argv[1], sys.argv[2]; ts = json.loads(sys.argv[3])
W, H = 180, 391; cols = 8; rows = (len(ts) + cols - 1) // cols
sheet = Image.new('RGB', (W * cols, (H + 22) * rows), (30, 30, 30)); d = ImageDraw.Draw(sheet)
for i, t in enumerate(ts):
    p = f'/tmp/_th{os.getpid()}.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', f, '-frames:v', '1', '-vf', f'scale={W}:{H}', p], check=True)
    im = Image.open(p); x, y = (i % cols) * W, (i // cols) * (H + 22); sheet.paste(im, (x, y + 22)); d.text((x + 4, y + 4), f'{t:.2f}', fill=(255, 255, 0))
sheet.save(out, quality=80)
