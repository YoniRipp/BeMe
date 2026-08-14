import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Eye } from 'lucide-react';
import type { TrainerClient } from '@/core/api/trainer';

interface ClientListProps {
  clients: TrainerClient[];
  onRemove: (clientId: string) => void;
  removing: boolean;
}

export function ClientList({ clients, onRemove, removing }: ClientListProps) {
  const navigate = useNavigate();

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">No clients yet. Invite someone to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your Clients</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {client.clientName}
                </p>
                <p className="text-xs text-muted-foreground truncate">{client.clientEmail}</p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                  {client.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/trainer/client/${client.clientId}`)}
                  title="View client data"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(client.clientId)}
                  disabled={removing}
                  title="Remove client"
                  className="text-destructive hover:text-destructive/80"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
