import { createClient } from "npm:@supabase/supabase-js@2.118.0";

Deno.serve(async (request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (
    request.method !== "POST" ||
    !serviceKey ||
    request.headers.get("Authorization") !== `Bearer ${serviceKey}`
  )
    return new Response("Unauthorized", { status: 401 });
  if (Deno.env.get("NOTIFICATIONS_ENABLED") !== "true")
    return Response.json({ enabled: false, processed: 0 });
  const apiKey = Deno.env.get("RESEND_API_KEY"),
    from = Deno.env.get("RESEND_FROM"),
    appUrl = Deno.env.get("APP_URL");
  if (!apiKey || !from || !appUrl || !appUrl.startsWith("https://"))
    return Response.json(
      { error: "Email configuration incomplete" },
      { status: 503 },
    );
  const client = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: jobs, error } = await client.rpc("lr_claim_notifications", {
    p_limit: 10,
  });
  if (error)
    return Response.json({ error: "Queue unavailable" }, { status: 503 });
  let processed = 0;
  for (const job of jobs || []) {
    const { data: email, error: denied } = await client.rpc(
      "lr_authorize_delivery",
      { p_id: job.id, p_lease: job.lease_token },
    );
    if (denied || !email) continue;
    const testRecipient = Deno.env.get("RESEND_TEST_RECIPIENT");
    if (
      (testRecipient && email.toLowerCase() !== testRecipient.toLowerCase()) ||
      (/@resend\.dev>?$/i.test(from) &&
        (!testRecipient || email.toLowerCase() !== testRecipient.toLowerCase()))
    ) {
      await client.rpc("lr_finish_delivery", {
        p_id: job.id,
        p_lease: job.lease_token,
        p_success: false,
        p_status: 403,
      });
      continue;
    }
    let success = false,
      status = 0;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `lawroom/${job.event_key}`,
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "Lawroom’da yeni bir gelişme var",
          text: `Lawroom çalışma alanınızda yeni bir gelişme var. İncelemek için güvenli bağlantıyı açın: ${appUrl}`,
        }),
        signal: AbortSignal.timeout(15000),
      });
      success = response.ok;
      status = response.status;
    } catch {
      /* No recipient, token, provider payload or legal content is logged. */
    }
    const { error: finishError } = await client.rpc("lr_finish_delivery", {
      p_id: job.id,
      p_lease: job.lease_token,
      p_success: success,
      p_status: status,
    });
    if (!finishError && success) processed++;
  }
  return Response.json({ enabled: true, processed });
});
