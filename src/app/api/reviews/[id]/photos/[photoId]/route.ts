import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviews, reviewPhotos } from "@/db/schema";
import { actor, failure, ReviewError } from "@/lib/reviews/http";
import { readPhoto } from "@/lib/reviews/storage";
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  try {
    const { id, photoId } = await params;
    const [row] = await db
      .select({
        key: reviewPhotos.objectKey,
        status: reviews.status,
        userId: reviews.userId,
      })
      .from(reviewPhotos)
      .innerJoin(reviews, eq(reviews.id, reviewPhotos.reviewId))
      .where(and(eq(reviewPhotos.id, photoId), eq(reviews.id, id)));
    if (!row) throw new ReviewError(404, "Photo introuvable.");
    if (row.status !== "PUBLISHED") {
      const user = await actor();
      if (user.role !== "ADMIN" && user.id !== row.userId)
        throw new ReviewError(404, "Photo introuvable.");
    }
    const file = await readPhoto(row.key);
    if (!file.Body) throw new ReviewError(404, "Photo introuvable.");
    return new Response(file.Body.transformToWebStream() as ReadableStream, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
