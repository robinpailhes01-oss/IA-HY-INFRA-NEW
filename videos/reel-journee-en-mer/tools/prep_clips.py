"""Prépare les segments du reel depuis les originaux iPhone : HDR->SDR, recadrage éventuel, ralenti, 1080x1920, 30 i/s, muets.
Usage (depuis le projet) : python3 -I tools/prep_clips.py <dossier_drive> assets/rushes [numéros de plans, ex. 16,18]
<dossier_drive> contient <NN>-<driveID>/<fichier>.MOV (voir assets/SOURCES.md). Lit plan.json.
"""
import sys, json, glob, subprocess
from concurrent.futures import ThreadPoolExecutor

DRIVE, OUT = sys.argv[1], sys.argv[2]
ONLY = {int(x) for x in sys.argv[3].split(',')} if len(sys.argv) > 3 else None
plan = json.load(open('plan.json'))
TM = ('zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,'
      'zscale=t=bt709:m=bt709:r=tv,format=yuv420p')
MARGIN = 0.2  # secondes de plan en plus, pour qu'aucune coupe ne tombe sur une image manquante


def job(s):
    src = glob.glob(f"{DRIVE}/{s['rush']}-*/*.MOV")[0]
    z, ax, ay, slow = s['zoom'], s['ax'], s['ay'], s['slow']
    vf = TM
    if s.get('rotate'):
        vf += f",rotate={s['rotate']}*PI/180"  # horizon redressé ; le zoom (≥ 1,04) cache les coins
    if z > 1:
        vf += f",crop=iw/{z}:ih/{z}:(iw-iw/{z})*{ax}:(ih-ih/{z})*{ay}"
    vf += f",scale=1080:1920:flags=lanczos,setpts={slow}*(PTS-STARTPTS)"
    if s['rush'] in ('01', '02', '03', '04', '05', '06', '07', '08') and slow != 1:
        vf += ',minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1'  # ralenti fluide d'un rush à 30 i/s
    vf += ',fps=30'
    out = f"{OUT}/plan{s['n']:02d}.mp4"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(s['src_start']), '-t', f"{s['src_dur'] + MARGIN / slow:.4f}", '-i', src,
                    '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
                    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', out], check=True)
    n = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames',
                            '-of', 'csv=p=0', out], capture_output=True, text=True).stdout.strip())
    need = s['f1'] - s['f0']
    return f"plan{s['n']:02d} rush {s['rush']} : {n} images (besoin {need}) {'OK' if n >= need else 'TROP COURT'}"


with ThreadPoolExecutor(max_workers=4) as ex:
    for line in ex.map(job, [s for s in plan['shots'] if ONLY is None or s['n'] in ONLY]):
        print(line, flush=True)
