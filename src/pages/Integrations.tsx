import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plug, Plus, Trash2, RefreshCw, ArrowLeft, ExternalLink, ScrollText, CheckCircle2, XCircle, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";

interface Integration {
  id: string;
  provider: string;
  status: string;
  url: string | null;
  created_at: string;
}

interface IntegrationLog {
  id: string;
  log_data: Record<string, any>;
  created_at: string;
}

type CredentialField = {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  type?: "text" | "password";
  validate?: (value: string) => string | null;
};

const PROVIDER_CREDENTIALS: Record<string, CredentialField[]> = {
  supabase: [
    { key: "project_url", label: "Project URL", placeholder: "https://xxxxx.supabase.co", required: true, type: "text",
      validate: (v) => v.match(/^https:\/\/.*\.supabase\.co\/?$/) ? null : "Must be a valid Supabase project URL (https://xxx.supabase.co)" },
    { key: "anon_key", label: "Anon Key", placeholder: "eyJhbGciOiJIUzI1NiIs...", required: true, type: "password",
      validate: (v) => v.startsWith("eyJ") && v.length > 30 ? null : "Must be a valid JWT anon key" },
  ],
  opix: [
    { key: "client_id", label: "Client ID", placeholder: "Paste Client ID from Opix Authorizations", required: true, type: "text",
      validate: (v) => v.length >= 10 ? null : "Must be a valid Client ID from Opix Authorizations" },
    { key: "api_key", label: "API Key", placeholder: "opx_xxxxxxxxxxxxxxxx", required: true, type: "password",
      validate: (v) => v.startsWith("opx_") && v.length >= 16 ? null : "Must start with opx_ and be at least 16 characters" },
    { key: "redirect_uri", label: "Redirect URI (optional)", placeholder: "https://yourapp.com/callback", required: false, type: "text" },
  ],
  github: [
    { key: "access_token", label: "Personal Access Token", placeholder: "ghp_xxxxxxxxxxxxxxxx", required: true, type: "password",
      validate: (v) => v.startsWith("ghp_") || v.startsWith("github_pat_") ? null : "Must be a valid GitHub token (ghp_ or github_pat_)" },
  ],
  openai: [
    { key: "api_key", label: "API Key", placeholder: "sk-xxxxxxxxxxxxxxxx", required: true, type: "password",
      validate: (v) => v.startsWith("sk-") && v.length > 20 ? null : "Must be a valid OpenAI API key (sk-...)" },
  ],
  stripe: [
    { key: "api_key", label: "Secret Key", placeholder: "sk_live_xxxxxxxx or sk_test_xxxxxxxx", required: true, type: "password",
      validate: (v) => v.startsWith("sk_") ? null : "Must be a valid Stripe secret key (sk_...)" },
  ],
  discord: [
    { key: "bot_token", label: "Bot Token", placeholder: "Enter bot token", required: true, type: "password" },
    { key: "webhook_url", label: "Webhook URL (optional)", placeholder: "https://discord.com/api/webhooks/...", required: false, type: "text" },
  ],
  slack: [
    { key: "bot_token", label: "Bot Token", placeholder: "xoxb-xxxxxxxx", required: true, type: "password",
      validate: (v) => v.startsWith("xoxb-") ? null : "Must be a valid Slack bot token (xoxb-...)" },
    { key: "webhook_url", label: "Webhook URL (optional)", placeholder: "https://hooks.slack.com/services/...", required: false, type: "text" },
  ],
};

const getProviderCredentials = (provider: string): CredentialField[] => {
  const key = provider.trim().toLowerCase();
  return PROVIDER_CREDENTIALS[key] ?? [
    { key: "api_key", label: "API Key (optional)", placeholder: "Enter API key or token", required: false, type: "password" },
  ];
};

// OAuth provider configurations (client-side — only public info)
type OAuthProviderConfig = {
  authUrl: string;
  scopes: string[];
};

const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    scopes: ["repo", "user"],
  },
  slack: {
    authUrl: "https://slack.com/oauth/v2/authorize",
    scopes: ["chat:write", "channels:read"],
  },
  discord: {
    authUrl: "https://discord.com/api/oauth2/authorize",
    scopes: ["identify", "guilds"],
  },
  notion: {
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    scopes: [],
  },
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: ["https://www.googleapis.com/auth/userinfo.email"],
  },
};

const isOAuthProvider = (provider: string): boolean =>
  Object.keys(OAUTH_PROVIDERS).includes(provider.trim().toLowerCase());

