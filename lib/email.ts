import "server-only";
import nodemailer from "nodemailer";

export async function sendLoginCode(to: string, code: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[dev] Login code for ${to}: ${code}`);
      return;
    }
    throw new Error("SMTP is not configured");
  }

  const port = Number(SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const appName = process.env.APP_NAME || "Time Tracker";
  await transport.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    subject: `${appName} sign-in code: ${code}`,
    text:
      `Your sign-in code is ${code}\n\n` +
      `It expires in 10 minutes. If you did not request it, you can ignore this email.`,
    html:
      `<p>Your sign-in code is</p>` +
      `<p style="font-size:28px;font-weight:700;letter-spacing:6px;font-family:monospace">${code}</p>` +
      `<p>It expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
  });
}
