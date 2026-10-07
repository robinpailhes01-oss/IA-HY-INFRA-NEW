#!/usr/bin/env bash
# Prépare les 10 segments du reel « oh, life » : HDR->SDR, 1080x1920, 30 i/s, muets.
# Usage : prep_clips.sh <dossier_drive> <dossier_sortie>
# <dossier_drive> contient <NN>-<driveID>/<fichier>.MOV (voir assets/SOURCES.md).
set -euo pipefail
DRIVE=$1; OUT=$2; mkdir -p "$OUT"
TM="zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
# Filtres propres à un plan (appliqués après conversion et mise à l'échelle)
declare -A EXTRA=(
  [02]="minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"   # ralenti fluide (source 29,97 i/s)
  [07]="eq=saturation=0.82:contrast=1.06"                                       # cyan trop saturé
  [09]="rotate=-1.5*PI/180,scale=iw*1.05:ih*1.05,crop=1080:1920"                # horizon redressé (+ zoom pour cacher les coins)
)
# plan | rush | début source (s) | durée source (s) | facteur ralenti | durée du plan (s)
PLANS="
01 11 5.00 1.717 2.0 3.4333
02 02 0.00 1.950 1.3333 2.6000
03 04 0.70 2.000 1.0 2.0000
04 07 1.00 1.500 1.0 1.5000
05 05 0.50 1.534 1.0 1.5333
06 08 0.00 2.567 1.0 2.5667
07 06 0.30 4.300 1.0 4.3000
08 03 0.00 2.500 1.0 2.5000
09 10 1.10 1.817 2.0 3.6333
10 09 0.50 1.584 2.0 3.1667
"
while read -r plan rush ss dur slow len; do
  [ -z "$plan" ] && continue
  src=$(ls "$DRIVE"/"$rush"-*/*.MOV)
  extra=${EXTRA[$plan]:-}
  vf="$TM,scale=1080:1920:flags=lanczos,setpts=${slow}*(PTS-STARTPTS)"
  [ -n "$extra" ] && vf="$vf,$extra"
  vf="$vf,fps=30"
  # marge de 0,2 s (durée du plan) en fin de segment, dans la limite du rush
  ffmpeg -v error -y -ss "$ss" -t "$(python3 -c "print($dur+0.2/$slow)")" -i "$src" -vf "$vf" \
    -an -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart \
    "$OUT/plan$plan.mp4" &
done <<< "$PLANS"
wait
for f in "$OUT"/plan*.mp4; do
  printf "%s " "$(basename "$f")"; ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames:format=duration -of csv=p=0 "$f" | tr '\n' ' '; echo
done
