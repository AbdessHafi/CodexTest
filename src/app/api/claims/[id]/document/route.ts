import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { venueClaims } from "@/db/schema";
import { actor, failure, ReviewError } from "@/lib/reviews/http";
import { readPhoto } from "@/lib/reviews/storage";
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await actor();
    const [claim] = await db
      .select()
      .from(venueClaims)
      .where(eq(venueClaims.id, (await params).id));
    if (!claim || (user.role !== "ADMIN" && claim.userId !== user.id))
      throw new ReviewError(404, "Document introuvable.");
    const file = await readPhoto(claim.documentKey);
    if (!file.Body) throw new ReviewError(404, "Document introuvable.");
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
