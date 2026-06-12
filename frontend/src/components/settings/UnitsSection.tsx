import { useSettings } from '@/hooks/useSettings';
import { Ruler } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/shared/ToastProvider';
import { SettingsSection } from './SettingsSection';

export function UnitsSection() {
  const { settings, updateSettings } = useSettings();

  const handleUnitsChange = (value: string) => {
    updateSettings({ units: value as (typeof settings)['units'] });
    toast.success('Units updated');
  };

  return (
    <SettingsSection icon={Ruler} title="Units" iconColor="text-purple-600">
      <div className="space-y-2">
        <Label>Measurement Units</Label>
        <Select value={settings.units} onValueChange={handleUnitsChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="metric">Metric (kg, cm)</SelectItem>
            <SelectItem value="imperial">Imperial (lbs, in)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Used for weight and measurements in workouts
        </p>
      </div>
    </SettingsSection>
  );
}
