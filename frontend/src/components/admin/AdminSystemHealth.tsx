import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdminStats } from '@/hooks/useAdminStats';

export function AdminSystemHealth() {
  const { data, isLoading } = useAdminStats();

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading system health...</CardContent>
      </Card>
    );
  }

  const { recentErrors } = data;
  const hasErrors = recentErrors.count > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">System Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          {hasErrors ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : (
            <CheckCircle className="h-5 w-5 text-success" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">Errors (last 24h)</span>
              <Badge variant={hasErrors ? 'destructive' : 'secondary'}>
                {recentErrors.count}
              </Badge>
            </div>
            {hasErrors && recentErrors.lastErrorMessage && (
              <p className="text-sm text-muted-foreground mt-1 truncate max-w-lg">
                Latest: {recentErrors.lastErrorMessage.slice(0, 200)}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
