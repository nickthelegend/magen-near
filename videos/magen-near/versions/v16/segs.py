# Lists active (changing) intervals of a phone take using ffmpeg freezedetect; prints start-end per interval.
import subprocess, re, sys, json
f = sys.argv[1]
out = subprocess.run(['ffmpeg', '-i', f, '-vf', 'scale=240:-2,freezedetect=n=0.002:d=0.6', '-map', '0:v', '-f', 'null', '-'], capture_output=True, text=True).stderr
st = [float(x) for x in re.findall(r'freeze_start: ([\d.]+)', out)]; en = [float(x) for x in re.findall(r'freeze_end: ([\d.]+)', out)]
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))
if len(en) < len(st): en.append(dur)
act = []; t = 0
for s, e in zip(st, en):
    if s - t > 0.05: act.append((round(t, 2), round(s, 2)))
    t = e
if dur - t > 0.05: act.append((round(t, 2), round(dur, 2)))
print(json.dumps(act))
