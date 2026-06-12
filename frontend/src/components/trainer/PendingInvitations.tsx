import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UserCheck, UserPlus } from 'lucide-react';
import { usePendingTrainerInvitations, useAcceptInvitation, useMyTrainer } from '@/hooks/useTrainer';
import { PulseCard } from '@/components/pulse/PulseUI';
import { toast } from '@/components/shared/ToastProvider';

export function PendingInvitations() {
  const { data: invitations = [], isLoading: loadingInvitations } = usePendingTrainerInvitations();
  const { data: trainerData, isLoading: loadingTrainer } = useMyTrainer();
  const acceptMutation = useAcceptInvitation();
  const [manualCode, setManualCode] = useState('');
  const [searchParams] = useSearchParams();
  const handledInviteRef = useRef<string | null>(null);

  const trainer = trainerData;
  const pending = invitations.filter((inv) => inv.status === 'pending');

  const handleAccept = (code: string) => {
    acceptMutation.mutate(code, {
      onSuccess: () => {
        toast.success('Trainer connected');
        setManualCode('');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to accept invitation'),
    });
  };

  useEffect(() => {
    if (loadingInvitations || loadingTrainer || trainer || acceptMutation.isPending) return;
    const inviteFromEmail = searchParams.get('trainerInvite')?.trim();
    if (!inviteFromEmail || handledInviteRef.current === inviteFromEmail) return;
    handledInviteRef.current = inviteFromEmail;
    setManualCode(inviteFromEmail);
    handleAccept(inviteFromEmail);
  }, [acceptMutation.isPending, loadingInvitations, loadingTrainer, searchParams, trainer]);

  if (loadingInvitations || loadingTrainer) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleAccept(manualCode.trim());
  };

  return (
    <PulseCard className="overflow-hidden p-0">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        {trainer
          ? <UserCheck className="h-4 w-4 text-primary" />
          : <UserPlus className="h-4 w-4 text-muted-foreground" />}
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          My trainer
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Active trainer */}
        {trainer && (
          <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/15 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {trainer.trainerName.trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{trainer.trainerName}</p>
              <p className="text-xs text-muted-foreground truncate">{trainer.trainerEmail}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Trainee since {new Date(trainer.connectedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}

        {/* Pending invitations to accept */}
        {pending.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Pending invitation{pending.length > 1 ? 's' : ''}
            </p>
            {pending.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-xl border border-border p-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    From: {inv.trainerName || 'A trainer'}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAccept(inv.inviteCode ?? inv.id)}
                  disabled={acceptMutation.isPending}
                  className="shrink-0"
                >
                  {acceptMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : 'Accept'}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Manual code entry (only when no trainer yet) */}
        {!trainer && (
          <>
            <p className="text-sm text-muted-foreground">
              {pending.length > 0
                ? 'Or enter a code from your trainer:'
                : 'Have an invite code from a trainer? Enter it here.'}
            </p>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <Input
                placeholder="Enter invite code"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 font-mono"
              />
              <Button type="submit" disabled={acceptMutation.isPending || !manualCode.trim()}>
                {acceptMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : 'Connect'}
              </Button>
            </form>
          </>
        )}
      </div>
    </PulseCard>
  );
}
