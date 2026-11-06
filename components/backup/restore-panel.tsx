"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileArchive, Loader2, UploadCloud } from "lucide-react";
import { unzipSync, strFromU8 } from "fflate";

import { Button } from "@/components/ui/button";
import { ToggleRow } from "@/components/finance/form-bits";
import { createClient } from "@/lib/supabase/client";
import { CHUNK_BYTES, CHUNK_ROWS, CLEAR_BEFORE, SERVER_FILE_LIMIT } from "@/lib/backup/restore-config";
import { RESTORE_ORDER, SELF_REFERENCES } from "@/lib/backup/schema-meta";
import { formatNumber } from "@/lib/format";

// Restaure une sauvegarde (le ZIP de la page Sauvegarde) dans la base à laquelle
// ce tableau de bord est CONNECTÉ. Le ZIP est lu dans le navigateur ; le serveur
// ne reçoit que des lots de lignes. Les erreurs ne s'arrêtent jamais sur une ligne :
// tout est consigné dans un rapport à la fin.

type Row = Record<string, unknown>;
type Status = { target: string; email: string | null; counts: Record<string, number | null>; missing: string[] };
type TableReport = { table: string; expected: number; restored: number; failed: Array<{ key: string; error: string }>; droppedColumns: string[]; error?: string };
type Report = {
  startedAt: string;
  target: string;
  tables: TableReport[];
  users: { created: number; skipped: Array<{ email: string | null; reason: string }> } | null;
  files: { expected: number; restored: number; failed: string[] };
  notes: string[];
};

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

