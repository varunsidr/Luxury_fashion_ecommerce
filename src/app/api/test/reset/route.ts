import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "test endpoint disabled in production" }, { status: 404 });
  }
  const secret = process.env.TEST_API_SECRET?.trim();
  if (!secret || req.headers.get("x-test-api-secret") !== secret) {
    return NextResponse.json({ error: "missing or invalid test API secret" }, { status: 401 });
  }
  // HTTP requests must not clear a potentially shared database. The SQL suites
  // rebuild isolated in-memory fixtures and browsers use fresh contexts.
  return NextResponse.json({
    error: "The database reset helper has been retired. Use test:purchase and test:restock for isolated database fixtures, and a fresh browser context for browser storage.",
  }, { status: 410 });
}
