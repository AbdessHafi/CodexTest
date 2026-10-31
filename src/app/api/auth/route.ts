import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authConfigured, supabase } from "@/lib/auth";
import { allow } from "@/lib/rate-limit";
const input = z.discriminatedUnion("method", [
  z.object({ method: z.literal("email"), email: z.email().max(254) }),
  z.object({ method: z.enum(["google", "apple"]) }),
]);
export async function POST(req: NextRequest) {
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || req.url).origin;
  if (req.headers.get("origin") !== origin)
    return NextResponse.json(
      { error: "Origine non autorisée." },
      { status: 403 },
    );
  if (!authConfigured())
    return NextResponse.json(
      {
        error: "La connexion sera disponible après configuration de Supabase.",
      },
      { status: 503 },
    );
  if (Number(req.headers.get("content-length") || 0) > 2048)
    return NextResponse.json(
      { error: "Requête trop volumineuse." },
      { status: 413 },
    );
  let body;
  try {
    body = input.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (!body.success)
    return NextResponse.json(
      { error: "Veuillez vérifier votre adresse e-mail." },
      { status: 400 },
    );
  // Global limit avoids trusting unverified proxy IP headers. Supabase provides additional rate limits/captcha.
  if (!allow("auth"))
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans 15 minutes." },
      { status: 429 },
    );
  const auth = await supabase();
  const redirectTo = `${origin}/auth/callback`;
  if (body.data.method === "email") {
    const { error } = await auth.auth.signInWithOtp({
      email: body.data.email,
      options: { emailRedirectTo: redirectTo },
    });
    return error
      ? NextResponse.json(
          { error: "Envoi indisponible. Réessayez ultérieurement." },
          { status: 502 },
        )
      : NextResponse.json({ ok: true });
  }
  const { data, error } = await auth.auth.signInWithOAuth({
    provider: body.data.method,
    options: { redirectTo },
  });
  return error
    ? NextResponse.json({ error: "Connexion indisponible." }, { status: 502 })
    : NextResponse.json({ url: data.url });
}
