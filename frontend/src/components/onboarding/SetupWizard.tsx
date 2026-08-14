import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/components/shared/ToastProvider';
import { User, Scale, Activity, Heart, Check } from 'lucide-react';

const STEPS = ['Welcome', 'Basic Info', 'Body Stats', 'Activity', 'Complete'];

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const { updateProfile } = useProfile();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    sex: '',
    dateOfBirth: '',
    heightCm: '',
    currentWeight: '',
    targetWeight: '',
    activityLevel: '',
    cycleTrackingEnabled: false,
    averageCycleLength: '28',
  });

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSkip = async () => {
    try {
      await updateProfile({ setupCompleted: true });
      onComplete();
    } catch {
      toast.error('Something went wrong');
    }
  };

  const handleFinish = async () => {
    try {
      await updateProfile({
        sex: formData.sex || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        heightCm: formData.heightCm ? Number(formData.heightCm) : undefined,
        currentWeight: formData.currentWeight ? Number(formData.currentWeight) : undefined,
        targetWeight: formData.targetWeight ? Number(formData.targetWeight) : undefined,
        activityLevel: formData.activityLevel || undefined,
        cycleTrackingEnabled: formData.cycleTrackingEnabled,
        averageCycleLength: formData.cycleTrackingEnabled ? Number(formData.averageCycleLength) : undefined,
        setupCompleted: true,
      });
      toast.success('Profile setup complete!');
      onComplete();
    } catch {
      toast.error('Could not save profile');
    }
  };

  const bmi = formData.heightCm && formData.currentWeight
    ? (Number(formData.currentWeight) / ((Number(formData.heightCm) / 100) ** 2)).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardContent className="p-6">
          {/* Progress */}
          <div className="flex gap-1 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Heart className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Welcome to TrackVibe</h2>
              <p className="text-muted-foreground">
                Let's set up your profile to personalize your fitness experience.
                This only takes a minute.
              </p>
            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">Basic Info</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Sex</Label>
                  <Select value={formData.sex} onValueChange={(v) => setFormData({ ...formData, sex: v })}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Body Stats */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">Body Stats</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Height (cm)</Label>
                  <Input
                    type="number" inputMode="numeric"
                    placeholder="170"
                    value={formData.heightCm}
                    onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
                    min={50}
                    max={300}
                  />
                </div>
                <div>
                  <Label>Current Weight (kg)</Label>
                  <Input
                    type="number" inputMode="numeric"
                    placeholder="70"
                    value={formData.currentWeight}
                    onChange={(e) => setFormData({ ...formData, currentWeight: e.target.value })}
                    min={10}
                    max={500}
                    step={0.1}
                  />
                </div>
                <div>
                  <Label>Target Weight (kg)</Label>
                  <Input
                    type="number" inputMode="numeric"
                    placeholder="65"
                    value={formData.targetWeight}
                    onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
                    min={10}
                    max={500}
                    step={0.1}
                  />
                </div>
                {bmi && (
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">Your BMI</p>
                    <p className="text-2xl font-bold">{bmi}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Activity Level */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">Activity Level</h2>
              </div>
              <div className="space-y-2">
                {[
                  { value: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise' },
                  { value: 'light', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
                  { value: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
                  { value: 'active', label: 'Active', desc: 'Hard exercise 6-7 days/week' },
                  { value: 'very_active', label: 'Very Active', desc: 'Very hard exercise, physical job' },
                ].map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setFormData({ ...formData, activityLevel: level.value })}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      formData.activityLevel === level.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium text-sm">{level.label}</p>
                    <p className="text-xs text-muted-foreground">{level.desc}</p>
                  </button>
                ))}
              </div>

              {/* Cycle tracking (shown for females) */}
              {formData.sex === 'female' && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Cycle Tracking</p>
                      <p className="text-xs text-muted-foreground">Track your menstrual cycle</p>
                    </div>
                    <Button
                      variant={formData.cycleTrackingEnabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData({ ...formData, cycleTrackingEnabled: !formData.cycleTrackingEnabled })}
                    >
                      {formData.cycleTrackingEnabled ? 'Enabled' : 'Enable'}
                    </Button>
                  </div>
                  {formData.cycleTrackingEnabled && (
                    <div className="mt-3">
                      <Label>Average Cycle Length (days)</Label>
                      <Input
                        type="number" inputMode="numeric"
                        value={formData.averageCycleLength}
                        onChange={(e) => setFormData({ ...formData, averageCycleLength: e.target.value })}
                        min={15}
                        max={60}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 4 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-success" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold">All Set!</h2>
              <p className="text-muted-foreground">
                Your profile is ready. You can always update these settings later.
              </p>
              {bmi && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Your BMI</p>
                  <p className="text-3xl font-bold">{bmi}</p>
                </div>
              )}
              <div className="text-left space-y-2 bg-muted/30 rounded-lg p-4">
                {formData.heightCm && <p className="text-sm"><span className="text-muted-foreground">Height:</span> {formData.heightCm} cm</p>}
                {formData.currentWeight && <p className="text-sm"><span className="text-muted-foreground">Weight:</span> {formData.currentWeight} kg</p>}
                {formData.targetWeight && <p className="text-sm"><span className="text-muted-foreground">Target:</span> {formData.targetWeight} kg</p>}
                {formData.activityLevel && <p className="text-sm"><span className="text-muted-foreground">Activity:</span> {formData.activityLevel.replace('_', ' ')}</p>}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            {step === 0 ? (
              <Button variant="ghost" size="sm" onClick={handleSkip}>Skip</Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleBack}>Back</Button>
            )}
            <span className="text-xs text-muted-foreground">{step + 1} of {STEPS.length}</span>
            {step === STEPS.length - 1 ? (
              <Button size="sm" onClick={handleFinish}>Get Started</Button>
            ) : (
              <Button size="sm" onClick={handleNext}>Next</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
