export async function verifyCaptcha(
  token: string,
  action: "review" | "report",
) {
  if (
    process.env.CAPTCHA_MODE === "disabled" &&
    process.env.NODE_ENV !== "production"
  )
    return true;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token || !process.env.CAPTCHA_HOSTNAME) return false;
  try {
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!r.ok) return false;
    const data = await r.json();
    return (
      data.success === true &&
      data.hostname === process.env.CAPTCHA_HOSTNAME &&
      data.action === action
    );
  } catch {
    return false;
  }
}
