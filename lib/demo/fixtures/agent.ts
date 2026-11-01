/* eslint-disable @typescript-eslint/no-explicit-any */
// Fixtures complémentaires du mode démo — espace « agent ».
// Ajoute ici les tables propres à cet espace (elles s'AJOUTENT aux lignes de
// core.ts pour une table déjà définie). Outils : `demo` dans ./core.
type Row = Record<string, any>;

export const agentFixtures: Record<string, Row[]> = {};
