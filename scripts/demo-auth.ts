// Deliberate local-only development identity provider. Not imported or enabled by production routes.
import { createServer } from "node:http";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { demoAccounts } from "./demo-accounts";
if (process.env.NODE_ENV === "production" || !process.env.DEMO_SESSION_SECRET)
  throw new Error("Démo locale uniquement. Utilisez npm run dev:owner-demo.");
const secret = process.env.DEMO_SESSION_SECRET;
const signature = (s: string) =>
  createHmac("sha256", secret).update(s).digest("base64url");
const jwt = (id: string) => {
  const parts = [
    { alg: "HS256", typ: "JWT" },
    {
      sub: id,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
  ]
    .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
    .join(".");
  return `${parts}.${signature(parts)}`;
};
await mkdir(".local/storage", { recursive: true, mode: 0o700 });
createServer(async (req, res) => {
  try {
    if (req.url === "/health") {
      res.end("ok");
      return;
    }
    if (req.method === "GET" && req.url === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        `<h1>Démo locale Pause Café</h1><p>Identités fictives. Ne pas exposer ce service sur Internet.</p><form method="post">${Object.keys(
          demoAccounts,
        )
          .map((role) => `<button name="role" value="${role}">${role}</button>`)
          .join("")}</form>`,
      );
      return;
    }
    if (req.method === "POST" && req.url === "/") {
      if (
        !["http://localhost:54329", "http://127.0.0.1:54329"].includes(
          req.headers.origin || "",
        )
      ) {
        res.writeHead(403);
        res.end();
        return;
      }
      let body = "";
      for await (const c of req) {
        body += c;
        if (body.length > 1000) throw new Error("body");
      }
      const role = new URLSearchParams(body).get(
        "role",
      ) as keyof typeof demoAccounts;
      const account = demoAccounts[role];
      if (!account) throw new Error("role");
      const token = jwt(account.id);
      const session = {
        access_token: token,
        refresh_token: "local-demo-only",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user: { id: account.id, email: `${role}@example.invalid` },
      };
      res.setHeader(
        "Set-Cookie",
        `sb-localhost-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}; Path=/; SameSite=Lax; Max-Age=3600`,
      );
      res.writeHead(303, { Location: "http://localhost:3000/pro" });
      res.end();
      return;
    }
    if (req.url?.startsWith("/auth/v1/user")) {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      const [head, payload, sig] = token.split(".");
      const expected = signature(`${head}.${payload}`);
      if (
        !sig ||
        sig.length !== expected.length ||
        !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      )
        throw new Error("token");
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
      const account = Object.entries(demoAccounts).find(
        ([, a]) => a.id === claims.sub,
      );
      if (!account || claims.exp < Date.now() / 1000)
        throw new Error("expired");
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          id: claims.sub,
          aud: "authenticated",
          role: "authenticated",
          email: `${account[0]}@example.invalid`,
          email_confirmed_at: "2026-01-01T00:00:00Z",
          app_metadata: { provider: "email" },
          user_metadata: {},
          identities: [],
        }),
      );
      return;
    }
    const key = createHash("sha256")
      .update(req.url?.split("?")[0] || "")
      .digest("hex");
    const file = `.local/storage/${key}`;
    if (req.method === "PUT") {
      const chunks = [];
      let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > 6 * 1024 * 1024) throw new Error("size");
        chunks.push(c);
      }
      await writeFile(file, Buffer.concat(chunks), { mode: 0o600 });
      res.writeHead(200, { ETag: '"local"' });
      res.end();
      return;
    }
    if (req.method === "DELETE") {
      await unlink(file).catch(() => {});
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "GET") {
      res.end(await readFile(file));
      return;
    }
    res.writeHead(404);
    res.end();
  } catch {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Service local : accès refusé." }));
  }
}).listen(54329, "127.0.0.1", () =>
  console.log(
    "Démo locale : ouvrez http://localhost:54329 pour choisir une identité fictive.",
  ),
);
