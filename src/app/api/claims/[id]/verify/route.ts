import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  actor,
  sameOrigin,
  jsonBody,
  failure,
  ReviewError,
} from "@/lib/reviews/http";
import { reviewLimit } from "@/lib/reviews/limit";
import { verifyClaimCode } from "@/lib/owners/service";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(req);
    const user = await actor();
    await reviewLimit(user.id, "claim-code");
    const p = z
      .object({ code: z.string().regex(/^\d{6}$/) })
      .strict()
      .safeParse(await jsonBody(req));
    if (!p.success) throw new ReviewError(400, "Code à six chiffres requis.");
    await verifyClaimCode(user, (await params).id, p.data.code);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
