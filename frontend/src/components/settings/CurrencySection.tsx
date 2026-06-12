import { useSettings } from '@/hooks/useSettings';
import { DollarSign } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CURRENCIES, CURRENCY_LABELS } from '@/types/settings';
import { formatCurrency as formatCurrencyUtil } from '@/lib/utils';
import { toast } from '@/components/shared/ToastProvider';
import { SettingsSection } from './SettingsSection';

export function CurrencySection() {
  const { settings, updateSettings } = useSettings();

  const handleCurrencyChange = (value: string) => {
    updateSettings({ currency: value as (typeof settings)['currency'] });
    toast.success('Currency updated');
  };

  return (
    <SettingsSection icon={DollarSign} title="Currency" iconColor="text-green-600">
      <div className="space-y-2">
        <Label>Currency</Label>
        <Select value={settings.currency} onValueChange={handleCurrencyChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((currency) => (
              <SelectItem key={currency} value={currency}>
                {CURRENCY_LABELS[currency]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Preview: {formatCurrencyUtil(1000, settings.currency)}
        </p>
      </div>
    </SettingsSection>
  );
}
