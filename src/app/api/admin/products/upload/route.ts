import { handleProductUpload } from "@/lib/adminCatalog";
export const POST = (request: Request) => handleProductUpload(request);
