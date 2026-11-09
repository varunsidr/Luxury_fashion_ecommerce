import { cache } from "react";
import { lookupProduct } from "@/lib/productLookup";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

type LocalRow = Record<string, unknown>;

interface LocalQuery {
  abortSignal(signal: AbortSignal): LocalQuery;
  select(): LocalQuery;
  eq(field: string, value: unknown): LocalQuery;
  neq(field: string, value: unknown): LocalQuery;
  limit(count: number): LocalQuery;
  ilike(field: string, pattern: string): LocalQuery;
  or(expression: string): LocalQuery;
  order(field: string, options?: unknown): LocalQuery;
  single(): Promise<{ data: LocalRow | null; error: null }>;
  then(resolve: (value: { data: LocalRow[]; error: null }) => unknown, reject?: (reason?: unknown) => unknown): Promise<unknown>;
}

function createLocalQuery(table: string) {
  let rows: LocalRow[] = table === "products" ? localProducts.map((product) => ({ ...product }))
    : table === "product_size_stock" ? localProducts.flatMap((product) => (product.size_stock ?? []).map((row) => ({ ...row, product_id: product.id }))) : [];

  const query: LocalQuery = {
    abortSignal() { return query; },
    select() {
      return query;
    },
    eq(field: string, value: unknown) {
      rows = rows.filter((row) => String((row as Record<string, unknown>)[field] ?? "") === String(value));
      return query;
    },
    neq(field: string, value: unknown) {
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
    order(field: string) {
      rows = [...rows].sort((a, b) => String((a as Record<string, unknown>)[field] ?? "").localeCompare(String((b as Record<string, unknown>)[field] ?? "")));
      return query;
    },
    single() {
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    },
    then(resolve: (value: { data: LocalRow[]; error: null }) => unknown, reject?: (reason?: unknown) => unknown) {
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
  };

  return query;
}

const localSupabase = {
  auth: {
    async getSession() {
      return { data: { session: null } };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signInWithPassword() {
      return { error: CONFIG_ERROR };
    },
    async signUp() {
      return { error: CONFIG_ERROR };
    },
    async resetPasswordForEmail() {
      return { data: {}, error: CONFIG_ERROR };
    },
    async getUser() {
      return { data: { user: null }, error: CONFIG_ERROR };
    },
    async signOut() {
      return { error: null };
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
  : (localSupabase as unknown as SupabaseClient);

// Metadata and page share one bounded lookup per server render.
export const findProductByIdOrSlug = cache((value: string, category?: string) =>
  lookupProduct(value, category, { configured: isSupabaseConfigured, client: supabase, local: localProducts }));
