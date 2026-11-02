/**
 * PostgREST plafonne une réponse à 1 000 lignes (réglage Supabase par défaut).
 * Les messages d'un mois d'été, le journal des crédits IA ou les revenus de
 * plusieurs saisons dépassent ce plafond : on pagine, sinon les compteurs
 * s'arrêteraient silencieusement à 1 000.
 *
 * `page(from, to)` construit la requête pour une tranche (avec .range()) ;
 * elle doit être triée de façon stable pour que les pages ne se chevauchent pas.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
  maxPages = 25,
): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; p < maxPages; p++) {
    const { data, error } = await page(p * pageSize, (p + 1) * pageSize - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}
