"use client";

import { Loader2, QrCode, WifiOff } from "lucide-react";

import type { ConnectionState } from "@/components/agent/inbox/types";

const STEPS = [
  "Ouvre WhatsApp Business sur le téléphone de l'entreprise",
  "Appareils liés → Lier un appareil",
  "Scanne ce code avec l'appareil photo qui s'ouvre",
];

/**
 * Quand WhatsApp n'est pas relié, Léa ne peut ni lire ni répondre : on le dit
 * en grand, avec la seule action utile (scanner le QR). Le code se rafraîchit
 * tout seul : la page interroge le service toutes les 4 secondes.
 */
export function ConnectPanel({ state }: { state: ConnectionState }) {
  const hasQr = state.status === "pending" && Boolean(state.qr);

  return (
    <div className="vitre flex min-h-[520px] flex-1 items-center justify-center rounded-[24px] p-6 sm:p-10">
      <div className="relative z-[1] grid w-full max-w-3xl items-center gap-8 md:grid-cols-[auto_1fr]">
        <div className="mx-auto grid size-[264px] place-items-center rounded-[28px] border border-white bg-white shadow-[var(--shadow-lift)]">
          {hasQr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={state.qr} alt="QR code à scanner depuis WhatsApp Business" className="size-[232px] rounded-[18px]" />
          ) : state.status === "error" ? (
            <WifiOff className="size-10 text-danger" strokeWidth={1.6} />
          ) : (
            <Loader2 className="size-8 animate-spin text-ink-3" />
          )}
        </div>

        <div className="text-center md:text-left">
          <p className="t-eyebrow mb-2 text-ink-3">WhatsApp non relié</p>
          {/* Geist : le serif est déjà pris par le titre de la page. */}
          <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-foreground">
            Reconnecte Léa à WhatsApp
          </h2>
          {hasQr ? (
            <ol className="mt-5 space-y-3 text-left">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-start gap-3 text-[13.5px] leading-snug text-ink-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[rgba(47,127,224,0.1)] text-[11.5px] font-semibold text-ocean">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          ) : (
            <p className="t-body mt-3 max-w-md text-ink-2">
              {state.status === "error"
                ? "Le service WhatsApp ne répond pas. Vérifie le déploiement Railway (service Baileys) — la page se reconnecte d'elle-même dès qu'il revient."
                : "Le service WhatsApp démarre… le QR code apparaîtra ici dans quelques secondes."}
            </p>
          )}
          <p className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-ink-3">
            <QrCode className="size-3.5" />
            Vérification automatique toutes les 4 secondes
          </p>
        </div>
      </div>
    </div>
  );
}
