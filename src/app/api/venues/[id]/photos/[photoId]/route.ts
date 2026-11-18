import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { photos } from "@/db/schema";
import { failure, ReviewError } from "@/lib/reviews/http";
import { readPhoto } from "@/lib/reviews/storage";
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  try {
    const { id, photoId } = await params;
    const [photo] = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.venueId, id)));
    if (!photo) throw new ReviewError(404, "Photo introuvable.");
    const file = await readPhoto(photo.key);
    if (!file.Body) throw new ReviewError(404, "Photo introuvable.");
    return new Response(file.Body.transformToWebStream() as ReadableStream, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
