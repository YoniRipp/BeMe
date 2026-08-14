import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdminStats } from '@/hooks/useAdminStats';
import { VOICE_COST_PER_CALL, VOICE_HEAVY_THRESHOLD } from './constants';

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'pro') return 'default';
  if (status === 'canceled' || status === 'expired') return 'destructive';
  return 'secondary';
}

export function AdminFlaggedUsers() {
  const { data, isLoading } = useAdminStats();

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  const users = data.voiceHeavyUsers;
  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No voice usage this month.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Top Voice API Users (This Month)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">User</th>
                <th className="pb-2 font-medium text-right">Voice Calls</th>
                <th className="pb-2 font-medium text-right">Est. Cost</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b last:border-0 ${u.voiceCalls >= VOICE_HEAVY_THRESHOLD ? 'bg-destructive/10' : ''}`}
                >
                  <td className="py-2">
                    <div className="font-medium">{u.name || 'No name'}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="py-2 text-right font-mono">
                    {u.voiceCalls}
                    {u.voiceCalls >= VOICE_HEAVY_THRESHOLD && (
                      <Badge variant="destructive" className="ml-2 text-xs">flagged</Badge>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono">
                    ${(u.voiceCalls * VOICE_COST_PER_CALL).toFixed(2)}
                  </td>
                  <td className="py-2">
                    <Badge variant={statusVariant(u.subscriptionStatus)}>
                      {u.subscriptionStatus}
                    </Badge>
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(u.lastActive).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
