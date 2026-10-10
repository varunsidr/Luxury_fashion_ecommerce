import { handleCatalog } from "@/lib/adminCatalog";
type Context = { params: Promise<{ id: string }> };
export const PATCH = async (request: Request, context: Context) => handleCatalog(request, (await context.params).id);
export const DELETE = async (request: Request, context: Context) => handleCatalog(request, (await context.params).id);
