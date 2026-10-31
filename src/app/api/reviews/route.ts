import { NextRequest, NextResponse } from "next/server";
import {
  actor,
  sameOrigin,
  failure,
  ReviewError,
  boundedBody,
} from "@/lib/reviews/http";
import { reviewInput } from "@/lib/reviews/policy";
import { verifyCaptcha } from "@/lib/reviews/captcha";
import { reviewLimit } from "@/lib/reviews/limit";
import { submitReview } from "@/lib/reviews/service";
import { preparePhotos, storePhoto, removePhoto } from "@/lib/reviews/storage";
export async function POST(req: NextRequest) {
  const stored: string[] = [];
  try {
    sameOrigin(req);
    const user = await actor();
    await reviewLimit(user.id, "review");
    if (Number(req.headers.get("content-length") || 0) > 16 * 1024 * 1024)
      throw new ReviewError(413, "Requête trop volumineuse.");
    const bytes = await boundedBody(req, 16 * 1024 * 1024);
    let form: FormData;
    try {
      form = await new Response(bytes, {
        headers: { "Content-Type": req.headers.get("content-type") || "" },
      }).formData();
    } catch {
      throw new ReviewError(400, "Formulaire invalide.");
    }
    const payload = form.get("payload");
    if (typeof payload !== "string" || payload.length > 6000)
      throw new ReviewError(400, "Avis invalide.");
    let raw;
    try {
      raw = JSON.parse(payload);
    } catch {
      throw new ReviewError(400, "Avis invalide.");
    }
    const parsed = reviewInput.safeParse(raw);
    if (!parsed.success)
      throw new ReviewError(400, parsed.error.issues[0].message);
    if (!(await verifyCaptcha(parsed.data.captchaToken, "review")))
      throw new ReviewError(
        400,
        "La vérification anti-robot a échoué ou n’est pas configurée.",
      );
    const files = form.getAll("photos");
    if (files.some((f) => !(f instanceof File)))
      throw new ReviewError(400, "Photos invalides.");
    const images = await preparePhotos(files as File[]);
    for (const image of images) stored.push(await storePhoto(image));
    const review = await submitReview(user, parsed.data, stored);
    return NextResponse.json(
      { id: review.id, status: review.status },
      { status: 201 },
    );
  } catch (error) {
    await Promise.allSettled(stored.map(removePhoto));
    return failure(error);
  }
}
