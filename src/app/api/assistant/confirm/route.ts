import { defaultDeps } from "@/lib/assistant/handler";
import { handleAssistantConfirmation } from "@/lib/assistant/confirm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => handleAssistantConfirmation(request, defaultDeps);
