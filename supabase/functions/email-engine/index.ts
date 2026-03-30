import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SMTP_HOST = "smtp.hostinger.com";
const SMTP_PORT = 465;
const SMTP_USER = Deno.env.get("SMTP_USER") || "support@example.com";
const SMTP_PASS = Deno.env.get("SMTP_PASS") || "";
const TRACK_BASE = Deno.env.get("TRACK_BASE") || "https://YOUR_SUPABASE_REF.supabase.co/functions/v1";
const IMG_URL = "https://YOUR_SUPABASE_REF.supabase.co/storage/v1/object/public/course-covers/automation/coach-Coach-profile.png";
const RAZORPAY_URL = Deno.env.get("RAZORPAY_PAYMENT_URL") || "https://pages.razorpay.com/your-page-id/view";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const results = { processed: 0, sent: 0, errors: 0, skipped: 0, errorDetails: [] as string[] };

  try {
    const now = new Date().toISOString();
    const { data: enrollments, error: enrollErr } = await supabase
      .from("automation_sequence_enrollments")
      .select("*")
      .eq("status", "active")
      .lte("next_send_at", now)
      .limit(20);

    if (enrollErr) throw enrollErr;
    if (!enrollments || enrollments.length === 0) {
      return new Response(JSON.stringify({ status: "idle", message: "No emails due" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Processing ${enrollments.length} enrollments`);

    // Check quiet hours (10PM - 8AM IST = 16:30 - 02:30 UTC)
    const hour = new Date().getUTCHours();
    const minute = new Date().getUTCMinutes();
    const utcTime = hour + minute / 60;
    if (utcTime >= 16.5 || utcTime < 2.5) {
      return new Response(JSON.stringify({ status: "idle", message: "Quiet hours (10PM-8AM IST)" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Connect SMTP
    let smtp: SMTPClient;
    try {
      console.log(`Connecting SMTP: ${SMTP_HOST}:${SMTP_PORT} user=${SMTP_USER} pass=${SMTP_PASS ? "***" + SMTP_PASS.slice(-4) : "EMPTY"}`);
      smtp = new SMTPClient({
        connection: { hostname: SMTP_HOST, port: SMTP_PORT, tls: true },
        auth: { username: SMTP_USER, password: SMTP_PASS },
      });
    } catch (smtpErr) {
      console.error("SMTP connection failed:", smtpErr);
      return new Response(JSON.stringify({ status: "error", message: "SMTP: " + String(smtpErr) }), { status: 500, headers: corsHeaders });
    }

    for (const enrollment of enrollments) {
      results.processed++;
      try {
        const { data: step } = await supabase
          .from("automation_sequence_steps")
          .select("*")
          .eq("sequence_id", enrollment.sequence_id)
          .eq("step_order", enrollment.current_step)
          .single();

        if (!step) {
          await supabase.from("automation_sequence_enrollments")
            .update({ status: "completed", completed_at: now }).eq("id", enrollment.id);
          results.skipped++;
          continue;
        }

        const { data: contact } = await supabase
          .from("automation_contacts").select("*").eq("id", enrollment.contYOUR_AD_ACCOUNT_IDid).single();

        if (!contact || contact.status !== "active") { results.skipped++; continue; }

        // Build email with tracking
        const trackId = crypto.randomUUID();
        const openPixel = `<img src="${TRACK_BASE}/email-track?t=open&id=${trackId}" width="1" height="1" style="display:none" />`;
        
        let htmlBody = step.email_body.replace(
          /href="(https?:\/\/[^"]+)"/g,
          (_m: string, url: string) => `href="${TRACK_BASE}/email-track?t=click&id=${trackId}&url=${encodeURIComponent(url)}"`
        );

        htmlBody = htmlBody
          .replace(/\{\{first_name\}\}/g, contact.first_name || "there")
          .replace(/\{\{email\}\}/g, contact.email)
          .replace(/\{\{phone\}\}/g, contact.phone || "");

        const subject = step.email_subject.replace(/\{\{first_name\}\}/g, contact.first_name || "there");
        const fullHtml = buildMailerLiteTemplate(htmlBody, openPixel, contact.email, trackId);

        console.log(`Sending to ${contact.email}: "${subject}"`);
        await smtp.send({
          from: `Coach Your Coach <${SMTP_USER}>`,
          to: contact.email,
          subject,
          html: fullHtml,
        });
        console.log(`Sent OK to ${contact.email}`);

        results.sent++;

        await supabase.from("automation_email_log").insert({
          contYOUR_AD_ACCOUNT_IDid: contact.id, sequence_id: enrollment.sequence_id, step_id: step.id,
          track_id: trackId, subject: step.email_subject, status: "sent", sent_at: new Date().toISOString(),
        });

        // Advance to next step
        const nextStep = enrollment.current_step + 1;
        const { data: nextStepData } = await supabase
          .from("automation_sequence_steps").select("wait_hours")
          .eq("sequence_id", enrollment.sequence_id).eq("step_order", nextStep).single();

        if (nextStepData) {
          const nextSendAt = new Date(Date.now() + nextStepData.wait_hours * 3600000).toISOString();
          await supabase.from("automation_sequence_enrollments")
            .update({ current_step: nextStep, next_send_at: nextSendAt, last_sent_at: now }).eq("id", enrollment.id);
        } else {
          await supabase.from("automation_sequence_enrollments")
            .update({ status: "completed", completed_at: now, last_sent_at: now }).eq("id", enrollment.id);
        }

      } catch (stepErr) {
        const errMsg = String(stepErr);
        console.error(`Error for enrollment ${enrollment.id}:`, errMsg);
        results.errors++;
        results.errorDetails.push(errMsg);

        try {
          await supabase.from("automation_email_log").insert({
            contYOUR_AD_ACCOUNT_IDid: enrollment.contYOUR_AD_ACCOUNT_IDid, sequence_id: enrollment.sequence_id,
            status: "failed", error_message: errMsg,
          });
        } catch {}

      }
    }

    try { await smtp.close(); } catch {}

    return new Response(JSON.stringify({ status: "ok", ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ status: "error", message: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildMailerLiteTemplate(body: string, openPixel: string, email: string, trackId: string): string {
  const trackBase = TRACK_BASE;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
</head>
<body style="margin:0;padding:0;background:#ededed;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ededed;">
    <tr><td align="center" style="padding:8px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;">
        
        <!-- BLACK HEADER — Coach Coach Banner -->
        <tr>
          <td style="background:#000000;border-radius:12px 12px 0 0;padding:25px 15px;text-align:center;">
            <img src="${IMG_URL}" alt="Your Coach" style="width:100%;max-width:580px;border-radius:10px;display:block;margin:0 auto;" />
          </td>
        </tr>

        <!-- GOLD DIVIDER -->
        <tr>
          <td style="background:#ffffff;padding:0 20px;">
            <div style="border-top:3px solid #FFB433;"></div>
          </td>
        </tr>

        <!-- HEADLINE (stacked for mobile) -->
        <tr>
          <td style="background:#ffffff;padding:15px 20px 5px;font-family:'Inter',sans-serif;color:#515856;font-size:14px;line-height:150%;font-weight:700;font-style:italic;text-align:center;">
            Abundance Breakthrough: Journey with Your Coach
          </td>
        </tr>

        <!-- CTA BUTTON -->
        <tr>
          <td style="background:#ffffff;padding:8px 20px 15px;text-align:center;">
            <a href="${trackBase}/email-track?t=click&id=${trackId}&url=${encodeURIComponent(RAZORPAY_URL)}" target="_blank" style="display:inline-block;background:#FFB433;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;font-family:'Inter',sans-serif;letter-spacing:0.025em;text-align:center;line-height:1.3;">
              BOOK YOUR LIFE UPGRADE CALL
            </a>
          </td>
        </tr>

        <!-- WHITE BODY -->
        <tr>
          <td style="background:#ffffff;padding:10px 20px 30px;font-family:'Inter',sans-serif;color:#515856;font-size:15px;line-height:165%;border-radius:0 0 12px 12px;">
            ${body}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="text-align:center;padding:20px;font-size:11px;color:#999;font-family:'Inter',sans-serif;">
            <p style="margin:0 0 4px;">Indian Transformation Academy | Coach Your Coach</p>
            <p style="margin:0;"><a href="${trackBase}/email-track?t=unsub&email=${encodeURIComponent(email)}" style="color:#999;text-decoration:underline;">Unsubscribe</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
  ${openPixel}
</body>
</html>`;
}
