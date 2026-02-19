import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Copy, Send, Users, ClipboardList, Plus, FileText, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const ClassDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [classData, setClassData] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDesc, setAssignDesc] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [assignPoints, setAssignPoints] = useState("");
  const [creatingAssignment, setCreatingAssignment] = useState(false);

  useEffect(() => {
    if (!id || !user) return;

    const fetchAll = async () => {
      const [classRes, announcementsRes, assignmentsRes, membersRes] = await Promise.all([
        supabase.from("classes").select("*").eq("id", id).single(),
        supabase.from("announcements").select("*, profiles:author_id(display_name, avatar_url)").eq("class_id", id).order("created_at", { ascending: false }),
        supabase.from("assignments").select("*").eq("class_id", id).order("created_at", { ascending: false }),
        supabase.from("class_members").select("*, profiles:user_id(display_name, avatar_url)").eq("class_id", id),
      ]);

      if (classRes.data) {
        setClassData(classRes.data);
        setIsTeacher(classRes.data.owner_id === user.id);
      }
      setAnnouncements(announcementsRes.data ?? []);
      setAssignments(assignmentsRes.data ?? []);
      setMembers(membersRes.data ?? []);

      // Check if user is teacher via class_members
      const memberRole = membersRes.data?.find((m: any) => m.user_id === user.id);
      if (memberRole?.role === "teacher") setIsTeacher(true);

      setLoading(false);
    };
    fetchAll();

    // Realtime for announcements
    const channel = supabase
      .channel(`announcements-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements", filter: `class_id=eq.${id}` }, async () => {
        const { data } = await supabase.from("announcements").select("*, profiles:author_id(display_name, avatar_url)").eq("class_id", id).order("created_at", { ascending: false });
        setAnnouncements(data ?? []);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, user]);

  const postAnnouncement = async () => {
    if (!newAnnouncement.trim() || !user || !id) return;
    setPosting(true);
    const { error } = await supabase.from("announcements").insert({
      class_id: id,
      author_id: user.id,
      content: newAnnouncement.trim(),
    });
    if (error) toast.error("Failed to post");
    else setNewAnnouncement("");
    setPosting(false);
  };

  const createAssignment = async () => {
    if (!assignTitle.trim() || !user || !id) return;
    setCreatingAssignment(true);
    const { error } = await supabase.from("assignments").insert({
      class_id: id,
      created_by: user.id,
      title: assignTitle.trim(),
      description: assignDesc.trim() || null,
      due_date: assignDue ? new Date(assignDue).toISOString() : null,
      points: assignPoints ? parseInt(assignPoints) : null,
    });
    if (error) {
      toast.error("Failed to create assignment");
    } else {
      toast.success("Assignment created!");
      setAssignTitle("");
      setAssignDesc("");
      setAssignDue("");
      setAssignPoints("");
      setAssignDialogOpen(false);
      // Refresh assignments
      const { data } = await supabase.from("assignments").select("*").eq("class_id", id).order("created_at", { ascending: false });
      setAssignments(data ?? []);
    }
    setCreatingAssignment(false);
  };

  const copyClassCode = () => {
    if (classData?.class_code) {
      navigator.clipboard.writeText(classData.class_code);
      toast.success("Class code copied!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="mb-4 h-10 w-32" />
        <Skeleton className="mb-6 h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Class not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <div className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-lg font-semibold text-foreground">{classData.name}</h1>
      </div>

      {/* Banner */}
      <div
        className="relative mx-auto max-w-4xl px-4 pt-4"
      >
        <div className="overflow-hidden rounded-xl p-6" style={{ backgroundColor: classData.banner_color }}>
          <h2 className="font-display text-3xl font-bold text-white">{classData.name}</h2>
          {classData.section && <p className="mt-1 text-white/80">{classData.section}</p>}
          {classData.subject && <p className="text-sm text-white/70">{classData.subject}</p>}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-4">
        <Tabs defaultValue="stream">
          <TabsList className="w-full justify-start bg-transparent">
            <TabsTrigger value="stream" className="font-display">Stream</TabsTrigger>
            <TabsTrigger value="classwork" className="font-display">
              <ClipboardList className="mr-1 h-4 w-4" /> Classwork
            </TabsTrigger>
            <TabsTrigger value="people" className="font-display">
              <Users className="mr-1 h-4 w-4" /> People
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stream" className="space-y-4 pt-4">
            {/* Class code card */}
            {isTeacher && (
              <Card className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Class code</p>
                  <p className="font-display text-2xl font-bold text-primary">{classData.class_code}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={copyClassCode}>
                  <Copy className="h-5 w-5" />
                </Button>
              </Card>
            )}

            {/* Announce input */}
            {isTeacher && (
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile?.display_name?.charAt(0)?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      placeholder="Announce something to your class..."
                      value={newAnnouncement}
                      onChange={(e) => setNewAnnouncement(e.target.value)}
                      className="min-h-[80px] resize-none"
                    />
                    <div className="flex justify-end">
                      <Button onClick={postAnnouncement} disabled={!newAnnouncement.trim() || posting} size="sm">
                        <Send className="mr-1 h-4 w-4" /> Post
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Announcements */}
            {announcements.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No announcements yet</p>
            ) : (
              announcements.map((a) => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={a.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {a.profiles?.display_name?.charAt(0)?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{a.profiles?.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-foreground">{a.content}</p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="classwork" className="space-y-4 pt-4">
            {isTeacher && (
              <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Plus className="mr-1 h-4 w-4" /> Create Assignment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display">Create Assignment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="assign-title">Title *</Label>
                      <Input id="assign-title" placeholder="Assignment title" value={assignTitle} onChange={(e) => setAssignTitle(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assign-desc">Description</Label>
                      <Textarea id="assign-desc" placeholder="Instructions (optional)" value={assignDesc} onChange={(e) => setAssignDesc(e.target.value)} className="min-h-[80px]" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="assign-due">Due date</Label>
                        <Input id="assign-due" type="datetime-local" value={assignDue} onChange={(e) => setAssignDue(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assign-pts">Points</Label>
                        <Input id="assign-pts" type="number" min="0" placeholder="100" value={assignPoints} onChange={(e) => setAssignPoints(e.target.value)} />
                      </div>
                    </div>
                    <Button onClick={createAssignment} disabled={!assignTitle.trim() || creatingAssignment} className="w-full">
                      {creatingAssignment ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {assignments.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No assignments yet</p>
            ) : (
              assignments.map((a) => (
                <Card key={a.id} className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{a.title}</p>
                    {a.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      {a.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due {new Date(a.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                      {a.points != null && <span>{a.points} pts</span>}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="people" className="space-y-6 pt-4">
            <div>
              <h3 className="mb-3 font-display text-lg font-semibold text-foreground">Teachers</h3>
              <div className="space-y-2">
                {members.filter((m) => m.role === "teacher" || m.user_id === classData.owner_id).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {m.profiles?.display_name?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-foreground">{m.profiles?.display_name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 font-display text-lg font-semibold text-foreground">Students</h3>
              <div className="space-y-2">
                {members.filter((m) => m.role === "student" && m.user_id !== classData.owner_id).length === 0 ? (
                  <p className="text-muted-foreground">No students yet</p>
                ) : (
                  members.filter((m) => m.role === "student" && m.user_id !== classData.owner_id).map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-lg p-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.profiles?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-muted text-sm text-muted-foreground">
                          {m.profiles?.display_name?.charAt(0)?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-foreground">{m.profiles?.display_name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ClassDetail;
