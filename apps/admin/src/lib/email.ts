// Transactional email via Resend's REST API (no SDK — Workers-native fetch).
// Resend is Cloudflare's recommended path; the free tier covers magic links.

interface SendArgs {
  to: string;
  link: string;
}

export async function sendMagicLink(
  env: { RESEND_API_KEY: string },
  { to, link }: SendArgs
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Mainstay <hello@mainstayshop.studio>",
      to: [to],
      subject: "Your Mainstay sign-in link",
      text: [
        "Here's your one-time link to sign in to your Mainstay dashboard:",
        "",
        link,
        "",
        "It's good for 15 minutes. If you didn't ask for this, you can ignore it.",
        "",
        "— Cory, Mainstay",
      ].join("\n"),
      html: magicLinkHtml(link),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${detail}`);
  }
}

function magicLinkHtml(link: string): string {
  // Inline styles only — email clients strip <style>. Warm, plain, on-brand.
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1f1b16; line-height: 1.6; max-width: 480px; margin: 0 auto; padding: 24px;">
    <p style="margin: 0 0 16px;">Here's your one-time link to sign in to your Mainstay dashboard:</p>
    <p style="margin: 0 0 24px;">
      <a href="${link}" style="display: inline-block; background: #b4533a; color: #fbf7f1; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600;">Open my dashboard</a>
    </p>
    <p style="margin: 0 0 8px; color: #5b4f42; font-size: 14px;">It's good for 15 minutes. If you didn't ask for this, you can ignore this email.</p>
    <p style="margin: 24px 0 0; color: #6f5f4a; font-size: 14px;">— Cory, Mainstay</p>
  </div>`;
}
