import { z } from "zod";
export const criteria = [
  "coffee",
  "food",
  "service",
  "ambiance",
  "value",
] as const;
export const labels = {
  coffee: "Café",
  food: "Cuisine",
  service: "Service",
  ambiance: "Ambiance",
  value: "Rapport qualité-prix",
};
export const parisDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const text = z
  .string()
  .trim()
  .min(20, "Racontez votre visite en au moins 20 caractères.")
  .max(3000);
const rating = z.number().int().min(1).max(5);
export const reviewInput = z
  .object({
    venueId: z.string().min(1).max(100),
    visitDate: z.iso
      .date()
      .refine((v) => v <= parisDate(), "La visite doit être passée."),
    bookingId: z.string().min(1).max(100).optional(),
    coffee: rating,
    food: rating,
    service: rating,
    ambiance: rating,
    value: rating,
    text,
    captchaToken: z.string().max(2048).default(""),
  })
  .strict();
export const replyInput = z
  .object({ text: z.string().trim().min(5).max(2000) })
  .strict();
export const reportInput = z
  .object({
    reason: z.string().trim().min(10).max(1000),
    captchaToken: z.string().max(2048).default(""),
  })
  .strict();
export const moderationInput = z
  .object({
    action: z.enum(["PUBLISH", "REJECT", "DISMISS_REPORTS"]),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export type ReviewInput = z.infer<typeof reviewInput>;
export function reviewScore(r: Record<(typeof criteria)[number], number>) {
  return criteria.reduce((sum, k) => sum + r[k], 0) / criteria.length;
}
export function summarize(rows: Record<(typeof criteria)[number], number>[]) {
  return {
    count: rows.length,
    average: rows.length
      ? rows.reduce((sum, r) => sum + reviewScore(r), 0) / rows.length
      : 0,
    criteria: Object.fromEntries(
      criteria.map((k) => [
        k,
        rows.length ? rows.reduce((sum, r) => sum + r[k], 0) / rows.length : 0,
      ]),
    ) as Record<(typeof criteria)[number], number>,
  };
}
export function contentFingerprint(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}
export function canReply(
  actor: { id: string; role: string },
  owner: { userId: string; status: string } | undefined,
) {
  return (
    actor.role === "OWNER" &&
    owner?.userId === actor.id &&
    owner.status === "APPROVED"
  );
}
