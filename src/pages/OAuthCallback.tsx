import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const exchangeCode = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (!code || !state) {
        setStatus("error");
        setErrorMsg("Missing authorization code or state");
        return;
      }

      let parsed: { provider: string; class_id: string; redirect_uri: string };
      try {
        parsed = JSON.parse(atob(state));
      } catch {
        setStatus("error");
        setErrorMsg("Invalid state parameter");
        return;
      }

      const { data, error } = await supabase.functions.invoke("oauth-exchange", {
        body: {
          code,
          provider: parsed.provider,
          redirect_uri: parsed.redirect_uri,
          class_id: parsed.class_id,
        },
      });

      if (error || data?.error) {
        setStatus("error");
        setErrorMsg(data?.error || error?.message || "OAuth exchange failed");
        return;
      }

      setStatus("success");
      setTimeout(() => {
        navigate(`/class/${parsed.class_id}/integrations`);
      }, 1500);
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="text-foreground font-medium">Connecting integration...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="text-foreground font-medium">Connected! Redirecting...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <p className="text-foreground font-medium">Connection failed</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
