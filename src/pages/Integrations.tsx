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
import { Plug, Plus, Trash2, RefreshCw, ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Integration {
  id: string;
  provider: string;
  status: string;
  url: string | null;
  created_at: string;
}

const Integrations = () => {
  const { id: classId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  

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

  const handleAdd = async () => {
    if (!provider.trim() || !user || !classId) return;
    setAdding(true);

    // Determine URL: Opix has no URL
    const isOpix = provider.trim().toLowerCase() === "opix";
    const integrationUrl = isOpix ? null : url.trim() || null;

    const { error } = await supabase.from("integrations").insert({
      user_id: user.id,
      class_id: classId,
      provider: provider.trim(),
      api_key_encrypted: apiKey.trim() || null,
      url: integrationUrl,
    });

    if (error) {
      toast.error("Failed to add integration");
      setAdding(false);
      return;
    }

    toast.success("Integration added!");
    setProvider("");
    setApiKey("");
    setUrl("");
    setSearchParams({}); // Remove ?new=true
    fetchIntegrations();
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("integrations").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Integration removed");
      fetchIntegrations();
    }
  };

  const handleToggleStatus = async (id: string, current: string) => {
    const newStatus = current === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("integrations")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) toast.error("Failed to update");
    else fetchIntegrations();
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
          /* New integration form */
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
            {provider.trim().toLowerCase() !== "opix" && (
              <div className="space-y-2">
                <Label htmlFor="url">Integration URL</Label>
                <Input
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}
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
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSearchParams({})}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={!provider.trim() || adding}>
                {adding ? "Adding..." : "Add Integration"}
              </Button>
            </div>
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
                          onClick={() => handleToggleStatus(integ.id, integ.status)}
                          title={integ.status === "active" ? "Deactivate" : "Activate"}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(integ.id)}
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
    </div>
  );
};

export default Integrations;
