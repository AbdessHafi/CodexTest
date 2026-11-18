import { validProofUrl } from "@/lib/owners/proof";
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
    const claimId = (await params).id;
    if (
      !validProofUrl(
        claimId,
        user.id,
        _req.nextUrl.searchParams.get("expires"),
        _req.nextUrl.searchParams.get("signature"),
      )
    )
      throw new ReviewError(403, "Lien privé expiré ou invalide.");
    const [claim] = await db
      .select()
      .from(venueClaims)
      .where(eq(venueClaims.id, (await params).id));
    if (!claim || (user.role !== "ADMIN" && claim.userId !== user.id))
      throw new ReviewError(404, "Document introuvable.");
    if (!claim.documentKey)
      throw new ReviewError(404, "Aucun justificatif joint.");
    const file = await readPhoto(claim.documentKey);
    if (!file.Body) throw new ReviewError(404, "Document introuvable.");
    return new Response(file.Body.transformToWebStream() as ReadableStream, {
      headers: {
        "Content-Type": claim.documentType || "image/jpeg",
        "Content-Security-Policy": "sandbox",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition":
          claim.documentType === "application/pdf"
            ? 'attachment; filename="justificatif.pdf"'
            : "inline",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
