import { Activity, CreditCard, Mic, Repeat, ShieldCheck, UserCheck, Users, WalletCards } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminStats } from '@/hooks/useAdminStats';
import type { BusinessOverview } from '@/core/api/admin';

const cards = [
  {
    key: 'users',
    label: 'Total Users',
    icon: Users,
    color: 'border-l-blue-500',
    iconColor: 'text-info',
    getValue: (o: BusinessOverview) => o.totalUsers,
    getSub: (o: BusinessOverview) => `+${o.newUsersThisWeek} this week`,
  },
  {
    key: 'trainees',
    label: 'Trainees',
    icon: UserCheck,
    color: 'border-l-cyan-500',
    iconColor: 'text-info',
    getValue: (o: BusinessOverview) => o.totalTrainees,
    getSub: (o: BusinessOverview) => `${o.activeTrainerClientLinks} active trainer links`,
  },
  {
    key: 'trainers',
    label: 'Trainers',
    icon: ShieldCheck,
    color: 'border-l-indigo-500',
    iconColor: 'text-primary',
    getValue: (o: BusinessOverview) => o.totalTrainers,
    getSub: (o: BusinessOverview) => `${o.activeTrainersWithClients} with clients`,
  },
  {
    key: 'subs',
    label: 'Pro Accounts',
    icon: CreditCard,
    color: 'border-l-green-500',
    iconColor: 'text-success',
    getValue: (o: BusinessOverview) => o.proSubscribers,
    getSub: (o: BusinessOverview) => `${o.selfPaidSubscribers} self-paid`,
  },
  {
    key: 'monthly',
    label: 'Monthly Pro',
    icon: Repeat,
    color: 'border-l-emerald-500',
    iconColor: 'text-success',
    getValue: (o: BusinessOverview) => o.monthlyProSubscribers,
    getSub: (o: BusinessOverview) => `${o.yearlyProSubscribers} yearly pro`,
  },
  {
    key: 'trainer_granted',
    label: 'Trainer Seats',
    icon: WalletCards,
    color: 'border-l-orange-500',
    iconColor: 'text-warning',
    getValue: (o: BusinessOverview) => o.trainerGrantedSubscribers,
    getSub: (o: BusinessOverview) => `${o.pendingTrainerInvites} pending invites`,
  },
  {
    key: 'voice',
    label: 'Voice API (Month)',
    icon: Mic,
    color: 'border-l-purple-500',
    iconColor: 'text-primary',
    getValue: (o: BusinessOverview) => o.voiceCallsThisMonth,
    getSub: () => 'Total calls this month',
  },
  {
    key: 'wau',
    label: 'Weekly Active Users',
    icon: Activity,
    color: 'border-l-amber-500',
    iconColor: 'text-gold',
    getValue: (o: BusinessOverview) => o.weeklyActiveUsers,
    getSub: (o: BusinessOverview) =>
      o.totalUsers > 0
        ? `${Math.round((o.weeklyActiveUsers / o.totalUsers) * 100)}% of total`
        : '',
  },
];

export function AdminOverviewCards() {
  const { data, isLoading } = useAdminStats();
  const overview = data?.overview;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.key} className={`border-l-4 ${card.color}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold">
                    {isLoading ? '—' : overview ? card.getValue(overview) : 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isLoading ? '' : overview ? card.getSub(overview) : ''}
                  </p>
                </div>
                <Icon className={`h-8 w-8 ${card.iconColor} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
