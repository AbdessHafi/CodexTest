import { NextRequest, NextResponse } from "next/server";
import { authConfigured, supabase } from "@/lib/auth";
export async function GET(req: NextRequest) {
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || req.url).origin;
  const code = req.nextUrl.searchParams.get("code");
  if (code && authConfigured()) {
    const auth = await supabase();
    const { data, error } = await auth.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      try {
        const { db } = await import("@/lib/db");
        const { users } = await import("@/db/schema");
        await db
          .insert(users)
          .values({ id: data.user.id })
          .onConflictDoNothing();
      } catch {
        await auth.auth.signOut();
        return NextResponse.redirect(`${origin}/connexion?erreur=profil`);
      }
      return NextResponse.redirect(`${origin}/compte`);
    }
  }
  return NextResponse.redirect(`${origin}/connexion?erreur=lien`);
}
