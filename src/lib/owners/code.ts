import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
function secret() {
  const key = process.env.CLAIM_CODE_SECRET;
  if (key && key.length >= 32) return key;
  if (process.env.NODE_ENV === "production")
    throw new Error("CLAIM_CODE_SECRET requis");
  return "local-development-only-claim-code-secret";
}
export const newCode = () => String(randomInt(0, 1000000)).padStart(6, "0");
export const codeHash = (claimId: string, code: string) =>
  createHmac("sha256", secret()).update(`${claimId}:${code}`).digest("hex");
export function codeMatches(claimId: string, code: string, hash: string) {
  if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(
    Buffer.from(codeHash(claimId, code), "hex"),
    Buffer.from(hash, "hex"),
  );
}
export function codeUsable(
  expires: Date | null,
  attempts: number,
  now = new Date(),
) {
  return !!expires && expires > now && attempts < 5;
}
