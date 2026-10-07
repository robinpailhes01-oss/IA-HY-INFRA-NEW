#!/usr/bin/env bash
# Prépare les 10 segments du reel « oh, life » : HDR->SDR, 1080x1920, 30 i/s, muets.
# Usage : prep_clips.sh <dossier_drive> <dossier_sortie>
set -euo pipefail
DRIVE=$1; OUT=$2; mkdir -p "$OUT"
TM="zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
# plan | rush | début source (s) | durée source (s) | facteur ralenti | durée du plan (s)
PLANS="
01 11 5.00 1.716 2.0   3.4333
02 02 0.00 1.950 1.3333 2.6000
03 04 0.70 2.000 1.0   2.0000
04 01 0.30 1.500 1.0   1.5000
05 05 0.50 1.534 1.0   1.5333
06 08 7.30 2.567 1.0   2.5667
07 06 0.80 4.300 1.0   4.3000
08 07 1.50 2.500 1.0   2.5000
09 10 0.30 2.422 1.5   3.6333
10 09 0.50 2.640 1.2   3.1667
"
while read -r plan rush ss dur slow len; do
  [ -z "$plan" ] && continue
  src=$(ls "$DRIVE"/"$rush"-*/*.MOV)
  # marge de 0.2 s en fin de plan pour éviter une image noire à la coupe
  ffmpeg -v error -y -ss "$ss" -t "$(python3 -c "print($dur+0.2/$slow)")" -i "$src" \
    -vf "$TM,scale=1080:1920:flags=lanczos,setpts=${slow}*(PTS-STARTPTS),fps=30" \
    -an -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart \
    "$OUT/plan$plan.mp4" &
done <<< "$PLANS"
wait
for f in "$OUT"/plan*.mp4; do
  printf "%s " "$(basename "$f")"; ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_frames:format=duration -of csv=p=0 "$f" | tr '\n' ' '; echo
done
