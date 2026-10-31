// Local test-only Supabase Auth and object-storage emulators. Never imported by application code.
import { createServer } from "node:http";
import { roles, projects, userId } from "./accounts";
const objects = new Map<string, Buffer>();
createServer(async (req, res) => {
  if (req.url === "/health") {
    res.end("ok");
    return;
  }
  if (req.url?.startsWith("/auth/v1/user")) {
    try {
      const payload = JSON.parse(
        Buffer.from(
          (req.headers.authorization || "")
            .replace("Bearer ", "")
            .split(".")[1],
          "base64url",
        ).toString(),
      );
      const account = projects
        .flatMap((p) => roles.map((r) => ({ id: userId(p, r), role: r })))
        .find((a) => a.id === payload.sub);
      if (!account) throw new Error("unknown");
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          id: account.id,
          aud: "authenticated",
          role: "authenticated",
          email: `${account.role}@example.invalid`,
          email_confirmed_at:
            account.role === "unverified" ? null : "2026-01-01T00:00:00Z",
          created_at: "2026-01-01T00:00:00Z",
          app_metadata: { provider: "email" },
          user_metadata: {},
          identities: [],
        }),
      );
    } catch {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Invalid token" }));
    }
    return;
  }
  const key = req.url?.split("?")[0] || "";
  if (req.method === "PUT") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    objects.set(key, Buffer.concat(chunks));
    res.writeHead(200, { ETag: '"fixture"' });
    res.end();
    return;
  }
  if (req.method === "DELETE") {
    objects.delete(key);
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && objects.has(key)) {
    res.setHeader("Content-Type", "image/jpeg");
    res.end(objects.get(key));
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(54329, "127.0.0.1", () => console.log("Test services ready"));
