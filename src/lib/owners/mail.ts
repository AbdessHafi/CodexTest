import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { mailOutbox } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
export async function sendMail(
  to: string,
  subject: string,
  text: string,
  id = crypto.randomUUID(),
) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.MAIL_TRANSPORT === "local"
  ) {
    const dir = path.join(process.cwd(), ".local", "mail");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(dir, `${id}.json`),
      JSON.stringify({ to, subject, text }),
      { mode: 0o600 },
    );
    return true;
  }
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": id,
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [to],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
export async function flushMail() {
  const items = await db
    .select()
    .from(mailOutbox)
    .where(isNull(mailOutbox.sentAt))
    .limit(100);
  let sent = 0;
  for (const mail of items)
    if (await sendMail(mail.recipient, mail.subject, mail.text, mail.id)) {
      await db
        .update(mailOutbox)
        .set({ sentAt: new Date() })
        .where(eq(mailOutbox.id, mail.id));
      sent++;
    }
  return { pending: items.length - sent, sent };
}
