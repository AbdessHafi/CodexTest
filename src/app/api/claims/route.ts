import { prepareProof } from "@/lib/owners/proof";
import { NextRequest, NextResponse } from "next/server";
import {
  actor,
  sameOrigin,
  failure,
  ReviewError,
  boundedBody,
} from "@/lib/reviews/http";
import { claimInput } from "@/lib/owners/policy";
import { submitClaim } from "@/lib/owners/service";
import { reviewLimit } from "@/lib/reviews/limit";
import { verifyCaptcha } from "@/lib/reviews/captcha";
import { storePhoto, removePhoto } from "@/lib/reviews/storage";
export async function POST(req: NextRequest) {
  let key: string | undefined;
  try {
    sameOrigin(req);
    const user = await actor();
    await reviewLimit(user.id, "claim");
    const body = await boundedBody(req, 6 * 1024 * 1024);
    let form: FormData;
    try {
      form = await new Response(body, {
        headers: { "Content-Type": req.headers.get("content-type") || "" },
      }).formData();
    } catch {
      throw new ReviewError(400, "Formulaire invalide.");
    }
    const payload = form.get("payload");
    let raw;
    try {
      raw = JSON.parse(typeof payload === "string" ? payload : "null");
    } catch {
      throw new ReviewError(400, "Demande invalide.");
    }
    const parsed = claimInput.safeParse(raw);
    if (!parsed.success)
      throw new ReviewError(400, parsed.error.issues[0].message);
    if (!(await verifyCaptcha(parsed.data.captchaToken, "claim")))
      throw new ReviewError(400, "Vérification anti-robot requise.");
    const file = form.get("document");
    let documentType: string | null = null;
    if (file instanceof File && file.size) {
      const proof = await prepareProof(file);
      documentType = proof.type;
      key = await storePhoto(proof.body, "claims", proof.type);
    }
    const claim = await submitClaim(
      user,
      parsed.data,
      key || null,
      documentType,
    );
    return NextResponse.json(claim, { status: 201 });
  } catch (e) {
    if (key) await Promise.allSettled([removePhoto(key)]);
    return failure(e);
  }
}
