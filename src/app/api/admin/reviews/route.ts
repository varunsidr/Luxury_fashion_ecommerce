import { handleAdminReviews } from "@/lib/adminReviews";

export function GET(request: Request) { return handleAdminReviews(request, null); }
