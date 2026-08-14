import { useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Dumbbell,
  Flame,
  Link as LinkIcon,
  Loader2,
  Mail,
  Mic,
  Plus,
  Search,
  Scale,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '@/context/AppContext';
import {
  useGenerateInviteCode,
  useInviteByEmail,
  useRemoveClient,
  useTrainerAnalytics,
  useTrainerClients,
  useTrainerInvitations,
} from '@/hooks/useTrainer';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ContentWithLoading } from '@/components/shared/ContentWithLoading';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { cn } from '@/lib/utils';
import { toast } from '@/components/shared/ToastProvider';
import { Card } from '@/components/ui/card';
import type {
  TrainerAnalytics,
  TrainerAnalyticsRange,
  TrainerClient,
  TrainerClientAnalyticsStatus,
} from '@/core/api/trainer';

const RANGE_OPTIONS: Array<{ value: TrainerAnalyticsRange; label: string }> = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '3m', label: '3M' },
  { value: 'ytd', label: 'YTD' },
  { value: '1y', label: '1Y' },
];

const STATUS_LABELS: Record<TrainerClientAnalyticsStatus, string> = {
  new: 'New',
  good: 'Good',
  attention: 'Needs attention',
  at_risk: 'At risk',
};

const STATUS_STYLES: Record<TrainerClientAnalyticsStatus, string> = {
  new: 'border-info/20 bg-info/10 text-info',
  good: 'border-success/20 bg-success/10 text-success',
  attention: 'border-warning/20 bg-warning/10 text-warning',
  at_risk: 'border-destructive/20 bg-destructive/10 text-destructive',
};

function tooltipStyle() {
  return {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 12,
    color: 'hsl(var(--foreground))',
    boxShadow: 'var(--shadow-card)',
  };
}

