import { useSettings } from '@/hooks/useSettings';
import { Calendar } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DATE_FORMATS } from '@/types/settings';
import { formatDate as formatDateUtil } from '@/lib/utils';
import { toast } from '@/components/shared/ToastProvider';
import { SettingsSection } from './SettingsSection';

export function DateFormatSection() {
  const { settings, updateSettings } = useSettings();

  const handleDateFormatChange = (value: string) => {
    updateSettings({ dateFormat: value as (typeof settings)['dateFormat'] });
    toast.success('Date format updated');
  };

  return (
    <SettingsSection icon={Calendar} title="Date Format" iconColor="text-blue-600">
      <div className="space-y-2">
        <Label>Date Format</Label>
        <Select value={settings.dateFormat} onValueChange={handleDateFormatChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_FORMATS.map((format) => (
              <SelectItem key={format.value} value={format.value}>
                {format.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Preview: {formatDateUtil(new Date(), settings.dateFormat)}
        </p>
      </div>
    </SettingsSection>
  );
}
