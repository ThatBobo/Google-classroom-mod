import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// OAuth provider configurations (server-side secrets)
const OAUTH_CONFIGS: Record<
  string,
  { tokenUrl: string; clientIdEnv: string; clientSecretEnv: string; extraHeaders?: Record<string, string> }
> = {
  github: {
    tokenUrl: "https://github.com/login/oauth/access_token",
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
    extraHeaders: { Accept: "application/json" },
  },
  slack: {
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
  },
  discord: {
    tokenUrl: "https://discord.com/api/oauth2/token",
    clientIdEnv: "DISCORD_CLIENT_ID",
    clientSecretEnv: "DISCORD_CLIENT_SECRET",
  },
  notion: {
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    clientIdEnv: "NOTION_CLIENT_ID",
    clientSecretEnv: "NOTION_CLIENT_SECRET",
  },
  google: {
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const { code, provider, redirect_uri, class_id } = await req.json();

    if (!code || !provider) {
      return new Response(JSON.stringify({ error: "Missing code or provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = OAUTH_CONFIGS[provider.toLowerCase()];
    if (!config) {
      return new Response(JSON.stringify({ error: `Unsupported OAuth provider: ${provider}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get(config.clientIdEnv);
    const clientSecret = Deno.env.get(config.clientSecretEnv);

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: `OAuth credentials not configured for ${provider}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange code for tokens
    const body: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    };
    if (redirect_uri) body.redirect_uri = redirect_uri;

    let tokenRes: Response;

    if (provider.toLowerCase() === "discord") {
      // Discord requires form-encoded
      tokenRes = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", ...(config.extraHeaders ?? {}) },
        body: new URLSearchParams(body).toString(),
      });
    } else if (provider.toLowerCase() === "notion") {
      // Notion uses Basic auth
      const encoded = btoa(`${clientId}:${clientSecret}`);
      tokenRes = await fetch(config.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${encoded}`,
        },
        body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri }),
      });
    } else {
      tokenRes = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(config.extraHeaders ?? {}) },
        body: JSON.stringify(body),
      });
    }

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token ?? null;
    const expiresIn = tokenData.expires_in;
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // Store integration
    const { data: integration, error: insertError } = await supabase
      .from("integrations")
      .insert({
        user_id: userId,
        class_id: class_id || null,
        provider: provider.toLowerCase(),
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
        auth_method: "oauth",
        status: "active",
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: "Failed to store integration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the event
    await supabase.from("integration_logs").insert({
      integration_id: integration.id,
      log_data: {
        event: "oauth_connected",
        timestamp: new Date().toISOString(),
        provider: provider.toLowerCase(),
        has_refresh_token: !!refreshToken,
        expires_at: expiresAt,
      },
    });

    return new Response(JSON.stringify({ success: true, integration_id: integration.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
