// Outils financiers du Manager — la spécialité « gestion de l'argent ».
//
// Séparés de manager-agent.ts pour que le cerveau financier vive dans un seul
// fichier : c'est ici qu'on ajoute un outil quand il manque un chiffre.
//
// Principe qui gouverne tout ce module, hérité de l'écart de 12 800 € entre le
// dashboard et le compte réel :
//
//   Qonto porte la TRÉSORERIE. SumUp, Stripe et les espèces portent le DÉTAIL
//   du chiffre d'affaires. Un virement SumUp/Stripe vers Qonto, comme un dépôt
//   d'espèces, est un TRANSFERT — jamais du chiffre d'affaires.
//
// Le score financier n'est PAS recalculé ici : sa formule appartient à la
// fonction finance-pulse, qui l'archive dans financial_snapshots. Ces outils
// lisent ce qu'elle a produit. Une seule formule, un seul propriétaire.

// deno-lint-ignore-file no-explicit-any
type SupabaseClient = any;

const EXPENSE_CATEGORIES = [
  "subscription",
  "marketing",
  "fuel",
  "maintenance",
  "tools",
  "subcontract",
  "fixed_monthly",
  "salary",
  "taxes",
  "savings",
  "other",
];

export const FINANCE_TOOLS = [
  {
    name: "get_financial_status",
    description:
      "Donne la situation financière réelle : trésorerie (banque + caisse espèces), dernier score de santé financière archivé, autonomie en mois, et l'état des sources de données connectées. Utilise pour toute question du type 'où j'en suis', 'combien il me reste vraiment', 'ma trésorerie', 'mon score', 'est-ce que ça va mieux'. Indique TOUJOURS à Robin quelles sources ne sont pas connectées, car les chiffres sont incomplets tant qu'elles manquent.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "record_cash_movement",
    description:
      "Enregistre un mouvement d'ESPÈCES (le seul flux que le système ne peut pas récupérer automatiquement). Trois cas : direction='in' pour un encaissement client en liquide (crée aussi la ligne de chiffre d'affaires), direction='out' pour une dépense payée en liquide (crée aussi la dépense), direction='deposit' quand Robin dépose ses espèces à la banque. ⚠️ Un dépôt n'est JAMAIS du chiffre d'affaires : c'est de l'argent qui change de poche, il apparaîtra aussi en crédit sur Qonto. Utilise dès que Robin dit 'j'ai encaissé X en espèces', 'j'ai payé X en liquide', 'j'ai déposé X à la banque'.",
    input_schema: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["in", "out", "deposit"],
          description: "in=encaissement client en espèces, out=dépense payée en espèces, deposit=dépôt des espèces en banque",
        },
        amount: { type: "number", description: "Montant en euros (toujours positif)" },
        date: { type: "string", description: "Date YYYY-MM-DD (défaut : aujourd'hui)" },
        description: { type: "string", description: "Détail (ex. 'solde sortie famille Martin', 'gasoil')" },
        category: {
          type: "string",
          enum: EXPENSE_CATEGORIES,
          description: "Obligatoire seulement si direction='out' : catégorie de la dépense",
        },
        revenue_type: {
          type: "string",
          enum: ["sea_trip", "unusual_night", "efoil", "other"],
          description: "Seulement si direction='in' : nature de la prestation encaissée",
        },
      },
      required: ["direction", "amount"],
    },
  },
  {
    name: "list_cash_movements",
    description:
      "Liste les mouvements d'espèces sur une période et donne le solde actuel de la caisse. Utilise pour 'combien j'ai en liquide', 'mes mouvements en espèces', ou pour retrouver l'id d'un mouvement saisi par erreur.",
    input_schema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "Date de début YYYY-MM-DD (défaut : il y a 30 jours)" },
        to_date: { type: "string", description: "Date de fin YYYY-MM-DD (défaut : aujourd'hui)" },
      },
    },
  },
  {
    name: "get_revenue_by_channel",
    description:
      "Répartit le chiffre d'affaires encaissé par canal de paiement sur une période : en ligne (Stripe), terminal carte (SumUp), espèces, virement, partenaire. Donne aussi les commissions prélevées quand elles sont connues. Utilise pour 'comment mes clients paient', 'combien en espèces', 'combien me coûtent les commissions', 'quel canal rapporte le plus'.",
    input_schema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "Date de début YYYY-MM-DD (défaut : début de l'année)" },
        to_date: { type: "string", description: "Date de fin YYYY-MM-DD (défaut : aujourd'hui)" },
      },
    },
  },
  {
    name: "get_data_gaps_report",
    description:
      "Rapport d'audit des trous dans les données financières : quelles sources sont connectées, combien d'argent est encaissé sans qu'on sache comment, et où se cachent les montants non tracés. Utilise quand Robin demande 'qu'est-ce qui manque', 'pourquoi les chiffres ne collent pas', 'd'où vient l'écart', ou avant de lui donner une analyse financière importante — pour savoir sur quoi tu peux t'engager et sur quoi tu dois rester prudent.",
    input_schema: { type: "object", properties: {} },
  },
];

