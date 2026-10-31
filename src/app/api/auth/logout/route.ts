import { NextRequest, NextResponse } from "next/server";
import { authConfigured, supabase } from "@/lib/auth";
export async function POST(req: NextRequest) {
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || req.url).origin;
  if (req.headers.get("origin") !== origin)
    return new NextResponse(null, { status: 403 });
  if (authConfigured()) await (await supabase()).auth.signOut();
  return NextResponse.redirect(`${origin}/`, 303);
}