export function RestorePanel() {
  const [files, setFiles] = useState<Record<string, Uint8Array> | null>(null);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [includeWa, setIncludeWa] = useState(false);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const cancel = useRef(false);

  async function loadFile(file: File) {
    setError(null);
    setReport(null);
    try {
      setStep("Lecture du fichier…");
      const unzipped = unzipSync(new Uint8Array(await file.arrayBuffer()));
      if (!unzipped["verification.json"] && !Object.keys(unzipped).some((k) => k.startsWith("data/"))) {
        throw new Error("Ce fichier n'est pas une sauvegarde du tableau de bord.");
      }
      setFiles(unzipped);
      setFileName(file.name);
      const st = await fetch("/api/admin/restore/status", { cache: "no-store" });
      const body = (await st.json()) as Status & { error?: string };
      if (!st.ok) throw new Error(body.error ?? `HTTP ${st.status}`);
      setStatus(body);
    } catch (e) {
      setFiles(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStep("");
    }
  }

  const tableRows = (name: string): Row[] | null => {
    const f = files?.[`data/${name}.json`];
    return f ? (JSON.parse(strFromU8(f)) as Row[]) : null;
  };

  async function run() {
    if (!files || !status) return;
    setRunning(true);
    setError(null);
    cancel.current = false;
    const rep: Report = {
      startedAt: new Date().toISOString(),
      target: status.target,
      tables: [],
      users: null,
      files: { expected: 0, restored: 0, failed: [] },
      notes: [],
    };
    try {
      const todo = RESTORE_ORDER.filter((t) => files[`data/${t}.json`] && (t !== "wa_auth_state" || includeWa));
      const storageEntries = Object.keys(files).filter((k) => k.startsWith("storage/") && k !== "storage/");
      const total = todo.length + storageEntries.length + 2;
      let done = 0;
      const bump = () => setProgress(Math.min(99, Math.round((++done / total) * 100)));

      // 1. Comptes de connexion.
      const remap: Record<string, string> = {};
      if (files["auth/users.json"]) {
        setStep("Comptes de connexion…");
        const users = JSON.parse(strFromU8(files["auth/users.json"])) as Array<{ id: string; email: string | null }>;
        const agg = { created: 0, skipped: [] as Array<{ email: string | null; reason: string }> };
        for (let i = 0; i < users.length; i += 50) {
          const r = await post<{ created: number; skipped: typeof agg.skipped; remap: Record<string, string> }>("/api/admin/restore/users", { users: users.slice(i, i + 50) });
          agg.created += r.created;
          agg.skipped.push(...r.skipped);
          Object.assign(remap, r.remap);
        }
        rep.users = agg;
      } else {
        rep.notes.push("Aucun compte de connexion dans la sauvegarde.");
      }
      bump();

      // 2. Les tables, dans l'ordre des dépendances.
      for (const table of todo) {
        if (cancel.current) throw new Error("Annulé");
        setStep(`Table ${table}…`);
        let rows = tableRows(table) ?? [];
        if (table === "profiles" && Object.keys(remap).length > 0) {
          rows = rows.map((r) => (typeof r.id === "string" && remap[r.id] ? { ...r, id: remap[r.id] } : r));
        }
        const tr: TableReport = { table, expected: rows.length, restored: 0, failed: [], droppedColumns: [] };
        try {
          if (CLEAR_BEFORE.has(table)) await post("/api/admin/restore/table", { table, clear: true });
          const passes: Array<{ nullify?: string[] }> = SELF_REFERENCES[table] ? [{ nullify: SELF_REFERENCES[table] }, {}] : [{}];
          for (let p = 0; p < passes.length; p++) {
            let batch: Row[] = [];
            let bytes = 0;
            const flush = async () => {
              if (batch.length === 0) return;
              const r = await post<{ ok: number; failed: TableReport["failed"]; droppedColumns: string[] }>("/api/admin/restore/table", {
                table,
                rows: batch,
                nullify: passes[p].nullify,
              });
              if (p === passes.length - 1) {
                tr.restored += r.ok;
                tr.failed.push(...r.failed);
              }
              tr.droppedColumns.push(...r.droppedColumns);
              batch = [];
              bytes = 0;
            };
            for (const row of rows) {
              const size = JSON.stringify(row).length;
              if (batch.length >= CHUNK_ROWS || (batch.length > 0 && bytes + size > CHUNK_BYTES)) await flush();
              batch.push(row);
              bytes += size;
            }
            await flush();
          }
        } catch (e) {
          tr.error = e instanceof Error ? e.message : String(e);
        }
        tr.droppedColumns = [...new Set(tr.droppedColumns)];
        rep.tables.push(tr);
        bump();
      }

      // 3. Les fichiers.
      rep.files.expected = storageEntries.length;
      const bucketsDone = new Set<string>();
      const supabase = createClient();
      for (const key of storageEntries) {
        if (cancel.current) throw new Error("Annulé");
        const [, bucket, ...rest] = key.split("/");
        const path = rest.join("/");
        setStep(`Fichier ${rep.files.restored + rep.files.failed.length + 1} sur ${storageEntries.length}…`);
        try {
          if (!bucketsDone.has(bucket)) {
            await post("/api/admin/restore/bucket", { id: bucket, public: false });
            bucketsDone.add(bucket);
          }
          const bytes = files[key];
          if (bytes.length <= SERVER_FILE_LIMIT) {
            const res = await fetch(`/api/admin/restore/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`, { method: "POST", body: bytes as BodyInit });
            if (!res.ok) throw new Error(String(res.status));
          } else {
            const { error: upErr } = await supabase.storage.from(bucket).upload(path, bytes, { upsert: true });
            if (upErr) throw upErr;
          }
          rep.files.restored++;
        } catch {
          rep.files.failed.push(key);
        }
        bump();
      }
      if (!includeWa && files["data/wa_auth_state.json"]) rep.notes.push("Session WhatsApp non restaurée : un nouveau scan du QR sera nécessaire.");
      setProgress(100);
      setReport(rep);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReport(rep);
    } finally {
      setRunning(false);
      setStep("");
    }
  }

  function downloadReport() {
    if (!report) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 1)], { type: "application/json" }));
    a.download = "rapport-restauration.json";
    a.click();
  }

  const present = status ? Object.values(status.counts).reduce<number>((s, c) => s + (c ?? 0), 0) : 0;
  const problems = report ? report.tables.filter((t) => t.error || t.failed.length > 0 || t.restored !== t.expected) : [];

  return (
    <div className="grid gap-5">
      <label className="vitre-inset flex cursor-pointer flex-col items-center gap-2 rounded-[22px] px-6 py-8 text-center">
        <UploadCloud className="size-6 text-ocean" />
        <span className="text-[14px] font-semibold text-foreground">{fileName || "Choisir le fichier de sauvegarde (.zip)"}</span>
        <span className="t-caption text-ink-3">Le fichier reste dans ton navigateur : seules les lignes sont envoyées à ta nouvelle base.</span>
        <input
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          disabled={running}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadFile(f);
            e.target.value = "";
          }}
        />
      </label>

      {status && files && (
        <div className="grid gap-3 rounded-[22px] border border-white/90 bg-white/60 p-5 text-[13.5px] text-ink-2">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <FileArchive className="size-4 text-ocean" /> Destination : <code className="font-normal">{status.target}</code>
          </p>
          <ul className="space-y-1">
            <li>
              {RESTORE_ORDER.filter((t) => files[`data/${t}.json`]).length} tables dans la sauvegarde,{" "}
              {formatNumber(Object.keys(files).filter((k) => k.startsWith("storage/")).length)} fichier(s).
            </li>
            <li className={present > 0 ? "text-warning" : ""}>
              {present > 0
                ? `La base de destination contient déjà ${formatNumber(present)} ligne(s) : les lignes de même identifiant seront remplacées.`
                : "La base de destination est vide."}
            </li>
            {status.missing.length > 0 && (
              <li className="text-danger">
                Tables absentes de la destination : {status.missing.join(", ")}. Applique d&apos;abord le SQL de reconstruction.
              </li>
            )}
          </ul>
          {files["data/wa_auth_state.json"] && (
            <ToggleRow checked={includeWa} onChange={setIncludeWa} label="Restaurer aussi la session WhatsApp (évite de rescanner le QR)" />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={run} disabled={running || !files || !status || status.missing.length > 0}>
          {running ? <Loader2 className="animate-spin" /> : <UploadCloud />}
          {running ? "Restauration en cours…" : "Restaurer la sauvegarde"}
        </Button>
        {running && (
          <Button variant="ghost" onClick={() => (cancel.current = true)}>
            Annuler
          </Button>
        )}
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

      {report && (
        <div className="grid gap-3 rounded-[22px] border border-white/90 bg-white/60 p-5">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
            {problems.length === 0 && report.files.failed.length === 0 ? <CheckCircle2 className="size-5 text-success" /> : <AlertTriangle className="size-5 text-warning" />}
            {problems.length === 0 && report.files.failed.length === 0 ? "Restauration complète" : "Restauration terminée avec des points à vérifier"}
          </p>
          <ul className="space-y-1 text-[13px] text-ink-2">
            <li>
              {formatNumber(report.tables.reduce((s, t) => s + t.restored, 0))} lignes restaurées sur {formatNumber(report.tables.reduce((s, t) => s + t.expected, 0))},
              dans {report.tables.length} tables.
            </li>
            {report.users && <li>{report.users.created} compte(s) de connexion recréé(s), {report.users.skipped.length} ignoré(s).</li>}
            <li>{formatNumber(report.files.restored)} fichier(s) sur {formatNumber(report.files.expected)}.</li>
            {problems.map((t) => (
              <li key={t.table} className="text-warning">
                {t.table} : {t.error ?? `${t.restored}/${t.expected}`}
                {t.failed.length > 0 ? ` — ${t.failed.length} ligne(s) refusée(s)` : ""}
                {t.droppedColumns.length > 0 ? ` — colonnes ignorées : ${t.droppedColumns.join(", ")}` : ""}
              </li>
            ))}
            {report.tables.filter((t) => t.droppedColumns.length > 0 && !problems.includes(t)).map((t) => (
              <li key={`d-${t.table}`} className="text-ink-3">{t.table} : colonnes ignorées ({t.droppedColumns.join(", ")}).</li>
            ))}
            {report.notes.map((n) => (
              <li key={n} className="text-ink-3">{n}</li>
            ))}
          </ul>
          <Button variant="outline" onClick={downloadReport} className="justify-self-start">
            Télécharger le rapport
          </Button>
        </div>
      )}
    </div>
  );
}
