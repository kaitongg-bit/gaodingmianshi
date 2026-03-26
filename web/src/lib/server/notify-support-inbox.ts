const RESEND_API = "https://api.resend.com/emails";

export async function notifySupportInbox(opts: {
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.SUPPORT_NOTIFY_EMAIL?.trim();
  if (!apiKey || !to) return;

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "DraftReady <onboarding@resend.dev>";

  const r = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.warn("[support notify] Resend failed:", r.status, t.slice(0, 500));
  }
}
