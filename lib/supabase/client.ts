import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  // Mode démo local uniquement — voir lib/demo/mode.ts. La condition est
  // écrite en toutes lettres (et non importée) pour que le compilateur la
  // réduise à `false` en production et retire le faux client — et ses
  // données fictives — du bundle navigateur.
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_HY_DEMO === "1") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMockClient } = require("@/lib/demo/mock-client");
    return createMockClient() as ReturnType<typeof createBrowserClient<Database>>;
  }

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
