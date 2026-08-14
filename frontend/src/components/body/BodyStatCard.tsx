import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface BodyStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  onClick?: () => void;
}

export function BodyStatCard({ label, value, icon: Icon, onClick }: BodyStatCardProps) {
  return (
    <Card 
      className={cn(
        "p-4",
        onClick && "cursor-pointer hover:shadow-md transition-shadow"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
