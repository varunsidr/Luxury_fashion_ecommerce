import { test, expect } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverRestockBatch } from "../src/lib/restockDelivery";
import { POST as notify } from "../src/app/api/admin/restock-alerts/notify/route";
import { POST as scheduled } from "../src/app/api/internal/restock-alerts/route";
import { signToken } from "../src/lib/adminAuth";

const config = { key: "fictional-resend-key", from: "fixture@example.invalid", siteUrl: "https://store.example.invalid" };
const notification = { id: "fixture-request",product_id: "fixture-product",email: "fictional@example.invalid",size: "S",color: "Brown",
  unsubscribe_token: "a".repeat(64),claim_token: "lease-1",product_name: "<Dress & Shirt>",category: "Women's Dress" };
type RpcHandler = (name: string, args: Record<string,unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const client = (handler: RpcHandler) => ({ rpc: handler as unknown as SupabaseClient["rpc"] });

test("retry worker freezes payload and idempotency key across provider timeout, changed metadata and success", async () => {
  let stored: unknown = null;
  let current = { ...notification };
  const completions: Record<string,unknown>[] = [];
  const admin = client(async (name,args) => {
    if (name === "claim_restock_notifications") return { data: [current],error: null };
    if (name === "prepare_restock_delivery") { stored ??= args.p_payload; return { data: stored,error: null }; }
    completions.push(args); return { data: true,error: null };
  });
  const calls: RequestInit[] = [];
  const send: typeof fetch = async (url,options) => {
    expect(url).toBe("https://api.resend.com/emails"); calls.push(options!);
    if (calls.length === 1) throw new Error("Uncertain fixture response");
    return new Response('{}',{ status: 200 });
  };
  expect(await deliverRestockBatch(admin,config,null,send)).toMatchObject({ sent: 0,failed: 1 });
  current = { ...notification,product_name: "Changed product" };
  expect(await deliverRestockBatch(admin,{ ...config,from: "changed@example.invalid" },null,send)).toMatchObject({ sent: 1,failed: 0 });
  expect(calls[0].body).toBe(calls[1].body);
  expect(new Headers(calls[0].headers).get("Idempotency-Key")).toBe("restock/fixture-request");
  expect(calls[0].body).toContain("&lt;Dress &amp; Shirt&gt;");
  expect(completions.map(args => [args.p_success,args.p_retryable])).toEqual([[false,true],[true,false]]);
});

test("provider failures are isolated per alert and transient failures retry while permanent errors park", async () => {
  const completions: Record<string,unknown>[] = [];
  const codes = [429,503,422,409,200];
  const admin = client(async (name,args) => {
    if (name === "claim_restock_notifications") return { data: codes.map((_,index) => ({ ...notification,id: `request-${index}` })),error: null };
    if (name === "prepare_restock_delivery") return { data: args.p_payload,error: null };
    completions.push(args); return { data: true,error: null };
  });
  let sent = 0;
  const result = await deliverRestockBatch(admin,config,null,async () => new Response('{}',{ status: codes[sent++] }));
  expect(result).toMatchObject({ sent: 1,failed: 4 });
  expect(completions.map(args => args.p_retryable)).toEqual([true,true,false,true,false]);
});

test("unsubscribed, unavailable and failed preparation requests never reach the email provider", async () => {
  let sends = 0;
  for (const error of [null,{ message: "Fixture DB failure" }]) {
    const admin = client(async name => {
      if (name === "claim_restock_notifications") return { data: [notification],error: null };
      if (name === "prepare_restock_delivery") return { data: null,error };
      return { data: true,error: null };
    });
    const result = await deliverRestockBatch(admin,config,null,async () => { sends++; return new Response('{}'); });
    expect(result.sent).toBe(0);
  }
  expect(sends).toBe(0);
});

test("a permanent idempotency conflict parks rather than retrying a changed provider request", async () => {
  let retryable: unknown;
  const admin = client(async (name,args) => {
    if (name === "claim_restock_notifications") return { data: [notification],error: null };
    if (name === "prepare_restock_delivery") return { data: args.p_payload,error: null };
    retryable = args.p_retryable; return { data: true,error: null };
  });
  await deliverRestockBatch(admin,config,null,async () => new Response('{"name":"invalid_idempotent_request"}',{ status: 409 }));
  expect(retryable).toBe(false);
});

test("provider acceptance with failed database acknowledgement retains a recoverable failed attempt", async () => {
  const admin = client(async (name,args) => {
    if (name === "claim_restock_notifications") return { data: [notification],error: null };
    if (name === "prepare_restock_delivery") return { data: args.p_payload,error: null };
    return { data: null,error: { message: "Fixture lost acknowledgement" } };
  });
  expect(await deliverRestockBatch(admin,config,null,async () => new Response('{}'))).toMatchObject({ sent: 0,failed: 1 });
});

test("admin and scheduler endpoints reject missing authority and mail-disabled mode never contacts providers", async () => {
  const changes = { ADMIN_SESSION_SECRET: "fixture-only-independent-session-secret", RESTOCK_CRON_SECRET: "fixture-only-independent-scheduler-secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.co.fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture-key", RESEND_API_KEY: "", RESTOCK_FROM_EMAIL: "" };
  const previous = Object.fromEntries(Object.keys(changes).map(key => [key,process.env[key]]));
  Object.assign(process.env,changes);
  try {
    expect((await notify(new Request("http://fixture.invalid",{ method: "POST",body: '{}' }))).status).toBe(401);
    for (const bearer of ["","Bearer wrong",`Bearer ${"ü".repeat(48)}`]) expect((await scheduled(new Request("http://fixture.invalid",{ method: "POST",headers: { Authorization: bearer } }))).status).toBe(401);
    const cookie = `admin_token=${signToken({ adminId: "fixture-admin" })}`;
    const invalid = await notify(new Request("http://fixture.invalid",{ method: "POST",headers: { cookie },body: '{"productId":"bad"}' }));
    expect(invalid.status).toBe(400);
    const response = await scheduled(new Request("http://fixture.invalid",{ method: "POST",headers: { Authorization: `Bearer ${changes.RESTOCK_CRON_SECRET}` } }));
    expect(await response.json()).toMatchObject({ configured: false,status: "queued",sent: 0 });
  } finally {
    for (const [key,value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
