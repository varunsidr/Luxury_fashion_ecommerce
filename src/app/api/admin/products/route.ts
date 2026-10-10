import { handleCatalog } from "@/lib/adminCatalog";
export const GET = (request: Request) => handleCatalog(request, null);
export const POST = (request: Request) => handleCatalog(request, null);
