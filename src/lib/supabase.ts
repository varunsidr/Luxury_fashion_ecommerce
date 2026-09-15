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

// Helper: try to find a product by id or slug with fallbacks for local seed data
export async function findProductByIdOrSlug(value: string) {
  const normalized = String(value ?? "").toLowerCase().trim();
  

  // Quick numeric ID mapping for local seed data like `1`, `2` => map to localProducts[0], localProducts[1]
  try {
    if (/^\d+$/.test(normalized)) {
      const idx = Math.max(0, parseInt(normalized, 10) - 1);
      const maybe = (localProducts as any[])[idx];
      if (maybe) return maybe;
    }
  } catch (e) {}

  // 1) Try id exact match
  try {
    const byId = await supabase.from("products").select("*").eq("id", normalized).single();
    if (byId && (byId as any).data) return (byId as any).data;
  } catch (e) {
    // ignore
  }

  // 2) Try slug exact match
  try {
    const bySlug = await supabase.from("products").select("*").eq("slug", normalized).single();
    if (bySlug && (bySlug as any).data) return (bySlug as any).data;
  } catch (e) {
    // ignore
  }

  // 3) Fallback: fetch list and search (useful for localProducts where id may be "1", "2" strings)
  try {
    // If Supabase isn't configured, use the localProducts array directly to avoid query nuances
    if (!isSupabaseConfigured) {
      const lp = localProducts as any[];
      const foundLocal = lp.find((p) => String(p.id).toLowerCase() === normalized || String((p.slug ?? "")).toLowerCase() === normalized);
      return foundLocal ?? null;
    }

    const listResp: any = await supabase.from("products").select("*");
    const all = (listResp && listResp.data) || (listResp && listResp instanceof Array ? listResp : []);
    const found = (all as any[]).find((p) => String(p.id).toLowerCase() === normalized || String(p.slug ?? "").toLowerCase() === normalized);
    return found ?? null;
  } catch (e) {
    return null;
  }
}
