"""Prépare les plans du reel depuis les originaux : HDR->SDR si besoin, recadrage, ralenti, 1080x1920, 30 i/s, muets.
Usage (depuis le projet) : python3 -I tools/prep_clips.py <dossier_drive_nouveaux> <dossier_drive_anciens> assets/rushes [numéros de plans, ex. 3,5]
Rushes « Nxx » : <dossier_drive_nouveaux>/<xx>-<driveID>/<fichier> ; rushes « Axx » : <dossier_drive_anciens>/<xx>-<driveID>/<fichier>
(voir assets/SOURCES.md). Lit plan.json.
- HDR (iPhone HLG) : tone mapping vers SDR ; SDR : couleurs gardées telles quelles.
- Ralenti exact quand la cadence le permet (60 i/s ×2) ; sinon interpolation de mouvement (sources à 25 ou 30 i/s).
"""
import sys, json, glob, subprocess
from concurrent.futures import ThreadPoolExecutor

NEW, OLD, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
ONLY = {int(x) for x in sys.argv[4].split(',')} if len(sys.argv) > 4 else None
plan = json.load(open('plan.json'))
TM = ('zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,'
      'zscale=t=bt709:m=bt709:r=tv,format=yuv420p,')
MARGIN = 0.2  # secondes de plan en plus, pour qu'aucune coupe ne tombe sur une image manquante


def source(rush):
    base = NEW if rush[0] == 'N' else OLD
    return sorted(glob.glob(f"{base}/{rush[1:]}-*/*"))[0]


def probe(src):
    st = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=color_transfer,r_frame_rate',
                                    '-of', 'json', src], capture_output=True, text=True).stdout)['streams'][0]
    num, den = st['r_frame_rate'].split('/')
    return st.get('color_transfer') == 'arib-std-b67', float(num) / float(den)


def job(s):
    src = source(s['rush'])
    hdr, fps = probe(src)
    z, ax, ay, slow = s['zoom'], s['ax'], s['ay'], s['slow']
    vf = TM if hdr else ''
    vf += 'format=yuv420p'
    if s.get('hflip'):
        vf += ',hflip'
    if s.get('rotate'):
        vf += f",rotate={s['rotate']}*PI/180"  # horizon redressé ; le zoom (≥ 1,04) cache les coins
    if z > 1:
        vf += f",crop=iw/{z}:ih/{z}:(iw-iw/{z})*{ax}:(ih-ih/{z})*{ay}"
    vf += f",scale=1080:1920:flags=lanczos,setpts={slow}*(PTS-STARTPTS)"
    if fps / slow < 29.5:
        vf += ',minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1'  # pas assez d'images : on interpole
    vf += ',fps=30'
    out = f"{OUT}/plan{s['n']:02d}.mp4"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(s['src_start']), '-t', f"{s['src_dur'] + MARGIN / slow:.4f}", '-i', src,
                    '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-g', '30', '-keyint_min', '30', '-pix_fmt', 'yuv420p',
                    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', out], check=True)
    n = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames',
                            '-of', 'csv=p=0', out], capture_output=True, text=True).stdout.strip())
    need = s['f1'] - s['f0']
    return (f"plan{s['n']:02d} rush {s['rush']} ({'HDR' if hdr else 'SDR'} {fps:.2f} i/s, ×{slow}) : {n} images (besoin {need}) "
            f"{'OK' if n >= need else 'TROP COURT'}")


with ThreadPoolExecutor(max_workers=3) as ex:
    for line in ex.map(job, [s for s in plan['shots'] if ONLY is None or s['n'] in ONLY]):
        print(line, flush=True)
