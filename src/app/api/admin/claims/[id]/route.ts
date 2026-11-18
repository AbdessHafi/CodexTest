import { NextRequest, NextResponse } from "next/server";
import {
  actor,
  sameOrigin,
  failure,
  ReviewError,
  jsonBody,
} from "@/lib/reviews/http";
import { claimDecision } from "@/lib/owners/policy";
import { decideClaim } from "@/lib/owners/service";
import { reviewLimit } from "@/lib/reviews/limit";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(req);
    const user = await actor();
    if (user.role !== "ADMIN")
      throw new ReviewError(403, "Accès administrateur requis.");
    await reviewLimit(user.id, "moderate");
    const parsed = claimDecision.safeParse(await jsonBody(req));
    if (!parsed.success)
      throw new ReviewError(400, parsed.error.issues[0].message);
    await decideClaim(user, (await params).id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
