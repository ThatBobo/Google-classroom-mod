import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plug, Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Integration {
  id: string;
  provider: string;
  status: string;
  created_at: string;
}

interface IntegrationLog {
  id: string;
  log_data: any;
  created_at: string;
}

const Integrations = () => {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("integrations")
      .select("id, provider, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setIntegrations(data ?? []);
    setLoading(false);
  };

  const fetchLogs = async (integrationId: string) => {
    const { data } = await supabase
      .from("integration_logs")
      .select("id, log_data, created_at")
      .eq("integration_id", integrationId)
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs(data ?? []);
    setSelectedId(integrationId);
  };

  useEffect(() => {
    fetchIntegrations();
  }, [user]);

  const handleAdd = async () => {
    if (!provider.trim() || !user) return;
    setAdding(true);
    const { error } = await supabase.from("integrations").insert({
      user_id: user.id,
      provider: provider.trim(),
      api_key_encrypted: apiKey.trim() || null,
    });
    if (error) toast.error("Failed to add integration");
    else {
      toast.success("Integration added!");
      setProvider("");
      setApiKey("");
      setAddOpen(false);
      fetchIntegrations();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("integrations").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Integration removed");
      if (selectedId === id) { setSelectedId(null); setLogs([]); }
      fetchIntegrations();
    }
  };

  const handleToggleStatus = async (id: string, current: string) => {
    const newStatus = current === "active" ? "inactive" : "active";
    const { error } = await supabase.from("integrations").update({ status: newStatus }).eq("id", id);
    if (error) toast.error("Failed to update");
    else fetchIntegrations();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onCreateClass={() => {}} onJoinClass={() => {}} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Plug className="h-6 w-6 text-primary" /> Integrations
          </h1>
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add Integration
          </Button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-muted-foreground">Loading...</p>
        ) : integrations.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Plug className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No integrations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect external services like Opix and more.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {integrations.map((integ) => (
              <Card key={integ.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plug className="h-5 w-5 text-primary" />
                    <span className="font-display font-semibold text-foreground">{integ.provider}</span>
                  </div>
                  <Badge variant={integ.status === "active" ? "default" : "secondary"}>
                    {integ.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Added {new Date(integ.created_at).toLocaleDateString()}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleToggleStatus(integ.id, integ.status)}>
                    <RefreshCw className="mr-1 h-3 w-3" />
                    {integ.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => fetchLogs(integ.id)}>
                    View Logs
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(integ.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Logs section */}
        {selectedId && (
          <div className="mt-8">
            <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
              Logs for {integrations.find((i) => i.id === selectedId)?.provider}
            </h2>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No logs yet</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <Card key={log.id} className="p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                    <pre className="text-xs text-foreground overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(log.log_data, null, 2)}
                    </pre>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Add Integration</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider name</Label>
                <Input
                  id="provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="e.g. Opix, Slack, Zoom"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key (optional)</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API key"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={!provider.trim() || adding}>
                {adding ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Integrations;
