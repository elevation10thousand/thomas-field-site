import { Resend } from "resend";

export const runtime = "nodejs";

/* ---------------- helpers ---------------- */

function validEmail(email: string) {
  return !!email && email.includes("@") && email.length <= 254;
}

function redirect303(location: string) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
    },
  });
}

/* ---------------- handlers ---------------- */

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();

  if (!validEmail(email)) {
    // keep it simple: go back home if invalid
    return redirect303("/?lead=invalid");
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
  const RESEND_FROM = process.env.RESEND_FROM || "";
  const LEAD_TO_EMAIL = process.env.LEAD_TO_EMAIL || "";

  console.log("[LEAD]", { email, at: new Date().toISOString() });

  if (!RESEND_API_KEY || !RESEND_FROM || !LEAD_TO_EMAIL) {
    console.error("Missing Resend env vars");
    return redirect303("/?lead=error");
  }

  const resend = new Resend(RESEND_API_KEY);

  const from = `Thomas Field <${RESEND_FROM}>`;
  const subject = `Thomas Field — Lot packet request (${email})`;
  const text =
    `New lot packet request\n\n` +
    `Email: ${email}\n` +
    `Time: ${new Date().toISOString()}\n`;

  const result = await resend.emails.send({
    from,
    to: [LEAD_TO_EMAIL],
    subject,
    text,
  });

  console.log("RESEND RESULT", result);

  if (result.error) {
    console.error("RESEND ERROR", result.error);
    return redirect303("/?lead=error");
  }

  // ✅ Redirect to success page (with a query so you can verify it worked)
  const successUrl = `/success?email=${encodeURIComponent(email)}`;
  console.log("✅ Redirecting to", successUrl);
  return redirect303(successUrl);
}

/* ---------------- friendly GET ---------------- */

export async function GET() {
  return new Response("Use the form on the homepage to request the lot packet.", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

