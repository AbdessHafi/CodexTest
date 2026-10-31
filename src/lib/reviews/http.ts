import { NextRequest, NextResponse } from "next/server";
import { authConfigured, supabase } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
export class ReviewError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function actor() {
  if (!authConfigured())
    throw new ReviewError(401, "Connectez-vous pour continuer.");
  const {
    data: { user },
    error,
  } = await (await supabase()).auth.getUser();
  if (error || !user)
    throw new ReviewError(401, "Connectez-vous pour continuer.");
  if (!user.email_confirmed_at)
    throw new ReviewError(403, "Vérifiez votre adresse e-mail.");
  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!profile) throw new ReviewError(403, "Profil non disponible.");
  return profile;
}
export function sameOrigin(req: NextRequest) {
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || req.url).origin;
  if (req.headers.get("origin") !== origin)
    throw new ReviewError(403, "Origine non autorisée.");
}
export async function boundedBody(req: NextRequest, max: number) {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new ReviewError(413, "Requête trop volumineuse.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
export async function jsonBody(req: NextRequest) {
  const body = await boundedBody(req, 6000);
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new ReviewError(400, "Requête invalide.");
  }
}
export function failure(error: unknown) {
  if (error instanceof ReviewError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  return NextResponse.json(
    { error: "Opération indisponible. Réessayez plus tard." },
    { status: 503 },
  );
}
