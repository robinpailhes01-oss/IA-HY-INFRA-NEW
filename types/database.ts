// Placeholder — régénéré au Sprint 1 via :
//   npx supabase gen types typescript --project-id szdfpjyytwedhochvzfd > types/database.ts
// Tant que le schéma n'existe pas, on expose un type vide pour que les clients compilent.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
