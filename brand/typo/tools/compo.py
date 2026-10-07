"""Construit une vraie composition HyperFrames a partir du resultat d'adapt.py (NN.json) et d'un clip SDR.
Usage : python3 -I tools/compo.py <NN.json> <clip.mp4> <dossier_projet>
Le clip est copie dans le dossier sous le nom plan.mp4 ; ensuite : npx hyperframes lint / check / snapshot."""
import json
import os
import shutil
import sys

FINAL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, FINAL)
import adapt  # noqa: E402

res, clip, dossier = sys.argv[1], sys.argv[2], sys.argv[3]
cfg = json.load(open(res, encoding="utf-8"))["cfg"]
os.makedirs(dossier, exist_ok=True)
shutil.copyfile(clip, os.path.join(dossier, "plan.mp4"))
print(adapt.write_composition(dossier, cfg, "plan.mp4"))
for f, body in (("hyperframes.json", {"$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
                                      "paths": {"blocks": "compositions", "components": "compositions/components",
                                                "assets": "assets"}}),
                ("meta.json", {"id": "typo-" + os.path.basename(res)[:2], "name": "typo-" + os.path.basename(res)[:2]})):
    p = os.path.join(dossier, f)
    if not os.path.exists(p):
        json.dump(body, open(p, "w"), indent=2)
