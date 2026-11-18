import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { ownerDashboard } from "@/lib/owners/service";
import { exportMenuCsv } from "@/lib/owners/csv";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  actor,
  sameOrigin,
  failure,
  ReviewError,
  jsonBody,
  boundedBody,
} from "@/lib/reviews/http";
import { ownerCommand } from "@/lib/owners/policy";
import { ownerEdit, ownedVenue, addVenuePhoto } from "@/lib/owners/service";
import { reviewLimit } from "@/lib/reviews/limit";
import { preparePhotos, storePhoto, removePhoto } from "@/lib/reviews/storage";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let key: string | undefined;
  let thumbKey: string | undefined;
  try {
    sameOrigin(req);
    const user = await actor();
    const { id } = await params;
    if (user.role !== "OWNER")
      throw new ReviewError(403, "Accès propriétaire requis.");
    await db.transaction((tx) => ownedVenue(tx, user, id));
    await reviewLimit(user.id, "owner");
    if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      let form: FormData;
      try {
        const body = await boundedBody(req, 6 * 1024 * 1024);
        form = await new Response(body, {
          headers: { "Content-Type": req.headers.get("content-type")! },
        }).formData();
      } catch (e) {
        if (e instanceof ReviewError) throw e;
        throw new ReviewError(400, "Formulaire photo invalide.");
      }
      const input = z
        .object({
          alt: z.string().trim().min(5).max(200),
          menuItemId: z.string().min(1).max(100).optional(),
        })
        .safeParse({
          alt: form.get("alt"),
          menuItemId: form.get("menuItemId") || undefined,
        });
      if (!input.success)
        throw new ReviewError(400, "Légende de 5 à 200 caractères requise.");
      const file = form.get("photo");
      if (!(file instanceof File) || form.getAll("photo").length !== 1)
        throw new ReviewError(400, "Une photo est requise.");
      const [image] = await preparePhotos([file]);
      key = await storePhoto(image, "venues");
      thumbKey = await storePhoto(
        await sharp(image)
          .resize(320, 320, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer(),
        "venues",
      );
      await addVenuePhoto(
        user,
        id,
        key,
        input.data.alt,
        input.data.menuItemId,
        thumbKey,
      );
      thumbKey = undefined;
      key = undefined;
    } else {
      const input = ownerCommand.safeParse(await jsonBody(req, 200000));
      if (!input.success)
        throw new ReviewError(400, input.error.issues[0].message);
      const removed = await ownerEdit(user, id, input.data);
      await Promise.allSettled(removed.map(removePhoto));
    }
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (key || thumbKey)
      await Promise.allSettled(
        [key, thumbKey].filter((k): k is string => !!k).map(removePhoto),
      );
    return failure(e);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await actor();
    const data = await ownerDashboard(user, (await params).id);
    return new Response(exportMenuCsv(data.menu), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="menu.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
