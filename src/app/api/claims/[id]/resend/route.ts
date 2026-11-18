import { NextRequest, NextResponse } from "next/server";
import { actor, sameOrigin, failure, ReviewError } from "@/lib/reviews/http";
import { reviewLimit } from "@/lib/reviews/limit";
import { resendClaimCode } from "@/lib/owners/service";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(req);
    const user = await actor();
    await reviewLimit(user.id, "claim-resend");
    if (!(await resendClaimCode(user, (await params).id)))
      throw new ReviewError(
        503,
        "Envoi indisponible. Votre demande reste enregistrée.",
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
