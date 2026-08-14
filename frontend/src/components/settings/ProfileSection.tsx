import { useState, useEffect } from 'react';
import { SettingsSection } from './SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProfile } from '@/hooks/useProfile';
import { useSettings } from '@/hooks/useSettings';
import { User } from 'lucide-react';
import { toast } from '@/components/shared/ToastProvider';
import { DateOfBirthInput } from './DateOfBirthInput';

export function ProfileSection() {
  const { profile, updateProfile, isUpdating } = useProfile();
  const { settings } = useSettings();
  const [form, setForm] = useState({
    dateOfBirth: '',
    sex: '',
    heightCm: '',
    currentWeight: '',
    targetWeight: '',
    activityLevel: '',
    waterGoalGlasses: '8',
  });

  useEffect(() => {
    if (profile) {
      const dob = profile.dateOfBirth ?? '';
      // Accept either YYYY-MM-DD or an ISO datetime; ignore anything else.
      const normalizedDob = /^\d{4}-\d{2}-\d{2}/.test(dob) ? dob.slice(0, 10) : '';
      setForm({
        dateOfBirth: normalizedDob,
        sex: profile.sex ?? '',
        heightCm: profile.heightCm?.toString() ?? '',
        currentWeight: profile.currentWeight?.toString() ?? '',
        targetWeight: profile.targetWeight?.toString() ?? '',
        activityLevel: profile.activityLevel ?? '',
        waterGoalGlasses: (profile.waterGoalGlasses ?? 8).toString(),
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateProfile({
        dateOfBirth: form.dateOfBirth || undefined,
        sex: form.sex || undefined,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        currentWeight: form.currentWeight ? Number(form.currentWeight) : undefined,
        targetWeight: form.targetWeight ? Number(form.targetWeight) : undefined,
        activityLevel: form.activityLevel || undefined,
        waterGoalGlasses: Number(form.waterGoalGlasses) || 8,
      });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update profile');
    }
  };

  const bmi = form.heightCm && form.currentWeight
    ? (Number(form.currentWeight) / ((Number(form.heightCm) / 100) ** 2)).toFixed(1)
    : null;

  return (
    <SettingsSection icon={User} title="Profile" iconColor="text-info">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Sex</Label>
            <Select value={form.sex} onValueChange={(v) => setForm({ ...form, sex: v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Date of Birth</Label>
            <DateOfBirthInput
              value={form.dateOfBirth}
              onChange={(v) => setForm({ ...form, dateOfBirth: v })}
              dateFormat={settings.dateFormat}
              maxYear={new Date().getFullYear()}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Height (cm)</Label>
            <Input type="number" inputMode="numeric" className="h-9" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} min={50} max={300} />
          </div>
          <div>
            <Label className="text-xs">Weight (kg)</Label>
            <Input type="number" inputMode="numeric" className="h-9" value={form.currentWeight} onChange={(e) => setForm({ ...form, currentWeight: e.target.value })} min={10} max={500} step={0.1} />
          </div>
          <div>
            <Label className="text-xs">Target (kg)</Label>
            <Input type="number" inputMode="numeric" className="h-9" value={form.targetWeight} onChange={(e) => setForm({ ...form, targetWeight: e.target.value })} min={10} max={500} step={0.1} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Activity Level</Label>
            <Select value={form.activityLevel} onValueChange={(v) => setForm({ ...form, activityLevel: v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary</SelectItem>
                <SelectItem value="light">Lightly Active</SelectItem>
                <SelectItem value="moderate">Moderately Active</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="very_active">Very Active</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Water Goal (glasses)</Label>
            <Input type="number" inputMode="numeric" className="h-9" value={form.waterGoalGlasses} onChange={(e) => setForm({ ...form, waterGoalGlasses: e.target.value })} min={1} max={30} />
          </div>
        </div>

        {bmi && (
          <div className="bg-muted/50 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">BMI</span>
            <span className="font-semibold">{bmi}</span>
          </div>
        )}

        <Button onClick={handleSave} disabled={isUpdating} className="w-full">
          {isUpdating ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </SettingsSection>
  );
}
