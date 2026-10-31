export const roles = [
  "consumer",
  "reporter",
  "owner",
  "admin",
  "unverified",
] as const;
export const projects = ["chromium", "mobile"] as const;
export function userId(project: string, role: string) {
  return `00000000-0000-4000-8000-${(projects.indexOf(project as (typeof projects)[number]) + 1).toString().padStart(6, "0")}${(roles.indexOf(role as (typeof roles)[number]) + 1).toString().padStart(6, "0")}`;
}
export const venueId = (project: string) => `e2e-phase2-${project}`;
export function sessionCookie(project: string, role: string) {
  const id = userId(project, role);
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const access_token = [
    { alg: "HS256", typ: "JWT" },
    {
      sub: id,
      exp: expires,
      iat: Math.floor(Date.now() / 1000),
      aud: "authenticated",
      role: "authenticated",
    },
    "test-only-signature",
  ]
    .map((v, i) =>
      i === 2 ? v : Buffer.from(JSON.stringify(v)).toString("base64url"),
    )
    .join(".");
  const session = {
    access_token,
    refresh_token: "test-only-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expires,
    user: { id, email: `${role}@example.invalid` },
  };
  return {
    name: "sb-127-auth-token",
    value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
    domain: "127.0.0.1",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax" as const,
  };
}
