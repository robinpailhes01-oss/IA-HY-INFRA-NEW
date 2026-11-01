/* eslint-disable @typescript-eslint/no-explicit-any */
// Faux client Supabase pour le mode démo (voir lib/demo/mode.ts).
//
// Reproduit la surface utilisée par l'application : from().select() avec
// filtres (eq, neq, gt, gte, lt, lte, in, is, not, like, ilike), order, limit,
// range, single, maybeSingle, count/head — sur des tableaux en mémoire.
// Les écritures (insert, update, upsert, delete) réussissent sans rien
// modifier. Toute méthode inconnue est absorbée (renvoie le même builder) :
// une page ne doit jamais planter en démo parce qu'un filtre n'est pas simulé.

import { getFixtures } from "@/lib/demo/fixtures";

type Row = Record<string, any>;
type Filter = (r: Row) => boolean;

export const DEMO_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "robin@harmonie-yacht.fr",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: { first_name: "Robin" },
  created_at: "2025-01-01T00:00:00Z",
};

function get(r: Row, path: string): any {
  if (!path.includes(".")) return r[path];
  return path.split(".").reduce((acc: any, k) => (acc == null ? acc : acc[k]), r);
}

function cmp(a: any, b: any): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : 1;
}

function likeToRegex(pattern: string, insensitive: boolean) {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${esc}$`, insensitive ? "i" : "");
}

function parseInList(v: string): string[] {
  return v.replace(/^\(|\)$/g, "").split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
}

function opFilter(col: string, op: string, value: any): Filter {
  switch (op) {
    case "eq":
      return (r) => get(r, col) == value;
    case "neq":
      return (r) => get(r, col) != value;
    case "gt":
      return (r) => get(r, col) != null && cmp(get(r, col), value) > 0;
    case "gte":
      return (r) => get(r, col) != null && cmp(get(r, col), value) >= 0;
    case "lt":
      return (r) => get(r, col) != null && cmp(get(r, col), value) < 0;
    case "lte":
      return (r) => get(r, col) != null && cmp(get(r, col), value) <= 0;
    case "in": {
      const list = Array.isArray(value) ? value : parseInList(String(value));
      return (r) => list.some((v) => v == get(r, col));
    }
    case "is":
      return (r) => (value === null || value === "null" ? get(r, col) == null : get(r, col) === value);
    case "like":
      return (r) => likeToRegex(String(value), false).test(String(get(r, col) ?? ""));
    case "ilike":
      return (r) => likeToRegex(String(value), true).test(String(get(r, col) ?? ""));
    default:
      return () => true;
  }
}

class Query {
  private filters: Filter[] = [];
  private orders: Array<{ col: string; asc: boolean; nullsFirst?: boolean }> = [];
  private lim: number | null = null;
  private offset = 0;
  private head = false;
  private wantCount = false;
  private mode: "many" | "single" | "maybe" = "many";
  private mutation: "insert" | "update" | "upsert" | "delete" | null = null;
  private payload: any = null;

  constructor(private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.head) this.head = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }
  insert(values: any) { this.mutation = "insert"; this.payload = values; return this; }
  upsert(values: any) { this.mutation = "upsert"; this.payload = values; return this; }
  update(values: any) { this.mutation = "update"; this.payload = values; return this; }
  delete() { this.mutation = "delete"; return this; }

  eq(c: string, v: any) { this.filters.push(opFilter(c, "eq", v)); return this; }
  neq(c: string, v: any) { this.filters.push(opFilter(c, "neq", v)); return this; }
  gt(c: string, v: any) { this.filters.push(opFilter(c, "gt", v)); return this; }
  gte(c: string, v: any) { this.filters.push(opFilter(c, "gte", v)); return this; }
  lt(c: string, v: any) { this.filters.push(opFilter(c, "lt", v)); return this; }
  lte(c: string, v: any) { this.filters.push(opFilter(c, "lte", v)); return this; }
  in(c: string, v: any[]) { this.filters.push(opFilter(c, "in", v)); return this; }
  is(c: string, v: any) { this.filters.push(opFilter(c, "is", v)); return this; }
  like(c: string, v: string) { this.filters.push(opFilter(c, "like", v)); return this; }
  ilike(c: string, v: string) { this.filters.push(opFilter(c, "ilike", v)); return this; }
  not(c: string, op: string, v: any) {
    const f = opFilter(c, op, v);
    this.filters.push((r) => !f(r));
    return this;
  }
  filter(c: string, op: string, v: any) { this.filters.push(opFilter(c, op, v)); return this; }
  match(obj: Row) {
    for (const [k, v] of Object.entries(obj)) this.filters.push(opFilter(k, "eq", v));
    return this;
  }
  or() { return this; } // trop varié pour être simulé : on ne filtre pas
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst });
    return this;
  }
  limit(n: number) { this.lim = n; return this; }
  range(from: number, to: number) { this.offset = from; this.lim = to - from + 1; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  returns() { return this; }
  abortSignal() { return this; }

  private run(): { data: any; error: any; count: number | null; status: number; statusText: string } {
    const ok = (data: any, count: number | null = null) => ({ data, error: null, count, status: 200, statusText: "OK" });

    if (this.mutation) {
      if (this.mutation === "delete") return ok(null);
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => ({
        id: r?.id ?? `demo-${Math.random().toString(36).slice(2, 10)}`,
        created_at: new Date().toISOString(),
        ...r,
      }));
      return ok(this.mode === "many" ? rows : rows[0] ?? null);
    }

    let rows = (getFixtures()[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
    for (const o of [...this.orders].reverse()) {
      rows = [...rows].sort((a, b) => {
        const va = get(a, o.col);
        const vb = get(b, o.col);
        if (va == null || vb == null) {
          if (va == null && vb == null) return 0;
          const nullsFirst = o.nullsFirst ?? !o.asc;
          return (va == null ? -1 : 1) * (nullsFirst ? 1 : -1);
        }
        return o.asc ? cmp(va, vb) : -cmp(va, vb);
      });
    }
    const count = rows.length;
    if (this.offset) rows = rows.slice(this.offset);
    if (this.lim != null) rows = rows.slice(0, this.lim);

    if (this.head) return ok(null, count);
    if (this.mode === "single") return rows[0] ? ok(rows[0], 1) : { data: null, error: { message: "not found", code: "PGRST116" }, count: 0, status: 406, statusText: "Not Acceptable" };
    if (this.mode === "maybe") return ok(rows[0] ?? null, rows.length ? 1 : 0);
    return ok(rows, this.wantCount ? count : null);
  }

  then<T1 = any, T2 = never>(
    onfulfilled?: ((value: any) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null,
  ): Promise<T1 | T2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

/** Toute méthode non simulée renvoie le builder lui-même. */
function absorb<T extends object>(target: T): T {
  const proxy: T = new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop in obj) {
        const v = Reflect.get(obj, prop, receiver);
        return typeof v === "function"
          ? (...args: any[]) => {
              const out = v.apply(obj, args);
              return out === obj ? proxy : out;
            }
          : v;
      }
      if (typeof prop === "symbol") return undefined;
      return () => proxy;
    },
  });
  return proxy;
}

export function createMockClient(): any {
  return {
    from: (table: string) => absorb(new Query(table)),
    rpc: async () => ({ data: [], error: null }),
    auth: {
      getUser: async () => ({ data: { user: DEMO_USER }, error: null }),
      getSession: async () => ({ data: { session: { user: DEMO_USER } }, error: null }),
      signInWithPassword: async () => ({ data: { user: DEMO_USER, session: {} }, error: null }),
      signUp: async () => ({ data: { user: DEMO_USER, session: {} }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: "demo" }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        createSignedUrl: async () => ({ data: { signedUrl: "" }, error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
    functions: {
      invoke: async () => ({ data: null, error: null }),
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }),
    removeChannel: () => {},
  };
}
