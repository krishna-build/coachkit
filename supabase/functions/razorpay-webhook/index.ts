import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-razorpay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") || "";

    // Verify signature using Web Crypto
    if (signature) {
      const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
      const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
      if (signature !== expectedSig) {
        console.error("Invalid Razorpay signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: corsHeaders });
      }
    }

    const payload = JSON.parse(body);
    const event = payload.event;

    // Process payment.captured and payment.failed
    if (event !== "payment.captured" && event !== "payment.failed") {
      return new Response(JSON.stringify({ status: "ignored", event }), { headers: corsHeaders });
    }

    // ─── PAYMENT FAILED → Enroll in Payment Recovery sequence ───
    if (event === "payment.failed") {
      const failedPayment = payload.payload?.payment?.entity;
      if (!failedPayment || failedPayment.amount !== 29900) {
        return new Response(JSON.stringify({ status: "ignored", reason: "not ₹299" }), { headers: corsHeaders });
      }

      const failedEmail = (failedPayment.email || "").toLowerCase().trim();
      const failedPhone = failedPayment.contact || "";
      const failedName = failedPayment.notes?.name || failedPayment.notes?.full_name || failedEmail.split("@")[0];
      console.log(`Payment FAILED: ${failedEmail} | ₹299 | ${failedPayment.error_description}`);

      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Check if they already paid successfully (don't send recovery email to paid users)
      const { data: existingContact } = await supabase
        .from("automation_contacts").select("id, paid_299").eq("email", failedEmail).maybeSingle();

      if (existingContact?.paid_299) {
        console.log(`${failedEmail} already paid — skipping recovery`);
        return new Response(JSON.stringify({ status: "skipped", reason: "already paid" }), { headers: corsHeaders });
      }

      // Find or create contact
      let contactId: string;
      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const { data: newContact } = await supabase.from("automation_contacts").insert({
          email: failedEmail, phone: failedPhone || null, first_name: failedName,
          tags: ["lead", "payment-failed"], source: "razorpay-failed"
        }).select().single();
        contactId = newContact!.id;
      }

      // Find the Payment Recovery sequence
      const { data: recoverySeq } = await supabase
        .from("automation_sequences").select("id")
        .eq("trigger_tag", "payment-failed").eq("status", "active").maybeSingle();

      if (recoverySeq) {
        // Check if already enrolled in this sequence
        const { data: alreadyEnrolled } = await supabase
          .from("automation_sequence_enrollments").select("id")
          .eq("contYOUR_AD_ACCOUNT_IDid", contactId).eq("sequence_id", recoverySeq.id)
          .in("status", ["active"]).maybeSingle();

        if (!alreadyEnrolled) {
          // Enroll — first email sends after 1 hour (wait_hours of step 1)
          const nextSendAt = new Date(Date.now() + 1 * 3600000).toISOString();
          await supabase.from("automation_sequence_enrollments").insert({
            contYOUR_AD_ACCOUNT_IDid: contactId, sequence_id: recoverySeq.id,
            current_step: 1, status: "active", next_send_at: nextSendAt
          });
          console.log(`Enrolled ${failedEmail} in Payment Recovery — sends in 1 hour`);
        } else {
          console.log(`${failedEmail} already enrolled in Payment Recovery — skipping`);
        }
      }

      // Log the failed webhook
      await supabase.from("automation_webhook_log").insert({
        source: "razorpay", contYOUR_AD_ACCOUNT_IDid: contactId,
        payload: { event, email: failedEmail, phone: failedPhone, amount: 299, error: failedPayment.error_description },
        action_taken: "payment-failed, enrolled in recovery", processed: true
      });

      return new Response(JSON.stringify({ status: "ok", action: "payment-recovery-enrolled", email: failedEmail }), { headers: corsHeaders });
    }

    const payment = payload.payload?.payment?.entity;
    if (!payment) {
      return new Response(JSON.stringify({ error: "No payment entity" }), { status: 400, headers: corsHeaders });
    }

    const email = (payment.email || "").toLowerCase().trim();
    const phone = payment.contact || "";
    const name = payment.notes?.name || payment.notes?.full_name || "";
    const amount = payment.amount / 100; // Razorpay sends in paise
    const paymentId = payment.id;
    const notes = payment.notes || {};

    console.log(`Payment captured: ${email} | ₹${amount} | ${paymentId}`);

    // Init Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Log the webhook
    await supabase.from("automation_webhook_log").insert({
      source: "razorpay",
      payload: { event, payment_id: paymentId, email, phone, amount, notes },
      action_taken: "processing",
      processed: false,
    });

    // Find or create contact
    let contact;
    const { data: existing } = await supabase
      .from("automation_contacts")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    // Determine payment type based on amount
    const isHigherTicket = amount > 500; // ₹299 is the only small payment; anything above ₹500 is higher ticket
    const is299 = amount <= 500;
    const paymentTag = isHigherTicket ? "higher-ticket" : "paid-299";

    console.log(`Payment type: ${paymentTag} (₹${amount})`);

    if (existing) {
      // Update existing contact
      const updatedTags = Array.from(new Set([...(existing.tags || []), paymentTag]));

      const updateData: Record<string, any> = {
        tags: updatedTags,
        razorpay_payment_id: paymentId,
        phone: existing.phone || phone || null,
        updated_at: new Date().toISOString(),
      };

      if (is299) {
        updateData.paid_299 = true;
        updateData.paid_299_at = new Date().toISOString();
      }

      if (isHigherTicket) {
        updateData.purchased_50k = true;
        updateData.purchased_50k_at = new Date().toISOString();
        updateData.higher_ticket_amount = amount;
        // Try to extract program name from notes
        updateData.higher_ticket_source = "Razorpay";
        if (notes.program || notes.product) {
          updateData.higher_ticket_program = notes.program || notes.product;
        }
      }

      const { data: updated } = await supabase
        .from("automation_contacts")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single();
      contact = updated;
    } else {
      // Create new contact
      const insertData: Record<string, any> = {
        email,
        phone: phone || null,
        first_name: notes.name || email.split("@")[0],
        tags: ["lead", paymentTag],
        razorpay_payment_id: paymentId,
        source: "razorpay",
      };

      if (is299) {
        insertData.paid_299 = true;
        insertData.paid_299_at = new Date().toISOString();
      }

      if (isHigherTicket) {
        insertData.purchased_50k = true;
        insertData.purchased_50k_at = new Date().toISOString();
        insertData.higher_ticket_amount = amount;
        insertData.higher_ticket_source = "Razorpay";
        if (notes.program || notes.product) {
          insertData.higher_ticket_program = notes.program || notes.product;
        }
      }

      const { data: created } = await supabase
        .from("automation_contacts")
        .insert(insertData)
        .select()
        .single();
      contact = created;
    }

    // Stop Sequence 1 (payment reminders) if enrolled
    if (contact) {
      await supabase
        .from("automation_sequence_enrollments")
        .update({ status: "stopped" })
        .eq("contYOUR_AD_ACCOUNT_IDid", contact.id)
        .eq("status", "active");

      // Update webhook log
      await supabase
        .from("automation_webhook_log")
        .update({ contYOUR_AD_ACCOUNT_IDid: contact.id, action_taken: `tagged ${paymentTag} (₹${amount}), contact ${contact.id}`, processed: true })
        .eq("processed", false)
        .eq("source", "razorpay")
        .order("created_at", { ascending: false })
        .limit(1);
    }

    // ─── UTM VISITOR MATCHING ───
    // Match this payment with the most recent utm_visitor (within last 24 hours)
    // who hasn't been matched yet — ties the ad click to the payment
    try {
      // IDEMPOTENCY: Skip if this payment was already matched
      const { data: alreadyMatched } = await supabase
        .from("utm_visitors")
        .select("id")
        .eq("razorpay_payment_id", paymentId)
        .limit(1);

      if (alreadyMatched && alreadyMatched.length > 0) {
        console.log(`Payment ${paymentId} already matched — skipping duplicate webhook`);
      } else {

      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentVisitors } = await supabase
        .from("utm_visitors")
        .select("*")
        .is("razorpay_payment_id", null)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(20);

      if (recentVisitors && recentVisitors.length > 0) {
        // Match the most recent unmatched visitor (closest in time to payment)
        const visitor = recentVisitors[0];

        // Resolve ad IDs to human-readable names
        let adName = visitor.utm_content || "";
        let campaignName = visitor.utm_campaign || "";
        let adsetName = visitor.utm_term || "";
        if (adName && /^\d+$/.test(adName)) {
          const { data: lookup } = await supabase.from("ad_lookup").select("*").eq("ad_id", adName).maybeSingle();
          if (lookup) {
            adName = lookup.ad_name;
            campaignName = lookup.campaign_name || campaignName;
            adsetName = lookup.adset_name || adsetName;
          }
        }

        await supabase
          .from("utm_visitors")
          .update({
            razorpay_payment_id: paymentId,
            customer_name: name || email.split("@")[0],
            customer_email: email,
            customer_phone: phone,
            amount,
            payment_status: "captured",
            matched_at: new Date().toISOString(),
            utm_content: adName, // Replace ID with readable name
            utm_campaign: campaignName,
            utm_term: adsetName,
          })
          .eq("id", visitor.id);

        console.log(`UTM matched: ${email} → ${adName} | ${campaignName} (${visitor.city})`);

        // Also update the automation contact with UTM source data
        if (contact) {
          await supabase
            .from("automation_contacts")
            .update({
              utm_source: visitor.utm_source,
              utm_campaign: visitor.utm_campaign,
              utm_content: visitor.utm_content,
              utm_term: visitor.utm_term,
              city: visitor.city,
              region: visitor.region,
              device: visitor.device,
            })
            .eq("id", contact.id);
        }
      } else {
        console.log(`No UTM visitor to match for ${email} — direct visit or cookie cleared`);
      }
      } // end idempotency else
    } catch (utmErr) {
      console.error("UTM matching error:", utmErr);
      // Don't fail the webhook if UTM matching fails
    }

    // ─── META CONVERSIONS API (Server-Side Purchase Tracking) ───
    // This is the ONLY source of truth for purchase events.
    // Razorpay client-side pixel has been DISABLED to prevent duplicates.
    // Only real, confirmed payments reach this webhook.
    const pixelId = Deno.env.get("META_PIXEL_ID");
    const metaToken = Deno.env.get("CLIENT_META_ACCESS_TOKEN");
    if (pixelId && metaToken) {
      try {
        // Unique event ID for deduplication (prevents any double-counting)
        const eventId = `purchase_${paymentId}`;
        const eventTime = Math.floor(Date.now() / 1000);

        const eventData = {
          data: [{
            event_name: "Purchase",
            event_id: eventId,
            event_time: eventTime,
            event_source_url: "https://pages.razorpay.com/your-page-id/view",
            action_source: "website",
            user_data: {
              em: [await sha256(email)],
              ph: phone ? [await sha256(phone.replace(/\D/g, "").replace(/^0+/, ""))] : [],
              country: [await sha256("in")],
            },
            custom_data: {
              currency: "INR",
              value: amount,
              content_name: "1:1 Clarity Call",
              content_type: "product",
              order_id: paymentId,
            },
          }],
          access_token: metaToken,
        };

        const capiResp = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventData),
        });
        const capiResult = await capiResp.json();
        console.log(`Meta CAPI Purchase sent: ${eventId} | ₹${amount} | ${email} | Response:`, JSON.stringify(capiResult));
      } catch (e) {
        console.error("Meta CAPI error:", e);
        // Don't fail the webhook if CAPI fails — payment is still valid
      }
    }

    return new Response(
      JSON.stringify({ status: "ok", contYOUR_AD_ACCOUNT_IDid: contact?.id, email, amount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});

// SHA256 hash for Meta CAPI user data
async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.toLowerCase().trim());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