const PROVIDER_URLS: Record<string, string> = {
  supabase: "https://supabase.com",
  github: "https://github.com",
  lovable: "https://lovable.dev",
  slack: "https://slack.com",
  zoom: "https://zoom.us",
  notion: "https://notion.so",
  discord: "https://discord.com",
  google: "https://google.com",
  figma: "https://figma.com",
  linear: "https://linear.app",
  jira: "https://atlassian.net",
  trello: "https://trello.com",
  asana: "https://asana.com",
  vercel: "https://vercel.com",
  netlify: "https://netlify.com",
  stripe: "https://stripe.com",
  twilio: "https://twilio.com",
  sendgrid: "https://sendgrid.com",
  openai: "https://openai.com",
  anthropic: "https://anthropic.com",
  opix: "https://opix-io.lovable.app",
};

const getProviderUrl = (name: string): string | null => {
  const key = name.trim().toLowerCase();
  return PROVIDER_URLS[key] ?? null;
};

const isOpixProvider = (name: string) => name.trim().toLowerCase() === "opix";

const validateOpixKey = (key: string): boolean => {
  return key.startsWith("opx_") && key.length >= 16;
};

const logIntegrationEvent = async (
  integrationId: string,
  eventType: string,
  details: Record<string, any> = {}
) => {
  await supabase.from("integration_logs").insert({
    integration_id: integrationId,
    log_data: {
      event: eventType,
      timestamp: new Date().toISOString(),
      ...details,
    },
  });
};

