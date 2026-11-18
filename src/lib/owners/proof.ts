import { createHmac, timingSafeEqual } from "node:crypto";
import { ReviewError } from "@/lib/reviews/http";
import { preparePhotos } from "@/lib/reviews/storage";
function key() {
  if (
    process.env.CLAIM_CODE_SECRET?.length &&
    process.env.CLAIM_CODE_SECRET.length >= 32
  )
    return process.env.CLAIM_CODE_SECRET;
  if (process.env.NODE_ENV === "production")
    throw new Error("CLAIM_CODE_SECRET requis");
  return "local-development-only-claim-code-secret";
}
const sign = (id: string, userId: string, expires: string) =>
  createHmac("sha256", key())
    .update(`proof:${id}:${userId}:${expires}`)
    .digest("hex");
export function proofUrl(id: string, userId: string) {
  const expires = String(Date.now() + 900000);
  return `/api/claims/${id}/document?expires=${expires}&signature=${sign(id, userId, expires)}`;
}
export function validProofUrl(
  id: string,
  userId: string,
  expires: string | null,
  signature: string | null,
) {
  if (
    !expires ||
    !signature ||
    !/^\d{13}$/.test(expires) ||
    Number(expires) < Date.now() ||
    Number(expires) > Date.now() + 900000 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  return timingSafeEqual(
    Buffer.from(sign(id, userId, expires), "hex"),
    Buffer.from(signature, "hex"),
  );
}
export async function prepareProof(file: File) {
  if (file.size > 5 * 1024 * 1024)
    throw new ReviewError(400, "Justificatif de 5 Mo maximum.");
  if (file.type === "application/pdf") {
    const body = Buffer.from(await file.arrayBuffer());
    if (
      !body.subarray(0, 5).equals(Buffer.from("%PDF-")) ||
      !body.subarray(-2048).includes(Buffer.from("%%EOF"))
    )
      throw new ReviewError(400, "PDF invalide.");
    return { body, type: "application/pdf" };
  }
  const [body] = await preparePhotos([file]);
  return { body, type: "image/jpeg" };
}
