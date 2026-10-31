import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export function authConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
export async function supabase() {
  if (!authConfigured()) throw new Error("Authentification non configurée");
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        },
      },
    },
  );
}
export async function requireRole(roles: ("CONSUMER" | "OWNER" | "ADMIN")[]) {
  const auth = await supabase();
  const {
    data: { user },
    error,
  } = await auth.auth.getUser();
  if (error || !user) return null;
  const { db } = await import("./db");
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  return profile && roles.includes(profile.role) ? profile : null;
}
