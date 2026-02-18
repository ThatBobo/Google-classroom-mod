import Header from "@/components/Header";
import { Archive } from "lucide-react";

const Archived = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header onCreateClass={() => {}} onJoinClass={() => {}} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="mb-6 font-display text-2xl font-bold text-foreground">Archived classes</h1>
        <div className="flex flex-col items-center py-16 text-center">
          <Archive className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No archived classes</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When you archive a class, it will appear here.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Archived;
