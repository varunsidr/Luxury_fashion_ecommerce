import { createClient } from "@supabase/supabase-js";
import { localProducts } from "@/lib/localProducts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("your-project") &&
  supabaseUrl.includes("supabase.co") &&
  !supabaseAnonKey.toLowerCase().includes("dummy") &&
  !supabaseAnonKey.toLowerCase().includes("your-anon-key")
);

export const CONFIG_ERROR = {
  message:
    "Supabase is not configured — set a real NEXT_PUBLIC_SUPABASE_ANON_KEY (and URL) in .env.local. Sign in/register only work against a real Supabase project.",
};

function createLocalQuery(table: string) {
  let rows: any[] = table === "products" ? [...localProducts] : [];

  const query: any = {
    select() {
      return query;
    },
    eq(field: string, value: any) {
      rows = rows.filter((row) => String((row as Record<string, unknown>)[field] ?? "") === String(value));
      return query;
    },
    neq(field: string, value: any) {
      rows = rows.filter((row) => String((row as Record<string, unknown>)[field] ?? "") !== String(value));
      return query;
    },
    limit(count: number) {
      rows = rows.slice(0, count);
      return query;
    },
    ilike(field: string, pattern: string) {
      const needle = pattern.replace(/%/g, "").toLowerCase();
      rows = rows.filter((row) => String((row as Record<string, unknown>)[field] ?? "").toLowerCase().includes(needle));
      return query;
    },
    or(expression: string) {
      const terms = expression.match(/name\.ilike\.%([^,]+)%|category\.ilike\.%([^,]+)%/gi) ?? [];
      const needles = terms
        .map((term) => term.match(/%([^%]+)%/)?.[1]?.toLowerCase())
        .filter((value): value is string => Boolean(value));
      rows = rows.filter((row) =>
        needles.some((needle) => String(row.name ?? "").toLowerCase().includes(needle) || String(row.category ?? "").toLowerCase().includes(needle))
      );
      return query;
    },
    order(field: string, _opts?: any) {
      rows = [...rows].sort((a, b) => String((a as Record<string, unknown>)[field] ?? "").localeCompare(String((b as Record<string, unknown>)[field] ?? "")));
      return query;
    },
    single() {
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    },
    then(resolve: (value: { data: any[]; error: null }) => any, reject?: (reason?: unknown) => any) {
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
  };

  return query;
}

const localSupabase = {
  auth: {
    async getSession() {
      return { data: { session: null as any } };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } as any } };
    },
    async signInWithPassword() {
      return { error: CONFIG_ERROR as any };
    },
    async signUp() {
      return { error: CONFIG_ERROR as any };
    },
    async signOut() {
      return { error: null as any };
    },
  },
  from(table: string) {
    return createLocalQuery(table);
  },
  storage: {
    from() {
      return {
        upload: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      };
    },
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (localSupabase as any);
