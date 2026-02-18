import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface TodoItem {
  id: string;
  title: string;
  due_date: string | null;
  class_id: string;
  class_name?: string;
  class_color?: string;
  submitted: boolean;
}

const Todo = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"assigned" | "done">("assigned");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);

      // Get user's classes
      const { data: memberClasses } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("user_id", user.id);
      const classIds = memberClasses?.map((m) => m.class_id) ?? [];
      if (classIds.length === 0) { setItems([]); setLoading(false); return; }

      // Fetch assignments
      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, title, due_date, class_id")
        .in("class_id", classIds);

      // Fetch submissions by this student
      const assignmentIds = assignments?.map((a) => a.id) ?? [];
      const { data: submissions } = assignmentIds.length > 0
        ? await supabase
            .from("submissions")
            .select("assignment_id")
            .eq("student_id", user.id)
            .in("assignment_id", assignmentIds)
        : { data: [] };

      const submittedSet = new Set(submissions?.map((s) => s.assignment_id) ?? []);

      // Fetch class info
      const { data: classesData } = await supabase
        .from("classes")
        .select("id, name, banner_color")
        .in("id", classIds);
      const classMap = new Map(classesData?.map((c) => [c.id, c]) ?? []);

      setItems(
        (assignments ?? []).map((a) => ({
          ...a,
          class_name: classMap.get(a.class_id)?.name,
          class_color: classMap.get(a.class_id)?.banner_color,
          submitted: submittedSet.has(a.id),
        }))
      );
      setLoading(false);
    };
    fetch();
  }, [user]);

  const filtered = items.filter((i) => (filter === "done" ? i.submitted : !i.submitted));

  return (
    <div className="min-h-screen bg-background">
      <Header onCreateClass={() => {}} onJoinClass={() => {}} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-6 font-display text-2xl font-bold text-foreground">To-do</h1>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setFilter("assigned")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${filter === "assigned" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
          >
            Assigned
          </button>
          <button
            onClick={() => setFilter("done")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${filter === "done" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
          >
            Done
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-muted-foreground">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <CheckCircle2 className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              {filter === "done" ? "No completed work yet" : "No work due — enjoy!"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <Card
                key={item.id}
                className="flex cursor-pointer items-center gap-3 p-4 transition-shadow hover:shadow-md"
                onClick={() => navigate(`/class/${item.class_id}`)}
              >
                {item.submitted ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.class_name}</p>
                </div>
                {item.due_date && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(item.due_date), "MMM d")}
                  </span>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Todo;
