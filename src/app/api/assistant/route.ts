import { defaultDeps, handleAssistantRequest } from "@/lib/assistant/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAssistantRequest(request, defaultDeps);
}
