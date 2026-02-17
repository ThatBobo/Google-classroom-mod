import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import ClassCard from "@/components/ClassCard";
import CreateClassDialog from "@/components/CreateClassDialog";
import JoinClassDialog from "@/components/JoinClassDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface ClassWithOwner {
  id: string;
  name: string;
  section: string | null;
  subject: string | null;
  banner_color: string;
  owner_id: string;
  owner_name: string;
  owner_avatar: string | null;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const fetchClasses = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get classes where user is owner or member
    const { data: memberClasses } = await supabase
      .from("class_members")
      .select("class_id")
      .eq("user_id", user.id);

    const memberClassIds = memberClasses?.map((m) => m.class_id) ?? [];

    const { data: ownedClasses } = await supabase
      .from("classes")
      .select("id")
      .eq("owner_id", user.id);

    const ownedClassIds = ownedClasses?.map((c) => c.id) ?? [];
    const allClassIds = [...new Set([...memberClassIds, ...ownedClassIds])];

    if (allClassIds.length === 0) {
      setClasses([]);
      setLoading(false);
      return;
    }

    const { data: classesData } = await supabase
      .from("classes")
      .select("id, name, section, subject, banner_color, owner_id")
      .in("id", allClassIds);

    if (!classesData) {
      setClasses([]);
      setLoading(false);
      return;
    }

    // Fetch owner profiles
    const ownerIds = [...new Set(classesData.map((c) => c.owner_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", ownerIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

    const enriched: ClassWithOwner[] = classesData.map((c) => {
      const owner = profileMap.get(c.owner_id);
      return {
        ...c,
        owner_name: owner?.display_name ?? "Unknown",
        owner_avatar: owner?.avatar_url ?? null,
      };
    });

    setClasses(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  return (
    <div className="min-h-screen bg-background">
      <Header
        onCreateClass={() => setCreateOpen(true)}
        onJoinClass={() => setJoinOpen(true)}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 rounded-2xl bg-primary/10 p-6">
              <svg className="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground">No classes yet</h2>
            <p className="mt-1 text-muted-foreground">Create or join a class to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <ClassCard
                key={cls.id}
                id={cls.id}
                name={cls.name}
                section={cls.section}
                subject={cls.subject}
                ownerName={cls.owner_name}
                ownerAvatar={cls.owner_avatar}
                bannerColor={cls.banner_color}
              />
            ))}
          </div>
        )}
      </main>

      <CreateClassDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchClasses} />
      <JoinClassDialog open={joinOpen} onOpenChange={setJoinOpen} onJoined={fetchClasses} />
    </div>
  );
};

export default Dashboard;
