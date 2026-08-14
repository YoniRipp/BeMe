import { useState, useEffect } from 'react';
import { Goal, GoalType, GoalPeriod, GOAL_TYPES, GOAL_PERIODS } from '@/types/goals';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface GoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (goal: Omit<Goal, 'id' | 'createdAt'>) => void;
  goal?: Goal;
}

export function GoalModal({ open, onOpenChange, onSave, goal }: GoalModalProps) {
  const [formData, setFormData] = useState({
    type: 'calories' as GoalType,
    target: '',
    period: 'daily' as GoalPeriod,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (goal) {
      setFormData({
        type: goal.type,
        target: goal.target.toString(),
        period: goal.period,
      });
    } else {
      setFormData({
        type: 'calories',
        target: '',
        period: 'daily',
      });
    }
    setErrors({});
  }, [goal, open]);

  const isFormValid = () => {
    if (!formData.target) return false;
    const targetNum = parseFloat(formData.target);
    if (isNaN(targetNum) || targetNum <= 0) return false;
    return !errors.target && !errors.type && !errors.period;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const targetNum = parseFloat(formData.target);
    if (isNaN(targetNum) || targetNum <= 0) {
      setErrors({ target: 'Target must be a positive number' });
      return;
    }

    if (!isFormValid()) {
      return;
    }

    onSave({
      type: formData.type,
      target: targetNum,
      period: formData.period,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? 'Edit Goal' : 'Add Goal'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="type">Goal Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => {
                  const newType = value as GoalType;
                  const period = !goal && (newType === 'calories' || newType === 'sleep') ? 'daily' : !goal && newType !== 'calories' && newType !== 'sleep' ? 'weekly' : formData.period;
                  setFormData({ ...formData, type: newType, period });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="target">Target</Label>
              <Input
                id="target"
                type="number" inputMode="numeric"
                min="1"
                required
                value={formData.target}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ ...formData, target: value });
                  if (value) {
                    const num = parseFloat(value);
                    if (isNaN(num) || num <= 0) {
                      setErrors({ ...errors, target: 'Target must be a positive number' });
                    } else {
                      setErrors({ ...errors, target: '' });
                    }
                  } else {
                    setErrors({ ...errors, target: '' });
                  }
                }}
                aria-invalid={!!errors.target}
                aria-describedby={errors.target ? 'target-error' : undefined}
              />
              {errors.target && (
                <p id="target-error" className="text-sm text-destructive mt-1">
                  {errors.target}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                {formData.type === 'calories' && 'Target calories for this period'}
                {formData.type === 'workouts' && 'Target number of workouts for this period'}
                {formData.type === 'sleep' && 'Target average sleep hours for this period'}
              </p>
            </div>

            <div>
              <Label>Period</Label>
              <RadioGroup
                value={formData.period}
                onValueChange={(value) => setFormData({ ...formData, period: value as GoalPeriod })}
                className="mt-2"
              >
                {GOAL_PERIODS.map((period) => (
                  <div key={period} className="flex items-center space-x-2">
                    <RadioGroupItem value={period} id={period} />
                    <Label htmlFor={period} className="font-normal cursor-pointer capitalize">
                      {period}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isFormValid()}>
              {goal ? 'Update' : 'Add'} Goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
