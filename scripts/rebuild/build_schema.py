#!/usr/bin/env python3
"""Assemble le SQL complet de reconstruction d'une base Harmonie Yacht.

    python3 scripts/rebuild/build_schema.py --url https://<ref>.supabase.co > schema-complete.sql

Ordre : tables de base (reconstituées) → fonctions et accès → migrations 0001 à
0035 → vues dérivées. Les tâches planifiées des migrations (cron) contiennent
l'adresse de l'ANCIEN projet : elle est remplacée par --url.
"""
import argparse
import glob
import re
import sys

ROOT = __file__.rsplit("/scripts/", 1)[0]
OLD_URL = "https://szdfpjyytwedhochvzfd.supabase.co"

ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True, help="URL du nouveau projet, ex. https://abcd.supabase.co")
ap.add_argument("--strip-extensions", action="store_true", help="(tests) retire create extension")
args = ap.parse_args()
if not re.fullmatch(r"https://[a-z0-9]{20}\.supabase\.co", args.url):
    sys.exit("URL invalide : attendu https://<20 caractères>.supabase.co")

def read(path):
    return open(f"{ROOT}/{path}").read()

parts = [
    "-- SQL de reconstruction — Harmonie Yacht. Généré par scripts/rebuild/build_schema.py.",
    "-- À coller en entier dans Supabase → SQL Editor, puis Run.",
    "create extension if not exists pgcrypto;",
    "create extension if not exists pg_net with schema extensions;",
    "create extension if not exists pg_cron;",
    read("supabase/rebuild/01_base_schema.sql"),
    read("supabase/rebuild/02_post_base.sql"),
]
for f in sorted(glob.glob(f"{ROOT}/supabase/migrations/*.sql")):
    name = f.rsplit("/", 1)[1]
    sql = open(f).read().replace(OLD_URL, args.url)
    parts.append(f"-- ═══ migration {name} ═══\n{sql}")
parts.append(read("supabase/rebuild/03_after_migrations.sql"))
sql = "\n\n".join(parts)
if args.strip_extensions:
    sql = re.sub(r"(?im)^\s*create extension[^;]*;\s*$", "", sql)
sys.stdout.write(sql)
