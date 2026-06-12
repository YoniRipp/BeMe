import { useSettings } from '@/hooks/useSettings';
import { useTheme } from 'next-themes';
import { Palette, Sun, Moon, Monitor } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BALANCE_DISPLAY_COLORS,
} from '@/types/settings';
import { toast } from '@/components/shared/ToastProvider';
import { SettingsSection } from './SettingsSection';

export function AppearanceSection() {
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();

  const handleBalanceColorChange = (value: string) => {
    updateSettings({ balanceDisplayColor: value as (typeof settings)['balanceDisplayColor'] });
    toast.success('Accent color updated');
  };

  const handleThemeChange = (value: string) => {
    setTheme(value);
    toast.success(`Theme set to ${value}`);
  };

  return (
    <SettingsSection icon={Palette} title="Appearance" iconColor="text-primary">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleThemeChange(value)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors tap-target ${
                  theme === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Choose your preferred theme or match your system settings.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Accent color</Label>
          <Select value={settings.balanceDisplayColor} onValueChange={handleBalanceColorChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BALANCE_DISPLAY_COLORS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Primary color for buttons, links, and highlights across the app.
          </p>
        </div>
      </div>
    </SettingsSection>
  );
}
