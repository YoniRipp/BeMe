import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { toast } from '@/components/shared/ToastProvider';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { AccountSection } from '@/components/settings/AccountSection';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { CycleSection } from '@/components/settings/CycleSection';
import { useProfile } from '@/hooks/useProfile';
import { DateFormatSection } from '@/components/settings/DateFormatSection';
import { UnitsSection } from '@/components/settings/UnitsSection';
import { AppearanceSection } from '@/components/settings/AppearanceSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';
import { DataManagementSection } from '@/components/settings/DataManagementSection';
import { SubscriptionSection } from '@/components/settings/SubscriptionSection';
import { storage } from '@/lib/storage';
import { PendingInvitations } from '@/components/trainer/PendingInvitations';
import { useApp } from '@/context/AppContext';
import { Page, PageHeader } from '@/components/ui/page';
import { Card } from '@/components/ui/card';

export function Settings() {
  const { updateSettings } = useSettings();
  const { profile } = useProfile();
  const { user } = useApp();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleClearData = () => {
    try {
      storage.clear();
      toast.success('All data cleared');
      window.location.reload();
    } catch {
      toast.error('Could not clear data. Please try again.');
    }
  };

  const handleResetSettings = () => {
    try {
      updateSettings(DEFAULT_SETTINGS);
      toast.success('Settings reset to defaults');
    } catch {
      toast.error('Could not reset settings. Please try again.');
    }
  };

  return (
    <Page className="space-y-5">
      <PageHeader kicker="Profile" title="Settings" subtitle="Manage your account, preferences, and data." />
      <Card className="flex items-center gap-4 p-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground shadow-card-lg">
          {(user?.name ?? 'T').trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold tracking-tight">{user?.name ?? 'TrackVibe user'}</p>
          <p className="text-sm text-muted-foreground">
            {profile.activityLevel ? `${profile.activityLevel} activity` : 'Fitness profile'}
          </p>
        </div>
      </Card>
      <SubscriptionSection />
      <AccountSection />
      <ProfileSection />
      {profile.sex === 'female' && <CycleSection />}
      <DateFormatSection />
      <UnitsSection />
      <AppearanceSection />
      <NotificationsSection />
      <PendingInvitations />
      <DataManagementSection
        onResetClick={() => setShowResetConfirm(true)}
        onClearClick={() => setShowClearConfirm(true)}
      />

      <ConfirmationDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Clear All Data"
        message="Are you sure you want to delete all your data? This action cannot be undone. All workouts, food entries, and other data will be permanently deleted."
        onConfirm={handleClearData}
        confirmLabel="Clear All Data"
        cancelLabel="Cancel"
        variant="destructive"
      />

      <ConfirmationDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Reset Settings"
        message="Are you sure you want to reset all settings to their default values? Your data will not be affected."
        onConfirm={handleResetSettings}
        confirmLabel="Reset Settings"
        cancelLabel="Cancel"
        variant="default"
      />
    </Page>
  );
}