export default function Trainer() {
  const navigate = useNavigate();
  const inviteRef = useRef<HTMLDivElement>(null);
  const { user } = useApp();
  const [range, setRange] = useState<TrainerAnalyticsRange>('30d');
  const [inviteTab, setInviteTab] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [generatedCode, setGeneratedCode] = useState<{ inviteCode: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TrainerClient | null>(null);
  const [search, setSearch] = useState('');

  const { data: clients = [], isLoading: loadingClients } = useTrainerClients();
  const { data: invitations = [], isLoading: loadingInvitations } = useTrainerInvitations();
  const { data: analytics, isLoading: loadingAnalytics } = useTrainerAnalytics(range);
  const inviteByEmail = useInviteByEmail();
  const generateCode = useGenerateInviteCode();
  const removeClient = useRemoveClient();

  const pendingInvitations = invitations.filter((i) => i.status === 'pending');
  const firstName = user?.name?.split(' ')[0] ?? 'Coach';
  const trainerSubscriptionInfo = formatTrainerSubscription(user?.subscriptionPlan, user?.subscriptionCurrentPeriodEnd);
  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return analytics?.roster ?? [];
    return (analytics?.roster ?? []).filter((client) =>
      client.clientName.toLowerCase().includes(q) ||
      client.clientEmail.toLowerCase().includes(q)
    );
  }, [analytics?.roster, search]);

  const handleEmailInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    inviteByEmail.mutate(email.trim(), {
      onSuccess: () => {
        toast.success(`Invitation sent to ${email}`);
        setEmail('');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to send invitation'),
    });
  };

  const handleGenerateCode = () => {
    generateCode.mutate(undefined, {
      onSuccess: (data) => {
        setGeneratedCode(data);
        toast.success('Invite code generated');
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to generate code'),
    });
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode.inviteCode).then(() => {
      setCopied(true);
      toast.success('Code copied');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleConfirmRemove = () => {
    if (!removeTarget) return;
    removeClient.mutate(removeTarget.clientId, {
      onSuccess: () => toast.success(`${removeTarget.clientName} removed`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove client'),
    });
    setRemoveTarget(null);
  };

  const scrollToInvite = () => {
    inviteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Page>
      <PageHeader
        kicker="Trainer"
        title={`Coach overview, ${firstName}`}
        subtitle="Track trainee engagement, progress signals, and subscriptions from one mobile-first dashboard."
        action={
          <Button className="gap-2" onClick={scrollToInvite}>
            <UserPlus className="h-4 w-4" />
            Invite
          </Button>
        }
      />

      <ContentWithLoading loading={loadingClients || loadingInvitations || loadingAnalytics} loadingText="Loading trainer dashboard...">
        <div className="space-y-5">
          <div className="flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={cn(
                  'h-9 min-w-14 flex-1 rounded-md px-3 text-xs font-extrabold tracking-wide transition-colors',
                  range === option.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <SummaryGrid analytics={analytics} pendingInvitations={pendingInvitations.length} />

          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
            <ChartCard title="Engagement" subtitle="Active trainees in each period">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={analytics?.engagementSeries ?? []}>
                  <defs>
                    <linearGradient id="engagementFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle()} formatter={(value, name) => [name === 'engagementPercent' ? `${value}%` : value, name === 'engagementPercent' ? 'Engagement' : 'Active trainees']} />
                  <Area type="monotone" dataKey="engagementPercent" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#engagementFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Subscription age" subtitle="How long trainees have been connected">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics?.subscriptionAgeBuckets ?? []} layout="vertical" margin={{ left: 10, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="label" type="category" width={70} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle()} />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} fill="hsl(var(--info))" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.25fr]">
            <ChartCard title="Client growth" subtitle="Total and new trainees">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={analytics?.growthSeries ?? []}>
                  <defs>
                    <linearGradient id="growthFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle()} />
                  <Area type="monotone" dataKey="totalTrainees" name="Total trainees" stroke="hsl(var(--success))" strokeWidth={2.5} fill="url(#growthFill)" />
                  <Area type="monotone" dataKey="newTrainees" name="New trainees" stroke="hsl(var(--warning))" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ProgressPanel analytics={analytics} />
          </div>

          <RosterPanel
            analytics={analytics}
            clients={clients}
            filteredRoster={filteredRoster}
            search={search}
            setSearch={setSearch}
            navigateToClient={(clientId) => navigate(`/trainer/client/${clientId}`)}
            removeClient={(client) => setRemoveTarget({
              id: client.clientId,
              trainerId: '',
              clientId: client.clientId,
              clientName: client.clientName,
              clientEmail: client.clientEmail,
              status: 'active',
              createdAt: '',
            })}
          />

          <VoiceTipsCard />

          <InvitePanel
            refTarget={inviteRef}
            inviteTab={inviteTab}
            setInviteTab={setInviteTab}
            email={email}
            setEmail={setEmail}
            generatedCode={generatedCode}
            copied={copied}
            pendingInvitations={pendingInvitations}
            invitePending={inviteByEmail.isPending}
            codePending={generateCode.isPending}
            onEmailInvite={handleEmailInvite}
            onGenerateCode={handleGenerateCode}
            onCopyCode={handleCopyCode}
            subscriptionInfo={trainerSubscriptionInfo}
          />
        </div>
      </ContentWithLoading>

      <ConfirmationDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove client"
        message={`Remove ${removeTarget?.clientName ?? 'this client'}? They'll lose access to your trainer view.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmRemove}
      />
    </Page>
  );
}

function SummaryGrid({ analytics, pendingInvitations }: { analytics?: TrainerAnalytics; pendingInvitations: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <SummaryCard icon={Users} label="Trainees" value={analytics?.summary.totalTrainees ?? 0} sub={`${pendingInvitations} pending`} />
      <SummaryCard icon={UserPlus} label="New" value={`+${analytics?.summary.newTrainees ?? 0}`} sub="selected range" />
      <SummaryCard icon={TrendingUp} label="Engaged" value={`${analytics?.summary.engagedPercent ?? 0}%`} sub="good status" />
      <SummaryCard icon={AlertTriangle} label="At risk" value={analytics?.summary.atRiskCount ?? 0} sub="follow up" tone="danger" />
      <SummaryCard icon={Flame} label="Volume" value={formatCompact(analytics?.progress.volumeTotal ?? 0)} sub={analytics?.progress.volumeKind === 'weighted' ? 'weighted' : 'set-rep'} />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'normal',
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub: string;
  tone?: 'normal' | 'danger';
}) {
  return (
    <Card className="min-h-[112px] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-eyebrow font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <Icon className={cn('h-4 w-4', tone === 'danger' ? 'text-destructive' : 'text-primary')} />
      </div>
      <p className="mt-4 text-3xl font-extrabold leading-none tracking-tight tabular-nums">{value}</p>
      <p className="mt-1.5 text-xs font-medium text-muted-foreground">{sub}</p>
    </Card>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-3">
        <p className="text-base font-extrabold">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </Card>
  );
}

function ProgressPanel({ analytics }: { analytics?: TrainerAnalytics }) {
  const data = analytics?.progress.series ?? [];
  return (
    <Card className="p-4">
      <div className="mb-3">
        <p className="text-base font-extrabold">Progress changes</p>
        <p className="text-xs text-muted-foreground">Team trends across weight, calories, and volume</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <ProgressMetric icon={Scale} label="Weight avg" value={formatDelta(analytics?.progress.weightDeltaAvg, 'kg')} />
        <ProgressMetric icon={Flame} label="Calories avg" value={analytics?.progress.calorieAverage != null ? `${Math.round(analytics.progress.calorieAverage).toLocaleString()}/day` : '--'} delta={analytics?.progress.calorieTrendPercent} />
        <ProgressMetric icon={Dumbbell} label="Volume trend" value={formatCompact(analytics?.progress.volumeTotal ?? 0)} delta={analytics?.progress.volumeTrendPercent} />
      </div>
      <div className="mt-4 h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle()} />
            <Bar yAxisId="left" dataKey="volume" name="Volume" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" />
            <Area yAxisId="right" type="monotone" dataKey="calorieAverage" name="Avg calories" stroke="hsl(var(--warning))" fill="transparent" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ProgressMetric({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/35 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-bold uppercase tracking-[0.1em]">{label}</p>
      </div>
      <p className="mt-2 text-xl font-extrabold tabular-nums">{value}</p>
      {delta != null && (
        <p className={cn('mt-0.5 text-xs font-semibold', delta >= 0 ? 'text-success' : 'text-destructive')}>
          {delta >= 0 ? '+' : ''}{delta}% vs previous
        </p>
      )}
    </div>
  );
}

function RosterPanel({
  analytics,
  clients,
  filteredRoster,
  search,
  setSearch,
  navigateToClient,
  removeClient,
}: {
  analytics?: TrainerAnalytics;
  clients: TrainerClient[];
  filteredRoster: TrainerAnalytics['roster'];
  search: string;
  setSearch: (value: string) => void;
  navigateToClient: (clientId: string) => void;
  removeClient: (client: TrainerAnalytics['roster'][number]) => void;
}) {
  const traineeNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      if (c.traineeNumber != null) map.set(c.clientId, c.traineeNumber);
    }
    return map;
  }, [clients]);
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-extrabold">Trainee roster</p>
            <p className="text-xs text-muted-foreground">Status, connection age, and progress deltas</p>
          </div>
          <div className="relative md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trainees"
              className="pl-9"
            />
          </div>
        </div>
      </div>
      {clients.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Users className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">No trainees yet</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Invite your first client to unlock analytics.</p>
          </div>
        </div>
      ) : filteredRoster.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">No trainees match your search.</div>
      ) : (
        <div className="divide-y divide-border">
          {filteredRoster.map((client) => (
            <div key={client.clientId} className="flex items-center gap-3 px-5 py-4">
              <button
                type="button"
                onClick={() => navigateToClient(client.clientId)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-extrabold text-primary">
                  {client.clientName.trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold truncate">{client.clientName}</p>
                    {traineeNumberMap.get(client.clientId) != null && (
                      <span className="text-eyebrow font-bold text-muted-foreground tabular-nums">#{traineeNumberMap.get(client.clientId)}</span>
                    )}
                    <Badge variant="outline" className={cn('capitalize', STATUS_STYLES[client.status])}>
                      {STATUS_LABELS[client.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{client.clientEmail}</p>
                  <p className="mt-1 text-eyebrow font-medium text-muted-foreground">
                    Connected {formatAge(client.subscriptionAgeDays)} - last active {client.lastActivityAt ? format(new Date(client.lastActivityAt), 'MMM d') : 'never'}
                  </p>
                </div>
              </button>
              <div className="hidden min-w-[210px] grid-cols-3 gap-2 text-right text-xs md:grid">
                <RosterMetric label="Weight" value={formatDelta(client.weightDelta, 'kg')} />
                <RosterMetric label="Calories" value={client.calorieAverage != null ? Math.round(client.calorieAverage).toLocaleString() : '--'} />
                <RosterMetric label="Volume" value={formatPercent(client.volumeTrendPercent)} />
              </div>
              <button
                type="button"
                onClick={() => navigateToClient(client.clientId)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Open ${client.clientName}`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => removeClient(client)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove ${client.clientName}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {analytics && analytics.roster.length > 0 && (
        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Engagement counts food, workouts, weight, water, and check-ins.
        </div>
      )}
    </Card>
  );
}

function RosterMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-bold text-foreground">{value}</p>
      <p className="text-caption uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
    </div>
  );
}

function InvitePanel({
  refTarget,
  inviteTab,
  setInviteTab,
  email,
  setEmail,
  generatedCode,
  copied,
  pendingInvitations,
  invitePending,
  codePending,
  onEmailInvite,
  onGenerateCode,
  onCopyCode,
  subscriptionInfo,
}: {
  refTarget: React.RefObject<HTMLDivElement>;
  inviteTab: 'email' | 'code';
  setInviteTab: (tab: 'email' | 'code') => void;
  email: string;
  setEmail: (email: string) => void;
  generatedCode: { inviteCode: string; expiresAt: string } | null;
  copied: boolean;
  pendingInvitations: Array<{ id: string; email?: string; inviteCode?: string; status: string; expiresAt: string }>;
  invitePending: boolean;
  codePending: boolean;
  onEmailInvite: (e: React.FormEvent) => void;
  onGenerateCode: () => void;
  onCopyCode: () => void;
  subscriptionInfo: string;
}) {
  return (
    <div ref={refTarget}>
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <p className="text-base font-extrabold">Invite a client</p>
          <p className="text-xs text-muted-foreground">Send an invite by email or generate a code.</p>
          <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-medium leading-relaxed text-muted-foreground">
            Invited trainees receive Pro access tied to your trainer subscription. {subscriptionInfo}
          </div>
        </div>
        <div className="flex border-b border-border">
          {(['email', 'code'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setInviteTab(tab)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors',
                inviteTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'email' ? <Mail className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
              {tab === 'email' ? 'By email' : 'Invite code'}
            </button>
          ))}
        </div>
        <div className="p-5">
          {inviteTab === 'email' ? (
            <form onSubmit={onEmailInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" disabled={invitePending || !email.trim()}>
                {invitePending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={onGenerateCode}
                disabled={codePending}
              >
                {codePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Generate code
              </Button>
              {generatedCode && (
                <div className="flex items-center gap-2 rounded-xl bg-muted p-3">
                  <code className="flex-1 select-all font-mono text-sm">{generatedCode.inviteCode}</code>
                  <button
                    type="button"
                    onClick={onCopyCode}
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-background transition-colors press"
                    aria-label="Copy invite code"
                  >
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}
              {generatedCode && (
                <p className="text-center text-xs text-muted-foreground">
                  Expires {format(new Date(generatedCode.expiresAt), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          )}
        </div>
        {pendingInvitations.length > 0 && (
          <div className="space-y-2 border-t border-border px-5 py-4">
            <p className="mb-3 text-eyebrow font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Pending ({pendingInvitations.length})
            </p>
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <p className="truncate text-sm text-muted-foreground">
                  {inv.email || `Code: ${inv.inviteCode?.slice(0, 10)}...`}
                </p>
                <Badge variant="secondary" className="ml-2 shrink-0">pending</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function VoiceTipsCard() {
  const tips = [
    { cmd: '"Log Guy\'s pull workout: lat pull-down 4 sets of 10 at 60 kg"', label:'Add workout' },
    { cmd: '"Edit Guy\'s pull workout, change lat pull-downs to pull-ups at 0 kg"', label:'Edit exercise' },
    { cmd: '"Add Guy number 4\'s workout: bench press 3 sets of 10 at 80 kg"', label:'Disambiguate by number' },
    { cmd: '"Add Guy Malka\'s lunch: 200g chicken breast"', label:'Log food by full name' },
  ];
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Mic className="h-4 w-4 text-primary" />
        <p className="text-base font-extrabold">Voice commands for trainees</p>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Tap the mic button and speak naturally. Use the trainee&apos;s name — or their roster number (#) if names collide.</p>
      <div className="space-y-2">
        {tips.map((t) => (
          <div key={t.cmd} className="rounded-xl bg-muted/50 px-3 py-2">
            <p className="text-caption font-bold uppercase tracking-[0.1em] text-muted-foreground">{t.label}</p>
            <p className="mt-0.5 text-xs italic text-foreground">{t.cmd}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatDelta(value: number | null | undefined, unit: string) {
  if (value == null) return '--';
  return `${value > 0 ? '+' : ''}${value}${unit}`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return '--';
  return `${value > 0 ? '+' : ''}${value}%`;
}

function formatAge(days: number) {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}mo`;
}

function formatTrainerSubscription(plan?: string | null, currentPeriodEnd?: string | null) {
  const planLabel = plan === 'yearly' ? 'Yearly plan' : plan === 'monthly' ? 'Monthly plan' : 'Current plan';
  if (!currentPeriodEnd) return `${planLabel} seats stay active while your plan is active.`;
  return `${planLabel} seats run through ${format(new Date(currentPeriodEnd), 'MMM d, yyyy')}.`;
}
