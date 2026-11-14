#!/bin/zsh
# v16 phone takes: ./phone-rec.sh start <name> | stop. Records the film simulator (fresh "Magen Film 17 Pro") with simctl.
V="/Volumes/Extreme SSD/Projects/grokbot/projects/magen/videos/magen-near/versions/v16"; RAWDIR=/private/tmp/claude-501/-Volumes-Extreme-SSD-Projects-grokbot/07cd0cf6-fed7-4d0e-bbd3-10240f3bfebe/scratchpad/phone; mkdir -p $RAWDIR; U=$(cat "$V/work/film-udid.txt")
if [[ $1 == start ]]; then
  nohup xcrun simctl io $U recordVideo --codec h264 --force "$RAWDIR/$2.mp4" > "$V/work/rec-$2.log" 2>&1 &
  echo $! > "$V/work/rec.pid"; echo "$2 $(date +%s.%N)" >> "$V/work/rec-times.txt"; sleep 1.5; cat "$V/work/rec-$2.log"
else
  kill -INT $(cat "$V/work/rec.pid"); sleep 2.5; tail -2 "$V/work/rec-"*.log(om[1]); ls -la $RAWDIR | tail -3
fi
