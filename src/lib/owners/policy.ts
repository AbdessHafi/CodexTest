import { z } from "zod";
import { venueTypes, allTags } from "@/lib/demo";
export function validSiret(value: string) {
  if (!/^\d{14}$/.test(value) || /^0+$/.test(value)) return false;
  if (value.startsWith("356000000"))
    return [...value].reduce((s, c) => s + Number(c), 0) % 5 === 0;
  return (
    [...value].reduce((sum, c, i) => {
      let n = Number(c) * (i % 2 === 0 ? 2 : 1);
      if (n > 9) n -= 9;
      return sum + n;
    }, 0) %
      10 ===
    0
  );
}
export const claimInput = z
  .object({
    venueId: z.string().min(1).max(100),
    siret: z
      .string()
      .refine(
        validSiret,
        "SIRET invalide : 14 chiffres et clé de contrôle attendus.",
      ),
    businessEmail: z.email().max(254),
    phone: z.string().regex(/^\+?[0-9 .()-]{8,25}$/),
    applicantRole: z.enum(["owner", "manager"]),
    statement: z.string().trim().min(20).max(2000),
    captchaToken: z.string().max(2048).default(""),
  })
  .strict();
export const claimDecision = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    reason: z.string().trim().min(10).max(1000),
    registryChecked: z.boolean().optional(),
    authorityChecked: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) => v.action === "REJECT" || (v.registryChecked && v.authorityChecked),
    "Confirmez le registre et l’habilitation avant de valider.",
  );
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const interval = z
  .object({ open: time, close: time })
  .strict()
  .refine(
    (v) => v.open < v.close,
    "L’heure de fermeture doit suivre l’ouverture (pas de service de nuit).",
  );
const hours = interval.safeExtend({ day: z.number().int().min(0).max(6) });
const exception = z
  .object({
    date: z.iso.date(),
    closed: z.boolean(),
    open: time.optional(),
    close: time.optional(),
  })
  .strict()
  .refine(
    (v) => v.closed || !!(v.open && v.close && v.open < v.close),
    "Renseignez un créneau valide pour une ouverture exceptionnelle.",
  );
const cleanText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine(
      (v) => !/[<>]/.test(v),
      "Utilisez du texte simple, sans balises HTML.",
    );
const safeUrl = z.union([
  z.literal(""),
  z
    .url()
    .max(300)
    .refine((v) => {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password;
    }, "Une URL HTTPS est attendue."),
]);
export const profileInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: cleanText(20, 3000),
    email: z.union([z.literal(""), z.email().max(254)]).default(""),
    phone: z
      .union([z.literal(""), z.string().regex(/^\+?[0-9 .()-]{8,25}$/)])
      .default(""),
    website: safeUrl.default(""),
    instagram: safeUrl
      .refine(
        (v) =>
          !v ||
          ["instagram.com", "www.instagram.com"].includes(new URL(v).hostname),
      )
      .default(""),
    facebook: safeUrl
      .refine(
        (v) =>
          !v ||
          ["facebook.com", "www.facebook.com"].includes(new URL(v).hostname),
      )
      .default(""),
    types: z
      .array(z.string().refine((v) => venueTypes.includes(v)))
      .max(4)
      .default([]),
    address: z.string().trim().min(5).max(200),
    city: z.string().trim().min(2).max(100),
    neighborhood: z.string().trim().max(100),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    type: z.string().refine((v) => venueTypes.includes(v)),
    price: z.number().int().min(1).max(3),
    tags: z
      .array(z.string().refine((v) => allTags.includes(v)))
      .max(allTags.length)
      .refine((v) => new Set(v).size === v.length),
  })
  .strict();
export const scheduleInput = z
  .object({
    hours: z
      .array(hours)
      .max(7)
      .refine((v) => new Set(v.map((h) => h.day)).size === v.length),
    exceptions: z
      .array(exception)
      .max(60)
      .refine((v) => new Set(v.map((h) => h.date)).size === v.length),
  })
  .strict();
export const menuInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: cleanText(0, 1000),
    category: cleanText(1, 80).default("À la carte"),
    allergens: z.array(cleanText(1, 40)).max(20).default([]),
    available: z.boolean().default(true),
    specialEndDate: z.iso.date().nullable().default(null),
    featuredStart: z.iso.date().nullable().default(null),
    featuredEnd: z.iso.date().nullable().default(null),
    price: z.number().int().min(0).max(1000000),
    tags: z.array(z.string().trim().min(1).max(40)).max(12),
    specialDate: z.iso.date().nullable().default(null),
  })
  .strict()
  .refine(
    (v) =>
      (!v.specialEndDate ||
        (!!v.specialDate && v.specialDate <= v.specialEndDate)) &&
      ((!v.featuredStart && !v.featuredEnd) ||
        (!!v.featuredStart &&
          !!v.featuredEnd &&
          v.featuredStart <= v.featuredEnd)),
    "Vérifiez les dates de début et de fin.",
  );
export const ownerCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("menu-import"),
      items: z.array(menuInput).min(1).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal("menu-order"),
      ids: z.array(z.string().min(1).max(100)).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal("photo-order"),
      ids: z.array(z.string().min(1).max(100)).max(20),
    })
    .strict(),
  z
    .object({
      action: z.literal("photo-cover"),
      photoId: z.string().min(1).max(100),
    })
    .strict(),
  z.object({ action: z.literal("profile"), data: profileInput }).strict(),
  z.object({ action: z.literal("schedule"), data: scheduleInput }).strict(),
  z.object({ action: z.literal("menu-create"), data: menuInput }).strict(),
  z
    .object({
      action: z.literal("menu-update"),
      itemId: z.string().min(1).max(100),
      data: menuInput,
    })
    .strict(),
  z
    .object({
      action: z.literal("menu-delete"),
      itemId: z.string().min(1).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal("photo-delete"),
      photoId: z.string().min(1).max(100),
    })
    .strict(),
]);
export function visibleMenuItem(
  item: {
    available: boolean;
    specialDate: string | null;
    specialEndDate: string | null;
  },
  today: string,
) {
  return (
    item.available &&
    (!item.specialDate ||
      (item.specialDate <= today &&
        today <= (item.specialEndDate || item.specialDate)))
  );
}
export function featuredMenuItem(
  item: { featuredStart?: string | null; featuredEnd?: string | null },
  today: string,
) {
  return (
    !!item.featuredStart &&
    !!item.featuredEnd &&
    item.featuredStart <= today &&
    today <= item.featuredEnd
  );
}
