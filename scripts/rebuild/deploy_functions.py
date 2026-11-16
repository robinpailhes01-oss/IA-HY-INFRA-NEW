#!/usr/bin/env python3
"""Déploie les fonctions Edge (supabase/functions/*) sur un projet Supabase via
l'API de gestion. Le jeton d'accès est ajouté par le proxy de la session : il
n'apparaît jamais ici (ne pas ajouter d'en-tête Authorization).

    python3 scripts/rebuild/deploy_functions.py <ref> [fonction ...]

Chaque fonction est déployée avec verify_jwt=false : elles vérifient toutes elles-mêmes
leur secret (x-cron-secret, secret partagé, signature Stripe…) parce qu'elles sont appelées
par des tâches planifiées et des webhooks, jamais par un navigateur connecté.
"""
import json
import os
import re
import sys
import urllib.request
import uuid

ROOT = __file__.rsplit("/scripts/", 1)[0]
FUNCS = f"{ROOT}/supabase/functions"
ref = sys.argv[1]
only = set(sys.argv[2:])
if not re.fullmatch(r"[a-z]{20}", ref):
    sys.exit("identifiant de projet invalide")


def shared_imports(path, seen):
    """Fichiers _shared importés (récursivement) par un fichier."""
    src = open(path).read()
    out = []
    for m in re.finditer(r'from\s+"(\.{1,2}/[^"]+)"', src):
        target = os.path.normpath(os.path.join(os.path.dirname(path), m.group(1)))
        if target.startswith(f"{FUNCS}/_shared/") and target not in seen:
            seen.add(target)
            out.append(target)
            out += shared_imports(target, seen)
    return out


def multipart(fields, files):
    boundary = uuid.uuid4().hex
    body = b""
    for k, v in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for name, data in files:
        body += (
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
            f"Content-Type: application/typescript\r\n\r\n"
        ).encode() + data + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    return boundary, body


names = sorted(d for d in os.listdir(FUNCS) if d != "_shared" and os.path.isdir(f"{FUNCS}/{d}"))
if only:
    names = [n for n in names if n in only]
ok, bad = [], []
for name in names:
    entry = f"{FUNCS}/{name}/index.ts"
    files = [("index.ts", open(entry, "rb").read())]
    for shared in shared_imports(entry, set()):
        files.append((os.path.relpath(shared, f"{FUNCS}/{name}"), open(shared, "rb").read()))
    meta = json.dumps({"entrypoint_path": "index.ts", "name": name, "verify_jwt": False})
    boundary, body = multipart({"metadata": meta}, files)
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/functions/deploy?slug={name}",
        data=body,
        method="POST",
        headers={"content-type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            res = json.loads(r.read())
        ok.append(name)
        print(f"OK   {name}  v{res.get('version')}  {res.get('status')}  ({len(files)} fichier(s))")
    except urllib.error.HTTPError as e:
        bad.append(name)
        print(f"ECHEC {name}: HTTP {e.code} {e.read().decode()[:300]}")
print(f"\n{len(ok)} déployée(s), {len(bad)} en échec")
