import { Link } from 'react-router-dom';
import { Activity, ClipboardList, Image, Server, Settings2, UtensilsCrossed, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const operations: Array<{
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { to: '/admin/users', label: 'Accounts', description: 'Create, edit, and remove users or trainers.', icon: Users },
  { to: '/admin/user-data', label: 'User Data', description: 'Inspect workouts, food, check-ins, and goals.', icon: ClipboardList },
  { to: '/admin/activity', label: 'Activity', description: 'Audit product events and recent usage.', icon: Activity },
  { to: '/admin/foods', label: 'Food Review', description: 'Verify AI foods and nutrition records.', icon: UtensilsCrossed },
  { to: '/admin/images', label: 'Media', description: 'Manage food and exercise imagery.', icon: Image },
  { to: '/admin/system', label: 'System', description: 'Review health, logs, and operational status.', icon: Server },
];

export function AdminOperationsPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Operations</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {operations.map(({ to, label, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-[104px] items-start gap-3 rounded-2xl border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background text-primary shadow-sm">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold leading-tight">{label}</span>
              <span className="mt-1 block text-sm leading-snug text-muted-foreground">{description}</span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
