"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, ShieldCheck } from "lucide-react";
import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";

import { Button } from "@/components/ui/button";
import { ToggleRow } from "@/components/finance/form-bits";
import { formatNumber } from "@/lib/format";

// Crée la sauvegarde complète DANS LE NAVIGATEUR : le serveur ne renvoie que
// des pages de lignes (jamais la clé de service), le ZIP se monte ici puis se
// télécharge. Rien n'est stocké nulle part ailleurs.

type TableInfo = { name: string; kind: "table" | "view"; count: number | null; error: string | null; sensitive: boolean };
type FileInfo = { bucket: string; path: string; size: number | null };
type Manifest = {
  generatedAt: string;
  supabaseUrl: string;
  service: boolean;
  isAdmin: boolean;
  openapi: boolean;
  tables: TableInfo[];
  buckets: Array<{ id: string; public: boolean }>;
  files: FileInfo[];
  storageError: string | null;
};

type Check = { name: string; expected: number | null; got: number; error: string | null };
type Result = { size: number; checks: Check[]; files: number; filesFailed: string[]; users: number | null; notes: string[]; fileName: string };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body;
}

export function BackupPanel({ demo }: { demo: boolean }) {
  const [includeWa, setIncludeWa] = useState(false);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const cancel = useRef(false);

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    cancel.current = false;
    try {
      setStep("Lecture de la liste des tables…");
      setProgress(2);
      const manifest = await getJson<Manifest>(`/api/admin/backup/manifest${includeWa ? "?wa=1" : ""}`);

      const chunks: Uint8Array[] = [];
      const zip = new Zip((err, chunk) => {
        if (err) throw err;
        chunks.push(chunk);
      });
      const addJson = (path: string, value: unknown) => {
        const f = new ZipDeflate(path, { level: 6 });
        zip.add(f);
        f.push(strToU8(JSON.stringify(value, null, 1)), true);
      };

      const notes: string[] = [];
      const checks: Check[] = [];
      const todo = manifest.tables.filter((t) => !t.error || t.count !== null);
      const total = todo.length + manifest.files.length + 3;
      let doneUnits = 0;
      const bump = () => setProgress(Math.min(98, 5 + Math.round((++doneUnits / total) * 93)));

      // 1. Les lignes de chaque table.
      for (const t of manifest.tables) {
        if (cancel.current) throw new Error("Annulé");
        if (t.sensitive && t.count === null) {
          notes.push(`${t.name} non incluse (session WhatsApp : case non cochée ou réservée aux administrateurs).`);
          continue;
        }
        if (t.error && t.count === null) {
          checks.push({ name: t.name, expected: null, got: 0, error: t.error });
          continue;
        }
        setStep(`Table ${t.name}…`);
        const rows: unknown[] = [];
        let from: number | null = 0;
        let failure: string | null = null;
        while (from !== null) {
          try {
            const page: { rows: unknown[]; next: number | null } = await getJson(
              `/api/admin/backup/table?name=${encodeURIComponent(t.name)}&from=${from}`,
            );
            rows.push(...page.rows);
            from = page.next;
          } catch (e) {
            failure = e instanceof Error ? e.message : String(e);
            from = null;
          }
        }
        addJson(`data/${t.name}.json`, rows);
        checks.push({ name: t.name, expected: t.count, got: rows.length, error: failure });
        bump();
      }

      // 2. Le schéma publié par PostgREST (types réels des colonnes).
      setStep("Schéma de la base…");
      try {
        const { openapi } = await getJson<{ openapi: unknown }>("/api/admin/backup/schema");
        if (openapi) addJson("schema/openapi.json", openapi);
        else notes.push("Schéma non disponible (clé de service absente ou refusée).");
      } catch (e) {
        notes.push(`Schéma : ${e instanceof Error ? e.message : String(e)}`);
      }
      bump();

      // 3. Les comptes de connexion.
      let users: number | null = null;
      setStep("Comptes de connexion…");
      try {
        const u = await getJson<{ users: unknown[] }>("/api/admin/backup/users");
        addJson("auth/users.json", u.users);
        users = u.users.length;
      } catch (e) {
        notes.push(`Comptes de connexion non exportés : ${e instanceof Error ? e.message : String(e)}`);
      }
      bump();

      // 4. Les fichiers (justificatifs, photos…).
      const filesFailed: string[] = [];
      let filesDone = 0;
      for (const f of manifest.files) {
        if (cancel.current) throw new Error("Annulé");
        setStep(`Fichier ${filesDone + 1} sur ${manifest.files.length}…`);
        try {
          const res = await fetch(`/api/admin/backup/file?bucket=${encodeURIComponent(f.bucket)}&path=${encodeURIComponent(f.path)}`, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          const entry = new ZipPassThrough(`storage/${f.bucket}/${f.path}`);
          zip.add(entry);
          entry.push(new Uint8Array(await res.arrayBuffer()), true);
          filesDone++;
        } catch {
          filesFailed.push(`${f.bucket}/${f.path}`);
        }
        bump();
      }
      if (manifest.storageError) notes.push(`Stockage : ${manifest.storageError}`);

      // 5. Récapitulatif et vérification.
      const bad = checks.filter((c) => c.error || (c.expected !== null && c.expected !== c.got));
      addJson("verification.json", {
        generatedAt: manifest.generatedAt,
        supabaseUrl: manifest.supabaseUrl,
        tables: checks,
        problemes: bad,
        fichiers: { attendus: manifest.files.length, exportes: filesDone, echecs: filesFailed },
        comptes: users,
        notes,
      });
      const readme = [
        "SAUVEGARDE COMPLÈTE — Harmonie Yacht",
        `Créée le ${manifest.generatedAt}`,
        `Projet Supabase : ${manifest.supabaseUrl}`,
        "",
        "data/<table>.json   : toutes les lignes de chaque table",
        "schema/openapi.json : la structure réelle (types des colonnes, clés)",
        "auth/users.json     : comptes de connexion (sans mots de passe)",
        "storage/            : fichiers (justificatifs, photos…)",
        "verification.json   : comptes attendus / exportés, problèmes",
        "",
        "ATTENTION : ce fichier contient les données personnelles de tes clients.",
        "Garde-le dans un endroit privé, ne le partage pas et ne le mets jamais dans GitHub.",
        includeWa ? "Il contient aussi la session WhatsApp (accès à ton compte) : encore plus sensible." : "",
      ].join("\n");
      const r = new ZipDeflate("LISEZMOI.txt");
      zip.add(r);
      r.push(strToU8(readme), true);
      zip.end();

      setStep("Préparation du fichier…");
      const blob = new Blob(chunks as BlobPart[], { type: "application/zip" });
      const fileName = `sauvegarde-harmonie-${manifest.generatedAt.slice(0, 10)}.zip`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);

      setProgress(100);
      setResult({ size: blob.size, checks: bad.length ? bad : checks, files: filesDone, filesFailed, users, notes, fileName });
      if (bad.length) setResult((r0) => (r0 ? { ...r0, checks: bad } : r0));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setStep("");
    }
  }

  const problems = result ? result.checks.filter((c) => c.error || (c.expected !== null && c.expected !== c.got)) : [];

  return (
    <div className="grid gap-5">
      <div className="vitre-inset grid gap-3 rounded-[22px] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ocean" />
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            Le fichier ZIP se crée dans ton navigateur et se télécharge sur ton ordinateur : rien n&apos;est envoyé ailleurs. Il contient
            toutes les tables, la structure de la base, les comptes de connexion et les fichiers. Compte de 1 à 5 minutes.
          </p>
        </div>
        <ToggleRow
          checked={includeWa}
          onChange={setIncludeWa}
          label="Inclure la session WhatsApp (évite de rescanner le QR)"
        />
        {includeWa && (
          <p className="t-caption text-warning">
            Cette session donne accès à ton compte WhatsApp : garde le fichier très précieusement. Réservé aux administrateurs.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={run} disabled={running}>
          {running ? <Loader2 className="animate-spin" /> : <Download />}
          {running ? "Sauvegarde en cours…" : "Créer la sauvegarde complète"}
        </Button>
        {running && (
          <Button variant="ghost" onClick={() => (cancel.current = true)}>
            Annuler
          </Button>
        )}
        {demo && <span className="t-caption text-ink-3">Mode démo : données fictives.</span>}
      </div>

      {running && (
        <div className="grid gap-2" role="status" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-[rgba(11,37,69,0.08)]">
            <div className="h-full rounded-full bg-ocean transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="t-caption text-ink-3">{step}</p>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-2xl bg-[rgba(224,77,85,0.08)] px-4 py-3 text-[13px] text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {result && (
        <div className="grid gap-3 rounded-[22px] border border-white/90 bg-white/60 p-5">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
            {problems.length === 0 && result.filesFailed.length === 0 ? (
              <CheckCircle2 className="size-5 text-success" />
            ) : (
              <AlertTriangle className="size-5 text-warning" />
            )}
            {result.fileName} · {(result.size / 1024 / 1024).toFixed(1)} Mo
          </p>
          <ul className="space-y-1 text-[13px] text-ink-2">
            <li>{result.checks.length > 0 && problems.length === 0 ? "Toutes les tables sont complètes : le nombre de lignes exportées correspond." : `${problems.length} table(s) à vérifier :`}</li>
            {problems.map((p) => (
              <li key={p.name} className="text-warning">
                {p.name} : {p.error ? p.error : `${formatNumber(p.got)} lignes exportées sur ${formatNumber(p.expected ?? 0)}`}
              </li>
            ))}
            <li>{formatNumber(result.files)} fichier(s) exporté(s){result.filesFailed.length ? `, ${result.filesFailed.length} en échec` : ""}.</li>
            {result.users !== null && <li>{formatNumber(result.users)} compte(s) de connexion.</li>}
            {result.notes.map((n) => (
              <li key={n} className="text-warning">{n}</li>
            ))}
          </ul>
          <p className="t-caption text-ink-3">
            Le détail est dans <code>verification.json</code> à l&apos;intérieur du ZIP. Garde ce fichier en lieu sûr, il contient les
            données de tes clients.
          </p>
        </div>
      )}
    </div>
  );
}
