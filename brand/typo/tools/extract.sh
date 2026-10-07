#!/bin/bash
# Extrait 1 image toutes les 0,5 s d'un rush -> PNG 1080x1920 SDR, SANS bloc couleur (cICP/gAMA/cHRM).
#   DRIVE=<dossier_drive> extract.sh NN [sortie] : original HDR (HLG) du Drive, tonemap hable (meme filtre que
#                                         videos/reel-oh-life/tools/prep_clips.sh) ; <dossier_drive>/NN-<id>/<fichier>.MOV
#   extract.sh <clip_sdr.mp4> <dossier> : clip SDR deja prepare (le plan tel qu'il est coupe au montage)
# Les blocs couleur sont retires (tools/nettoie_png.py) : au rendu, HyperFrames marque les images de la
# video en sRGB et Chrome montre les pixels bruts ; avec les blocs BT.709 de ffmpeg, Chrome les assombrirait
# de 4 a 7 niveaux et la mesure ne correspondrait plus au rendu.
HERE=$(cd "$(dirname "$0")" && pwd)
TM="zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
if [ -f "$1" ]; then
  src=$1; out=$2; vf="fps=2,scale=1080:1920"
else
  n=$1; src=$(ls "${DRIVE:?indiquer DRIVE=<dossier_drive>}"/$n-*/*.MOV); out=${2:-frames/$n}; vf="fps=2,$TM,scale=1080:1920"
fi
mkdir -p "$out"
ffmpeg -nostdin -hide_banner -loglevel error -y -i "$src" -vf "$vf" -start_number 0 "$out/f%03d.png"
python3 -I "$HERE/nettoie_png.py" "$out"
echo "$out : $(ls "$out" | wc -l) images"
