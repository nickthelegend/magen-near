"""OCR every extracted frame (macOS Vision tool) and flag frames with >= 6 numbered BIP-39 words. Prints frame numbers and
counts only, never the words."""
import subprocess, sys, re, glob, os
ocr, wl, d = sys.argv[1], sys.argv[2], sys.argv[3]
B = set(open(wl).read().split())
fs = sorted(glob.glob(os.path.join(d, 'f*.png'))); flagged = []; mx = 0
for i in range(0, len(fs), 40):
    out = subprocess.run([ocr, *fs[i:i + 40]], capture_output=True, text=True).stdout
    per = {}
    for line in out.splitlines():
        if '\t' not in line: continue
        p, t = line.split('\t', 1); per.setdefault(p, []).append(t)
    for p in fs[i:i + 40]:
        txt = ' '.join(per.get(p, [])).lower()
        toks = re.findall(r'[a-z]+|\d+', txt)
        numbered = sum(1 for a, b in zip(toks, toks[1:]) if a.isdigit() and 1 <= int(a) <= 24 and b in B)
        anyb = len({t for t in toks if t in B})
        mx = max(mx, numbered)
        if numbered >= int(os.environ.get("TH", 6)): flagged.append((os.path.basename(p), numbered, anyb))
print('frames', len(fs), 'max numbered bip39 per frame', mx)
print('flagged', flagged)
