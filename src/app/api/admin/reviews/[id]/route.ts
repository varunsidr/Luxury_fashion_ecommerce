import { handleAdminReviews } from "@/lib/adminReviews";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) { return handleAdminReviews(request, (await params).id); }
export async function PUT(request: Request, { params }: Context) { return handleAdminReviews(request, (await params).id); }
export async function DELETE(request: Request, { params }: Context) { return handleAdminReviews(request, (await params).id); }
