import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { ReviewError } from "./http";
// Atomic durable window shared by all application instances. Keyed by validated identity, never client IP headers.
export async function reviewLimit(
  userId: string,
  action: "review" | "report" | "reply" | "moderate",
) {
  const window = new Date(Math.floor(Date.now() / 900000) * 900000);
  const key = `${action}:${userId}`;
  const result =
    await db.execute(sql`INSERT INTO abuse_buckets (key,"window",count) VALUES (${key},${window.toISOString()},1)
 ON CONFLICT (key) DO UPDATE SET "window"=EXCLUDED."window",count=CASE WHEN abuse_buckets."window"=EXCLUDED."window" THEN abuse_buckets.count+1 ELSE 1 END
 RETURNING count`);
  if (Number(result.rows[0]?.count) > (action === "moderate" ? 100 : 5))
    throw new ReviewError(
      429,
      "Trop de tentatives. Réessayez dans 15 minutes.",
    );
}
