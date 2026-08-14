import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';

interface WellnessCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  onEdit?: () => void;
}

export function WellnessCard({ label, value, icon: Icon, subtitle, onEdit }: WellnessCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        {onEdit && (
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
