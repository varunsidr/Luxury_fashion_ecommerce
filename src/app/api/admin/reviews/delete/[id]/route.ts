import { NextResponse } from "next/server";
import { handleAdminReviews, adminReviewDeps } from "@/lib/adminReviews";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const response = await handleAdminReviews(request, (await params).id, adminReviewDeps, "DELETE");
  return response.ok ? NextResponse.redirect(new URL("/admin/reviews", request.url), 303) : response;
}
