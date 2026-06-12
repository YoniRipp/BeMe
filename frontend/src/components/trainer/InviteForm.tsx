import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Link as LinkIcon, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from '@/components/shared/ToastProvider';
import type { TrainerInvitation } from '@/core/api/trainer';

interface InviteFormProps {
  onInviteByEmail: (email: string) => void;
  onGenerateCode: () => void;
  invitingByEmail: boolean;
  generatingCode: boolean;
  generatedCode: { inviteCode: string; expiresAt: string } | null;
  invitations: TrainerInvitation[];
}

export function InviteForm({
  onInviteByEmail,
  onGenerateCode,
  invitingByEmail,
  generatingCode,
  generatedCode,
  invitations,
}: InviteFormProps) {
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    onInviteByEmail(email.trim());
    setEmail('');
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode.inviteCode).then(() => {
      setCopied(true);
      toast.success('Invite code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error('Failed to copy code');
    });
  };

  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite a Client</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="email">
          <TabsList className="mb-4">
            <TabsTrigger value="email" className="gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              By Email
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-1.5">
              <LinkIcon className="w-3.5 h-3.5" />
              Invite Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email">
            <form onSubmit={handleEmailSubmit} className="flex gap-2">
              <Input
                type="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" disabled={invitingByEmail || !email.trim()}>
                {invitingByEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Send Invite'
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="code">
            <div className="space-y-3">
              <Button onClick={onGenerateCode} disabled={generatingCode} variant="outline">
                {generatingCode ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Generate Invite Code
              </Button>
              {generatedCode && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                  <code className="text-sm font-mono flex-1 select-all">
                    {generatedCode.inviteCode}
                  </code>
                  <Button variant="ghost" size="sm" onClick={handleCopyCode}>
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {pendingInvitations.length > 0 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
              Pending Invitations
            </p>
            <div className="space-y-2">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-border text-sm"
                >
                  <span className="text-muted-foreground truncate">
                    {inv.email || `Code: ${inv.inviteCode?.slice(0, 8)}...`}
                  </span>
                  <Badge variant="secondary">pending</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
