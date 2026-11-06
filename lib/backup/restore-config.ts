/** Tables que les triggers de la base remplissent déjà à l'insertion d'autres tables :
 *  on les vide juste avant d'importer les originales, sinon doublons ou conflits. */
export const CLEAR_BEFORE = new Set(["revenues", "accounting_entries", "accounting_rules"]);

/** Taille maximale d'un lot envoyé au serveur (octets de JSON) et nombre de lignes. */
export const CHUNK_BYTES = 2_500_000;
export const CHUNK_ROWS = 300;

/** Au-delà, un fichier part directement du navigateur (limite de requête de Vercel). */
export const SERVER_FILE_LIMIT = 4_000_000;
