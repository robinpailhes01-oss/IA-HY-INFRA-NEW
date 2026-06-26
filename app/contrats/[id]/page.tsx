import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatDateLong, formatEur } from "@/lib/format";
import { ContractActions } from "./contract-actions";

type BookingRow = {
  id: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_hours: number | null;
  offer_name: string | null;
  party_size: number | null;
  total_amount: number | null;
  deposit_amount: number | null;
  balance_due: number | null;
  notes: string | null;
  contract_signed_at: string | null;
  contract_signed_by_name: string | null;
  customers: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

function fullName(f: string | null, l: string | null): string {
  return [f, l].filter(Boolean).join(" ").trim() || "—";
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = start.slice(0, 5);
  const e = end?.slice(0, 5);
  return e ? `${s} – ${e}` : s;
}

export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, date, start_time, end_time, duration_hours, offer_name, party_size, total_amount, deposit_amount, balance_due, notes, contract_signed_at, contract_signed_by_name, customers(first_name, last_name, email, phone)",
    )
    .eq("id", id)
    .maybeSingle()
    .returns<BookingRow>();

  if (!data) notFound();

  const client = fullName(data.customers?.first_name ?? null, data.customers?.last_name ?? null);
  const isSigned = Boolean(data.contract_signed_at);
  const signedAt = data.contract_signed_at
    ? new Date(data.contract_signed_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
    : null;
  const paidDeposit = data.deposit_amount ?? 0;
  const balance = data.balance_due ?? 0;
  const total = data.total_amount ?? 0;

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      {/* Barre d'actions — cachée à l'impression */}
      <div className="print:hidden sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-3">
          <Link
            href="/bookings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Retour aux réservations
          </Link>
          <ContractActions
            bookingId={data.id}
            isSigned={isSigned}
            signedByName={data.contract_signed_by_name}
            signedAt={signedAt}
            defaultName={client}
          />
        </div>
      </div>

      {/* Le contrat lui-même */}
      <main className="mx-auto max-w-4xl bg-white px-12 py-10 text-[15px] leading-relaxed text-zinc-900 shadow-sm print:max-w-none print:px-12 print:py-0 print:shadow-none">
        <header className="mb-8 flex items-start justify-between border-b border-zinc-200 pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Harmonie Yacht</h1>
            <p className="mt-1 text-sm text-zinc-600">
              239 rue de l&apos;étang de l&apos;or — 34130 Mauguio (Carnon-Port)
            </p>
            <p className="text-sm text-zinc-600">
              📞 07 53 48 12 63 — ✉️ harmonieyacht@gmail.com
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <p>Contrat n° {data.id.slice(0, 8).toUpperCase()}</p>
            <p>Établi le {formatDateLong(new Date())}</p>
          </div>
        </header>

        <h2 className="mb-6 text-center text-xl font-semibold tracking-wide">
          Contrat de location de yacht privatif
        </h2>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-600">
            Entre les soussignés
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-zinc-200 p-4">
              <p className="text-xs uppercase text-zinc-500">Le loueur</p>
              <p className="mt-1 font-semibold">Harmonie Yacht</p>
              <p className="text-sm text-zinc-700">SIRET : [à compléter]</p>
              <p className="text-sm text-zinc-700">Représenté par : [à compléter]</p>
            </div>
            <div className="rounded-md border border-zinc-200 p-4">
              <p className="text-xs uppercase text-zinc-500">Le locataire</p>
              <p className="mt-1 font-semibold">{client}</p>
              {data.customers?.email && (
                <p className="text-sm text-zinc-700">{data.customers.email}</p>
              )}
              {data.customers?.phone && (
                <p className="text-sm text-zinc-700">{data.customers.phone}</p>
              )}
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-600">
            Objet de la location
          </h3>
          <table className="w-full border-collapse text-sm">
            <tbody className="[&_td]:border-b [&_td]:border-zinc-100 [&_td]:py-2">
              <tr>
                <td className="w-1/3 text-zinc-500">Prestation</td>
                <td className="font-medium">{data.offer_name ?? "—"}</td>
              </tr>
              <tr>
                <td className="text-zinc-500">Date</td>
                <td className="font-medium">{data.date ? formatDateLong(data.date) : "Date à fixer (carte cadeau)"}</td>
              </tr>
              <tr>
                <td className="text-zinc-500">Horaires</td>
                <td className="font-medium">{formatTimeRange(data.start_time, data.end_time)}</td>
              </tr>
              <tr>
                <td className="text-zinc-500">Durée</td>
                <td className="font-medium">
                  {data.duration_hours ? `${data.duration_hours} h` : "—"}
                </td>
              </tr>
              <tr>
                <td className="text-zinc-500">Nombre de personnes</td>
                <td className="font-medium">{data.party_size ?? "—"}</td>
              </tr>
              <tr>
                <td className="text-zinc-500">Point de départ</td>
                <td className="font-medium">Carnon-Port, Mauguio (34130)</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-600">
            Tarif et règlement
          </h3>
          <table className="w-full border-collapse text-sm">
            <tbody className="[&_td]:border-b [&_td]:border-zinc-100 [&_td]:py-2">
              <tr>
                <td className="w-1/3 text-zinc-500">Montant total TTC</td>
                <td className="font-semibold">{formatEur(total)}</td>
              </tr>
              <tr>
                <td className="text-zinc-500">Acompte versé à la réservation</td>
                <td className="font-medium text-emerald-700">{formatEur(paidDeposit)}</td>
              </tr>
              <tr>
                <td className="text-zinc-500">Solde dû le jour de la prestation</td>
                <td className="font-medium text-amber-700">{formatEur(balance)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-600">
            Conditions générales
          </h3>
          <ol className="list-decimal space-y-2 pl-5 text-[13.5px] text-zinc-700">
            <li>
              <strong>Acompte :</strong> 30 % du montant total versé à la réservation. Cet
              acompte est non remboursable en cas d&apos;annulation par le locataire à moins
              de 7 jours du départ.
            </li>
            <li>
              <strong>Solde :</strong> le solde est dû en espèces ou par virement le jour
              même, avant l&apos;embarquement.
            </li>
            <li>
              <strong>Horaires :</strong> tout retard du locataire empiète sur la durée du
              créneau réservé et ne donne lieu à aucun prolongement.
            </li>
            <li>
              <strong>Sécurité :</strong> le locataire et ses invités s&apos;engagent à
              respecter les consignes du skipper. Le port du gilet de sauvetage est
              obligatoire pour les enfants et recommandé pour tous.
            </li>
            <li>
              <strong>Météo :</strong> Harmonie Yacht se réserve le droit d&apos;annuler ou
              reporter la sortie en cas de conditions météorologiques défavorables. Un
              report ou un remboursement intégral sera alors proposé.
            </li>
            <li>
              <strong>Responsabilité :</strong> toute dégradation volontaire ou par
              négligence sera facturée au locataire. Une caution peut être demandée le
              jour de la prestation.
            </li>
            <li>
              <strong>Alcool & substances :</strong> la consommation modérée d&apos;alcool
              est tolérée. L&apos;usage de substances illicites est strictement interdit
              à bord.
            </li>
            <li>
              <strong>Droit à l&apos;image :</strong> sauf opposition écrite du locataire,
              Harmonie Yacht peut utiliser les éventuelles photos prises à bord à des
              fins de communication.
            </li>
          </ol>
          <p className="mt-3 text-xs italic text-zinc-500">
            Conditions à adapter avec tes CGV officielles — ce contrat est un modèle.
          </p>
        </section>

        {data.notes && (
          <section className="mb-6">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-600">
              Mentions particulières
            </h3>
            <p className="text-sm italic text-zinc-700">{data.notes}</p>
          </section>
        )}

        <section className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-zinc-500">Pour le loueur</p>
            <p className="mt-1 text-sm text-zinc-700">Harmonie Yacht</p>
            <div className="mt-2 h-20 rounded border border-dashed border-zinc-300" />
            <p className="mt-1 text-[11px] text-zinc-500">Signature et cachet</p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-500">Pour le locataire</p>
            <p className="mt-1 text-sm text-zinc-700">
              {client} — <span className="italic">« Lu et approuvé »</span>
            </p>
            <div
              className={
                "mt-2 h-20 rounded border border-dashed " +
                (isSigned
                  ? "border-emerald-400 bg-emerald-50/60"
                  : "border-zinc-300")
              }
            >
              {isSigned && (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <p className="font-script text-lg italic text-emerald-800">
                      {data.contract_signed_by_name}
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      Signé le {signedAt}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Signature précédée de la mention « Lu et approuvé »
            </p>
          </div>
        </section>

        <footer className="mt-10 border-t border-zinc-200 pt-4 text-center text-[11px] text-zinc-500">
          Harmonie Yacht — Location de yacht privatif au départ de Carnon —
          harmonie-yacht.fr
        </footer>
      </main>
    </div>
  );
}