const eur = (n: number) => Math.round(n * 100) / 100;

function defaultRange(input: Record<string, unknown>, fallbackFrom: string) {
  const to = input.to_date ? String(input.to_date) : new Date().toISOString().slice(0, 10);
  const from = input.from_date ? String(input.from_date) : fallbackFrom;
  return { from, to };
}

// Renvoie null si l'outil n'appartient pas à ce module — le dispatcher appelant
// poursuit alors sa propre chaîne.
export async function runFinanceTool(
  supabase: SupabaseClient,
  name: string,
  input: Record<string, unknown>,
): Promise<string | null> {
  // ── Situation financière ──────────────────────────────────────────────────
  if (name === "get_financial_status") {
    const [accountsRes, cashRes, snapRes, prevSnapRes, sumupRes] = await Promise.all([
      supabase.from("bank_accounts").select("name, balance_cents, balance_updated_at").neq("status", "closed"),
      supabase.from("cash_balance").select("balance, last_movement_date").maybeSingle(),
      supabase
        .from("financial_snapshots")
        .select("date, score, score_label, treasury, monthly_burn, runway_months, outstanding, revenue_30d, expenses_30d, details")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("financial_snapshots")
        .select("date, score, treasury")
        .order("date", { ascending: false })
        .range(1, 1)
        .maybeSingle(),
      supabase.from("sumup_transactions").select("id", { count: "exact", head: true }),
    ]);

    const accounts = accountsRes.data ?? [];
    const bankConnected = accounts.length > 0;
    const bankBalance = accounts.reduce((s: number, a: any) => s + (a.balance_cents ?? 0), 0) / 100;
    const cashBalance = Number(cashRes.data?.balance ?? 0);
    const snap = snapRes.data;

    // Les sources manquantes sont une information de premier plan : sans elles
    // tout chiffre donné à Robin est partiel, et il doit le savoir.
    const sourcesManquantes: string[] = [];
    if (!bankConnected) sourcesManquantes.push("Qonto (trésorerie réelle) — secret QONTO_API_KEY absent");
    if ((sumupRes.count ?? 0) === 0) {
      sourcesManquantes.push("SumUp (paiements par carte sur place) — secrets SUMUP_API_KEY / SUMUP_MERCHANT_CODE absents");
    }
    if ((cashRes.data?.last_movement_date ?? null) === null) {
      sourcesManquantes.push("Espèces — aucun mouvement saisi pour l'instant");
    }

    return JSON.stringify({
      tresorerie_reelle_eur: bankConnected ? eur(bankBalance + cashBalance) : null,
      solde_banque_eur: bankConnected ? eur(bankBalance) : null,
      solde_caisse_especes_eur: eur(cashBalance),
      comptes_bancaires: accounts.map((a: any) => ({ nom: a.name, solde_eur: eur((a.balance_cents ?? 0) / 100), maj: a.balance_updated_at })),
      score: snap?.score ?? null,
      score_label: snap?.score_label ?? null,
      score_date: snap?.date ?? null,
      score_precedent: prevSnapRes.data?.score ?? null,
      autonomie_mois: snap?.runway_months ?? null,
      charges_mensuelles_eur: snap?.monthly_burn ?? null,
      ca_30j_eur: snap?.revenue_30d ?? null,
      charges_30j_eur: snap?.expenses_30d ?? null,
      reste_a_encaisser_eur: snap?.outstanding ?? null,
      sources_manquantes: sourcesManquantes,
      fiabilite: sourcesManquantes.length === 0
        ? "complete"
        : "partielle — annonce clairement à Robin que ces chiffres sont incomplets tant que les sources manquantes ne sont pas branchées",
    });
  }

  // ── Saisie des espèces ────────────────────────────────────────────────────
  if (name === "record_cash_movement") {
    const direction = String(input.direction ?? "");
    const amount = Number(input.amount ?? 0);
    const date = input.date ? String(input.date) : new Date().toISOString().slice(0, 10);
    const description = input.description ? String(input.description) : null;

    if (!["in", "out", "deposit"].includes(direction)) {
      return JSON.stringify({ ok: false, error: "direction doit valoir 'in', 'out' ou 'deposit'" });
    }
    if (!(amount > 0)) {
      return JSON.stringify({ ok: false, error: "montant invalide (doit être strictement positif)" });
    }
    if (direction === "out" && !input.category) {
      return JSON.stringify({ ok: false, error: "category est obligatoire pour une dépense en espèces" });
    }

    // On crée d'abord la ligne comptable (revenues ou expenses) pour pouvoir la
    // rattacher au mouvement de caisse : la comptabilité reste la référence, la
    // caisse ne suit que le solde du liquide.
    let revenueId: string | null = null;
    let expenseId: string | null = null;

    if (direction === "in") {
      const { data, error } = await supabase
        .from("revenues")
        .insert({
          date,
          amount,
          type: input.revenue_type ? String(input.revenue_type) : "other",
          note: description ? `Espèces — ${description}` : "Encaissement en espèces",
        })
        .select("id")
        .single();
      if (error) return JSON.stringify({ ok: false, error: `création du revenu impossible : ${error.message}` });
      revenueId = data.id;
    }

    if (direction === "out") {
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          date,
          amount,
          category: String(input.category),
          description: description ? `Espèces — ${description}` : "Dépense en espèces",
        })
        .select("id")
        .single();
      if (error) return JSON.stringify({ ok: false, error: `création de la dépense impossible : ${error.message}` });
      expenseId = data.id;
    }

    const { data: movement, error: moveError } = await supabase
      .from("cash_movements")
      .insert({ date, direction, amount, category: input.category ? String(input.category) : null, description, revenue_id: revenueId, expense_id: expenseId })
      .select("id")
      .single();

    if (moveError) {
      // La ligne comptable est déjà créée : on la retire pour ne pas laisser un
      // revenu ou une dépense orphelin que Robin ne verrait jamais en caisse.
      if (revenueId) await supabase.from("revenues").delete().eq("id", revenueId);
      if (expenseId) await supabase.from("expenses").delete().eq("id", expenseId);
      return JSON.stringify({ ok: false, error: `enregistrement du mouvement impossible : ${moveError.message}` });
    }

    const { data: balance } = await supabase.from("cash_balance").select("balance").maybeSingle();

    return JSON.stringify({
      ok: true,
      mouvement_id: movement.id,
      direction,
      montant_eur: eur(amount),
      date,
      nouveau_solde_caisse_eur: eur(Number(balance?.balance ?? 0)),
      note: direction === "deposit"
        ? "Dépôt enregistré : la caisse diminue, ce n'est PAS du chiffre d'affaires (l'argent réapparaîtra en crédit sur Qonto)."
        : direction === "in"
          ? "Encaissement enregistré en caisse ET en chiffre d'affaires."
          : "Dépense enregistrée en caisse ET en charges.",
    });
  }

  if (name === "list_cash_movements") {
    const { from, to } = defaultRange(input, new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
    const [movesRes, balanceRes] = await Promise.all([
      supabase
        .from("cash_movements")
        .select("id, date, direction, amount, category, description")
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: false })
        .limit(50),
      supabase.from("cash_balance").select("balance, last_movement_date").maybeSingle(),
    ]);

    const moves = movesRes.data ?? [];
    const sum = (d: string) =>
      eur(moves.filter((m: any) => m.direction === d).reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0));

    return JSON.stringify({
      periode: `du ${from} au ${to}`,
      solde_caisse_actuel_eur: eur(Number(balanceRes.data?.balance ?? 0)),
      dernier_mouvement: balanceRes.data?.last_movement_date ?? null,
      encaissements_eur: sum("in"),
      depenses_eur: sum("out"),
      depots_en_banque_eur: sum("deposit"),
      mouvements: moves,
    });
  }

  // ── Répartition du CA par canal ───────────────────────────────────────────
  if (name === "get_revenue_by_channel") {
    const year = new Date().getFullYear();
    const { from, to } = defaultRange(input, `${year}-01-01`);

    const [revenuesRes, bookingsRes, sumupRes, cashRes] = await Promise.all([
      supabase.from("revenues").select("amount, date").gte("date", from).lte("date", to),
      supabase
        .from("bookings")
        .select("payment_method, total_amount, deposit_amount, balance_due, date, status")
        .gte("date", from)
        .lte("date", to)
        .neq("status", "cancelled"),
      supabase
        .from("sumup_transactions")
        .select("amount, fee_amount, status, type")
        .gte("occurred_at", `${from}T00:00:00Z`)
        .lte("occurred_at", `${to}T23:59:59Z`),
      supabase.from("cash_movements").select("amount, direction").eq("direction", "in").gte("date", from).lte("date", to),
    ]);

    const caTotal = eur((revenuesRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0));

    const sumupRows = (sumupRes.data ?? []).filter((t: any) => t.status === "SUCCESSFUL" && t.type === "PAYMENT");
    const sumupTotal = eur(sumupRows.reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0));
    const sumupFees = eur(sumupRows.reduce((s: number, t: any) => s + Number(t.fee_amount ?? 0), 0));

    const cashTotal = eur((cashRes.data ?? []).reduce((s: number, m: any) => s + Number(m.amount ?? 0), 0));

    // Par mode de paiement déclaré sur la réservation — vision « intention »,
    // moins fiable que les flux réels ci-dessus mais elle couvre l'historique.
    const parMethode: Record<string, number> = {};
    for (const b of bookingsRes.data ?? []) {
      const key = b.payment_method ?? "non_renseigne";
      parMethode[key] = eur((parMethode[key] ?? 0) + Number(b.deposit_amount ?? 0));
    }

    return JSON.stringify({
      periode: `du ${from} au ${to}`,
      ca_total_encaisse_eur: caTotal,
      canaux_reels: {
        sumup_terminal_eur: sumupTotal,
        sumup_commissions_eur: sumupFees,
        especes_eur: cashTotal,
      },
      acomptes_par_mode_declare: parMethode,
      avertissement: sumupRows.length === 0
        ? "SumUp n'est pas connecté : les encaissements par carte sur place n'apparaissent pas dans cette répartition."
        : null,
    });
  }

  // ── Audit des trous ───────────────────────────────────────────────────────
  if (name === "get_data_gaps_report") {
    const [bankRes, sumupRes, cashRes, bookingsRes, expensesRes] = await Promise.all([
      supabase.from("bank_accounts").select("id", { count: "exact", head: true }),
      supabase.from("sumup_transactions").select("id", { count: "exact", head: true }),
      supabase.from("cash_movements").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("total_amount, deposit_amount, balance_due, payment_method, status").neq("status", "cancelled"),
      supabase.from("expenses").select("amount, category, date"),
    ]);

    const bookings = bookingsRes.data ?? [];
    // Argent effectivement perçu hors acompte en ligne : total − acompte − ce
    // qui reste dû. C'est de l'argent réellement encaissé dont le système ne
    // sait pas par quel canal il est passé.
    const soldesReglesHorsLigne = eur(
      bookings.reduce(
        (s: number, b: any) =>
          s + (Number(b.total_amount ?? 0) - Number(b.deposit_amount ?? 0) - Number(b.balance_due ?? 0)),
        0,
      ),
    );
    const acomptes = eur(bookings.reduce((s: number, b: any) => s + Number(b.deposit_amount ?? 0), 0));
    const resteDu = eur(bookings.reduce((s: number, b: any) => s + Number(b.balance_due ?? 0), 0));

    const expenses = expensesRes.data ?? [];
    const parCategorie: Record<string, number> = {};
    for (const e of expenses) {
      const key = e.category ?? "non_categorise";
      parCategorie[key] = eur((parCategorie[key] ?? 0) + Number(e.amount ?? 0));
    }

    const sourcesConnectees = {
      qonto_tresorerie: (bankRes.count ?? 0) > 0,
      sumup_terminal: (sumupRes.count ?? 0) > 0,
      especes: (cashRes.count ?? 0) > 0,
      stripe_en_ligne: true,
    };

    return JSON.stringify({
      sources_connectees: sourcesConnectees,
      acomptes_encaisses_en_ligne_eur: acomptes,
      soldes_regles_hors_ligne_eur: soldesReglesHorsLigne,
      reste_a_encaisser_eur: resteDu,
      explication_soldes:
        "Ces soldes ont bien été perçus et comptés dans le chiffre d'affaires, mais le système ne sait pas PAR QUEL MOYEN (carte sur place, espèces, virement). Connecter SumUp et saisir les espèces répond à cette question.",
      charges_par_categorie_eur: parCategorie,
      charges_totales_saisies_eur: eur(expenses.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0)),
      avertissement_charges: sourcesConnectees.qonto_tresorerie
        ? null
        : "Les charges ci-dessus ne viennent que de la saisie manuelle. Tant que Qonto n'est pas connecté, les sorties d'argent réelles (prélèvements, charges sociales, taxes) restent invisibles — c'est l'origine de l'écart constaté entre le résultat affiché et le solde bancaire.",
    });
  }

  return null;
}
