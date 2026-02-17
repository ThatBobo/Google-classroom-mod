import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreVertical, FolderOpen, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

const BANNER_COLORS = [
  "hsl(217 89% 45%)",    // blue
  "hsl(142 53% 41%)",    // green
  "hsl(262 52% 47%)",    // purple
  "hsl(174 100% 29%)",   // teal
  "hsl(4 90% 58%)",      // red
  "hsl(36 100% 50%)",    // orange
];

interface ClassCardProps {
  id: string;
  name: string;
  section?: string | null;
  subject?: string | null;
  ownerName: string;
  ownerAvatar?: string | null;
  bannerColor?: string;
}

const ClassCard = ({ id, name, section, subject, ownerName, ownerAvatar, bannerColor }: ClassCardProps) => {
  const navigate = useNavigate();
  const color = bannerColor || BANNER_COLORS[name.length % BANNER_COLORS.length];

  return (
    <Card
      className="group cursor-pointer overflow-hidden border border-border transition-shadow hover:shadow-lg"
      onClick={() => navigate(`/class/${id}`)}
    >
      <div className="relative h-24 px-4 pt-3" style={{ backgroundColor: color }}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-xl font-bold text-white">{name}</h3>
            {section && <p className="truncate text-sm text-white/80">{section}</p>}
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 text-white hover:bg-white/20" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
        <Avatar className="absolute -bottom-8 right-4 h-16 w-16 border-2 border-card">
          <AvatarImage src={ownerAvatar ?? undefined} />
          <AvatarFallback className="bg-muted text-lg font-medium text-muted-foreground">
            {ownerName?.charAt(0)?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="h-14 border-b border-border px-4 pt-2">
        <p className="truncate text-sm text-muted-foreground">{subject ?? ownerName}</p>
      </div>

      <div className="flex items-center justify-end gap-1 p-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={(e) => e.stopPropagation()}>
          <ClipboardList className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={(e) => e.stopPropagation()}>
          <FolderOpen className="h-5 w-5" />
        </Button>
      </div>
    </Card>
  );
};

export default ClassCard;
