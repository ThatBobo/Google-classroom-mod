import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarIcon } from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Assignment {
  id: string;
  title: string;
  due_date: string | null;
  class_id: string;
  class_name?: string;
  class_color?: string;
}

const Calendar = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAssignments = async () => {
      setLoading(true);
      const { data: memberClasses } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("user_id", user.id);

      const classIds = memberClasses?.map((m) => m.class_id) ?? [];

      const { data: owned } = await supabase
        .from("classes")
        .select("id")
        .eq("owner_id", user.id);

      const allIds = [...new Set([...classIds, ...(owned?.map((c) => c.id) ?? [])])];
      if (allIds.length === 0) { setAssignments([]); setLoading(false); return; }

      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("id, title, due_date, class_id")
        .in("class_id", allIds)
        .not("due_date", "is", null);

      const { data: classesData } = await supabase
        .from("classes")
        .select("id, name, banner_color")
        .in("id", allIds);

      const classMap = new Map(classesData?.map((c) => [c.id, c]) ?? []);

      setAssignments(
        (assignmentsData ?? []).map((a) => ({
          ...a,
          class_name: classMap.get(a.class_id)?.name,
          class_color: classMap.get(a.class_id)?.banner_color,
        }))
      );
      setLoading(false);
    };
    fetchAssignments();
  }, [user]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getAssignmentsForDay = (day: Date) =>
    assignments.filter((a) => a.due_date && isSameDay(new Date(a.due_date), day));

  return (
    <div className="min-h-screen bg-background">
      <Header onCreateClass={() => {}} onJoinClass={() => {}} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary" /> Calendar
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="font-display text-lg font-semibold min-w-[160px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px rounded-xl border border-border bg-border overflow-hidden">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const dayAssignments = getAssignmentsForDay(day);
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[80px] bg-card p-1 ${!isCurrentMonth ? "opacity-40" : ""}`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? "bg-primary text-primary-foreground font-bold" : "text-foreground"}`}>
                  {format(day, "d")}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayAssignments.slice(0, 2).map((a) => (
                    <div
                      key={a.id}
                      className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: a.class_color ?? "hsl(217 89% 45%)" }}
                    >
                      {a.title}
                    </div>
                  ))}
                  {dayAssignments.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">+{dayAssignments.length - 2} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Calendar;
