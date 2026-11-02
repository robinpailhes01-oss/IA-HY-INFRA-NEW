/**
 * PostgREST plafonne une réponse à 1 000 lignes (réglage Supabase par défaut).
 * Les revenus de plusieurs saisons, les leads ou l'audience du site jour par
 * jour et par source dépassent vite ce plafond : on pagine, sinon les
 * compteurs s'arrêteraient silencieusement à 1 000.
 *
 * `page(from, to)` construit la requête pour une tranche (avec .range()) ;
 * elle doit être triée de façon stable pour que les pages ne se chevauchent
 * pas. Renvoie `ok: false` si la première page échoue (table ou vue absente) :
 * la page affiche alors un état vide plutôt que des zéros trompeurs.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
  maxPages = 25,
): Promise<{ rows: T[]; ok: boolean }> {
  const rows: T[] = [];
  for (let p = 0; p < maxPages; p++) {
    const { data, error } = await page(p * pageSize, (p + 1) * pageSize - 1);
    if (error || !data) return { rows, ok: p > 0 };
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return { rows, ok: true };
}
