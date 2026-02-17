import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface JoinClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined: () => void;
}

const JoinClassDialog = ({ open, onOpenChange, onJoined }: JoinClassDialogProps) => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!code.trim() || !user) return;
    setLoading(true);

    const { data: classData, error: findError } = await supabase
      .from("classes")
      .select("id")
      .eq("class_code", code.trim())
      .single();

    if (findError || !classData) {
      toast.error("Class not found. Check the code and try again.");
      setLoading(false);
      return;
    }

    const { error: joinError } = await supabase.from("class_members").insert({
      class_id: classData.id,
      user_id: user.id,
      role: "student",
    });

    if (joinError) {
      if (joinError.code === "23505") {
        toast.error("You've already joined this class.");
      } else {
        toast.error("Failed to join class.");
      }
    } else {
      toast.success("Joined class!");
      setCode("");
      onOpenChange(false);
      onJoined();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Join class</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="class-code">Class code</Label>
            <Input
              id="class-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter class code"
            />
            <p className="text-sm text-muted-foreground">
              Ask your teacher for the class code, then enter it here.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleJoin} disabled={!code.trim() || loading}>
            {loading ? "Joining..." : "Join"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JoinClassDialog;
