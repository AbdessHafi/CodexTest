import { NextRequest, NextResponse } from "next/server";
import {
  actor,
  sameOrigin,
  failure,
  ReviewError,
  jsonBody,
} from "@/lib/reviews/http";
import { reportInput } from "@/lib/reviews/policy";
import { verifyCaptcha } from "@/lib/reviews/captcha";
import { reviewLimit } from "@/lib/reviews/limit";
import { reportReview } from "@/lib/reviews/service";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(req);
    const user = await actor();
    await reviewLimit(user.id, "report");
    const parsed = reportInput.safeParse(await jsonBody(req));
    if (!parsed.success)
      throw new ReviewError(
        400,
        "Expliquez le signalement en 10 à 1 000 caractères.",
      );
    if (!(await verifyCaptcha(parsed.data.captchaToken, "report")))
      throw new ReviewError(400, "Vérification anti-robot requise.");
    await reportReview(user, (await params).id, parsed.data.reason);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
