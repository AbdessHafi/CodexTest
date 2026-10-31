import { NextRequest, NextResponse } from "next/server";
import {
  actor,
  sameOrigin,
  failure,
  ReviewError,
  jsonBody,
} from "@/lib/reviews/http";
import { moderationInput } from "@/lib/reviews/policy";
import { reviewLimit } from "@/lib/reviews/limit";
import { moderateReview } from "@/lib/reviews/service";
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
    const parsed = moderationInput.safeParse(await jsonBody(req));
    if (!parsed.success)
      throw new ReviewError(
        400,
        "Action et motif de modération (10 à 1 000 caractères) requis.",
      );
    await moderateReview(
      user,
      (await params).id,
      parsed.data.action,
      parsed.data.reason,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
