import { useState, useEffect } from 'react';
import { SettingsSection } from './SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProfile } from '@/hooks/useProfile';
import { Heart } from 'lucide-react';
import { toast } from '@/components/shared/ToastProvider';

export function CycleSection() {
  const { profile, updateProfile, isUpdating } = useProfile();
  const [enabled, setEnabled] = useState(false);
  const [cycleLength, setCycleLength] = useState('28');

  useEffect(() => {
    if (profile) {
      setEnabled(profile.cycleTrackingEnabled);
      setCycleLength((profile.averageCycleLength ?? 28).toString());
    }
  }, [profile]);

  const handleToggle = async () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    try {
      await updateProfile({
        cycleTrackingEnabled: newEnabled,
        averageCycleLength: newEnabled ? Number(cycleLength) : undefined,
      });
      toast.success(newEnabled ? 'Cycle tracking enabled' : 'Cycle tracking disabled');
    } catch {
      setEnabled(!newEnabled);
      toast.error('Could not update setting');
    }
  };

  const handleSaveCycleLength = async () => {
    try {
      await updateProfile({ averageCycleLength: Number(cycleLength) });
      toast.success('Cycle length updated');
    } catch {
      toast.error('Could not update cycle length');
    }
  };

  return (
    <SettingsSection icon={Heart} title="Cycle Tracking" iconColor="text-pink-500">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Enable Cycle Tracking</p>
            <p className="text-xs text-muted-foreground">Track your menstrual cycle and get predictions</p>
          </div>
          <Button
            variant={enabled ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggle}
            disabled={isUpdating}
          >
            {enabled ? 'On' : 'Off'}
          </Button>
        </div>

        {enabled && (
          <div className="space-y-3 border-t pt-3">
            <div>
              <Label className="text-xs">Average Cycle Length (days)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  className="h-9"
                  value={cycleLength}
                  onChange={(e) => setCycleLength(e.target.value)}
                  min={15}
                  max={60}
                />
                <Button size="sm" className="h-9" onClick={handleSaveCycleLength} disabled={isUpdating}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