const Integrations = () => {
  const { id: classId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const isNew = searchParams.get("new") === "true";

  const fetchIntegrations = async () => {
    if (!user || !classId) return;
    setLoading(true);
    const { data } = await supabase
      .from("integrations")
      .select("id, provider, status, url, created_at")
      .eq("user_id", user.id)
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    setIntegrations(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchIntegrations();
  }, [user, classId]);

  // Validate credentials on change
  const credentialFields = getProviderCredentials(provider);
  
  useEffect(() => {
    if (!provider.trim()) {
      setFieldErrors({});
      return;
    }
    const errors: Record<string, string | null> = {};
    const timeout = setTimeout(() => {
      for (const field of credentialFields) {
        const val = (credentials[field.key] ?? "").trim();
        if (val && field.validate) {
          errors[field.key] = field.validate(val);
        } else {
          errors[field.key] = null;
        }
      }
      setFieldErrors(errors);
    }, 400);
    return () => clearTimeout(timeout);
  }, [credentials, provider]);

  const allRequiredValid = () => {
    const fields = getProviderCredentials(provider);
    for (const field of fields) {
      const val = (credentials[field.key] ?? "").trim();
      if (field.required && !val) return false;
      if (val && field.validate && field.validate(val) !== null) return false;
    }
    return true;
  };

  const handleAdd = async () => {
    if (!provider.trim() || !user || !classId) return;

    const fields = getProviderCredentials(provider);
    // Validate required fields
    for (const field of fields) {
      const val = (credentials[field.key] ?? "").trim();
      if (field.required && !val) {
        toast.error(`${field.label} is required`);
        return;
      }
      if (val && field.validate) {
        const err = field.validate(val);
        if (err) {
          toast.error(err);
          return;
        }
      }
    }

    setAdding(true);
    const integrationUrl = getProviderUrl(provider);

    // Store all credentials as JSON in api_key_encrypted
    const credentialData = Object.fromEntries(
      Object.entries(credentials).filter(([_, v]) => v.trim())
    );

    const { data, error } = await supabase.from("integrations").insert({
      user_id: user.id,
      class_id: classId,
      provider: provider.trim(),
      api_key_encrypted: Object.keys(credentialData).length > 0 ? JSON.stringify(credentialData) : null,
      url: integrationUrl,
    }).select().single();

    if (error) {
      toast.error("Failed to add integration");
      setAdding(false);
      return;
    }

    if (data) {
      await logIntegrationEvent(data.id, "created", {
        provider: provider.trim(),
        credentials_provided: Object.keys(credentialData),
        url: integrationUrl,
      });
    }

    toast.success("Integration added!");
    setProvider("");
    setCredentials({});
    setFieldErrors({});
    setSearchParams({});
    fetchIntegrations();
    setAdding(false);
  };

  const handleDelete = async (id: string, providerName: string) => {
    // Log before deleting
    await logIntegrationEvent(id, "deleted", { provider: providerName });

    const { error } = await supabase.from("integrations").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Integration removed");
      fetchIntegrations();
    }
  };

  const handleToggleStatus = async (id: string, current: string, providerName: string) => {
    const newStatus = current === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("integrations")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update");
    } else {
      await logIntegrationEvent(id, "status_changed", {
        provider: providerName,
        old_status: current,
        new_status: newStatus,
      });
      fetchIntegrations();
    }
  };

  const openLogs = async (integration: Integration) => {
    setSelectedIntegration(integration);
    setLogsDialogOpen(true);
    setLogsLoading(true);

    const { data } = await supabase
      .from("integration_logs")
      .select("id, log_data, created_at")
      .eq("integration_id", integration.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setLogs((data as IntegrationLog[]) ?? []);
    setLogsLoading(false);
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case "created":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case "deleted":
        return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      case "status_changed":
        return <RefreshCw className="h-3.5 w-3.5 text-primary" />;
      default:
        return <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <div className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/class/${classId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" /> Integrations
        </h1>
        <div className="ml-auto flex items-center gap-3">
          {!isNew && (
            <Button size="sm" onClick={() => setSearchParams({ new: "true" })}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {isNew ? (
          <Card className="mx-auto max-w-lg p-6 space-y-5">
            <h2 className="font-display text-xl font-bold text-foreground">Add Integration</h2>
            <div className="space-y-2">
              <Label htmlFor="provider">Provider name *</Label>
              <Input
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. Opix, Slack, Zoom"
              />
            </div>
            {provider.trim() && getProviderUrl(provider) && (
              <div className="space-y-2">
                <Label>Integration URL (auto-detected)</Label>
                <p className="text-sm text-muted-foreground rounded-md border border-border bg-muted px-3 py-2">
                  {getProviderUrl(provider)}
                </p>
              </div>
            )}

            {/* OAuth providers get a Connect button instead of credential fields */}
            {provider.trim() && isOAuthProvider(provider) ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">OAuth Authorization</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click "Connect" to securely authorize with {provider}. You'll be redirected to approve access, then returned here automatically.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setSearchParams({}); setCredentials({}); setFieldErrors({}); }}>
                    Cancel
                  </Button>
                  <Button onClick={() => {
                    const key = provider.trim().toLowerCase();
                    const oauthConfig = OAUTH_PROVIDERS[key];
                    if (!oauthConfig) return;

                    const redirectUri = `${window.location.origin}/oauth/callback`;
                    const state = btoa(JSON.stringify({
                      provider: key,
                      class_id: classId,
                      redirect_uri: redirectUri,
                    }));

                    const params = new URLSearchParams({
                      client_id: `CONFIGURE_${key.toUpperCase()}_CLIENT_ID`,
                      redirect_uri: redirectUri,
                      scope: oauthConfig.scopes.join(" "),
                      response_type: "code",
                      state,
                    });

                    window.location.href = `${oauthConfig.authUrl}?${params}`;
                  }}>
                    <Link2 className="mr-1 h-4 w-4" />
                    Connect {provider}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {provider.trim() && credentialFields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>
                      {field.label} {field.required && "*"}
                    </Label>
                    <div className="relative">
                      <Input
                        id={field.key}
                        type={field.type ?? "text"}
                        value={credentials[field.key] ?? ""}
                        onChange={(e) => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className={
                          (credentials[field.key] ?? "").trim() && field.validate
                            ? fieldErrors[field.key] === null
                              ? "border-primary pr-10"
                              : fieldErrors[field.key]
                              ? "border-destructive pr-10"
                              : "pr-10"
                            : ""
                        }
                      />
                      {(credentials[field.key] ?? "").trim() && field.validate && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                          {fieldErrors[field.key] === null ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : fieldErrors[field.key] ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </span>
                      )}
                    </div>
                    {fieldErrors[field.key] && (
                      <p className="text-xs text-destructive">{fieldErrors[field.key]}</p>
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setSearchParams({}); setFieldErrors({}); setCredentials({}); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAdd}
                    disabled={!provider.trim() || adding || !allRequiredValid()}
                  >
                    {adding ? "Adding..." : "Add Integration"}
                  </Button>
                </div>
              </>
            )}
          </Card>
        ) : loading ? (
          <p className="py-8 text-center text-muted-foreground">Loading...</p>
        ) : integrations.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Plug className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No integrations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add integrations to connect external services.
            </p>
            <Button className="mt-4" onClick={() => setSearchParams({ new: "true" })}>
              <Plus className="mr-1 h-4 w-4" /> Add Integration
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((integ) => (
                  <TableRow key={integ.id}>
                    <TableCell className="font-medium">{integ.provider}</TableCell>
                    <TableCell>
                      {integ.url ? (
                        <a
                          href={integ.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline text-sm"
                        >
                          {new URL(integ.url).hostname}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={integ.status === "active" ? "default" : "secondary"}>
                        {integ.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(integ.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openLogs(integ)}
                          title="View logs"
                        >
                          <ScrollText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(integ.id, integ.status, integ.provider)}
                          title={integ.status === "active" ? "Deactivate" : "Activate"}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(integ.id, integ.provider)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              {selectedIntegration?.provider} Logs
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2 pt-2">
            {logsLoading ? (
              <p className="py-4 text-center text-muted-foreground">Loading logs...</p>
            ) : logs.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">No logs yet</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <div className="mt-0.5">
                    {getEventIcon(log.log_data?.event)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground capitalize">
                        {log.log_data?.event ?? "unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    {log.log_data?.old_status && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {log.log_data.old_status} → {log.log_data.new_status}
                      </p>
                    )}
                    {log.log_data?.has_api_key !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1">
                        API key: {log.log_data.has_api_key ? "provided" : "none"}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Integrations;
