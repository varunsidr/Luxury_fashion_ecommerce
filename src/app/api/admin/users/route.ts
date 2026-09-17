import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "@/lib/adminAuth";

function isAdmin(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("admin_token="))
    ?.split("=")[1];
  return token ? verifyToken(token) : null;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return NextResponse.json({ error: "missing Supabase configuration" }, { status: 500 });

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}
