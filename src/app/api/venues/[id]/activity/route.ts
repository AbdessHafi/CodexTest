import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  actor,
  sameOrigin,
  failure,
  ReviewError,
  jsonBody,
} from "@/lib/reviews/http";
import { db } from "@/lib/db";
import { venues } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordActivity, toggleFavorite } from "@/lib/owners/analytics";
import { reviewLimit } from "@/lib/reviews/limit";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(req);
    const p = z
      .object({ kind: z.enum(["phone", "website", "directions", "favorites"]) })
      .strict()
      .safeParse(await jsonBody(req));
    if (!p.success) throw new ReviewError(400, "Événement invalide.");
    const { id } = await params;
    const [v] = await db
      .select({ id: venues.id })
      .from(venues)
      .where(eq(venues.id, id));
    if (!v) throw new ReviewError(404, "Établissement introuvable.");
    if (p.data.kind === "favorites") {
      const user = await actor();
      await reviewLimit(user.id, "owner");
      const active = await toggleFavorite(user, id);
      if (active) await recordActivity(id, "favorites");
      return NextResponse.json({ active });
    }
    await recordActivity(id, p.data.kind);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
