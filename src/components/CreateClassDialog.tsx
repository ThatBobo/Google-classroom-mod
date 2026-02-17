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

interface CreateClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const CreateClassDialog = ({ open, onOpenChange, onCreated }: CreateClassDialogProps) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("");
  const [room, setRoom] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);
    const { error } = await supabase.from("classes").insert({
      name: name.trim(),
      section: section.trim() || null,
      subject: subject.trim() || null,
      room: room.trim() || null,
      owner_id: user.id,
    });

    if (error) {
      toast.error("Failed to create class");
    } else {
      // Also add owner as teacher in class_members
      const { data: classData } = await supabase
        .from("classes")
        .select("id")
        .eq("owner_id", user.id)
        .eq("name", name.trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (classData) {
        await supabase.from("class_members").insert({
          class_id: classData.id,
          user_id: user.id,
          role: "teacher",
        });
      }

      toast.success("Class created!");
      setName("");
      setSection("");
      setSubject("");
      setRoom("");
      onOpenChange(false);
      onCreated();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Create class</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="class-name">Class name (required)</Label>
            <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics 101" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="section">Section</Label>
            <Input id="section" value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. Period 2" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Algebra" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="room">Room</Label>
            <Input id="room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room 204" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateClassDialog;
