import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("APPROVAL_EMAIL_FROM") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !resendApiKey || !fromEmail) {
      return new Response(JSON.stringify({ error: "Missing required function env vars." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminRow, error: adminError } = await adminClient
      .from("admin_users")
      .select("auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (adminError || !adminRow) {
      return new Response(JSON.stringify({ error: "Admin access required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { toEmail, studentName, completionUrl, tokenExpiresAt } = await req.json();
    if (!toEmail || !completionUrl) {
      return new Response(JSON.stringify({ error: "toEmail and completionUrl are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = "Your GvlPolyMart Account is Approved";
    const safeName = studentName || "Student";
    const expiresText = tokenExpiresAt
      ? new Date(tokenExpiresAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      : "in 10 days";

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin-bottom: 8px;">Your GvlPolyMart account is approved</h2>
        <p>Hi ${safeName},</p>
        <p>Your registration has been approved by admin.</p>
        <p>Please complete signup by setting your password:</p>
        <p style="margin: 18px 0;">
          <a href="${completionUrl}" style="background:#4f46e5;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;">
            Complete Signup
          </a>
        </p>
        <p>This link expires on: <strong>${expiresText}</strong></p>
        <p>If the button doesn't work, copy and paste this URL:</p>
        <p style="word-break: break-all;">${completionUrl}</p>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const text = await resendResponse.text();
      return new Response(JSON.stringify({ error: `Email provider failed: ${text}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
