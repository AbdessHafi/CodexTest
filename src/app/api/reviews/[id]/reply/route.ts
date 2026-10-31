import { NextRequest, NextResponse } from "next/server";
import {
  actor,
  sameOrigin,
  failure,
  ReviewError,
  jsonBody,
} from "@/lib/reviews/http";
import { replyInput } from "@/lib/reviews/policy";
import { reviewLimit } from "@/lib/reviews/limit";
import { replyToReview } from "@/lib/reviews/service";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(req);
    const user = await actor();
    if (user.role !== "OWNER")
      throw new ReviewError(403, "Accès propriétaire requis.");
    await reviewLimit(user.id, "reply");
    const parsed = replyInput.safeParse(await jsonBody(req));
    if (!parsed.success)
      throw new ReviewError(400, "Réponse attendue : 5 à 2 000 caractères.");
    await replyToReview(user, (await params).id, parsed.data.text);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
