import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MacroGoals } from '@/hooks/useMacroGoals';

interface MacroGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: MacroGoals;
  onSave: (goals: MacroGoals) => void;
}

export function MacroGoalModal({ open, onOpenChange, goals, onSave }: MacroGoalModalProps) {
  const [carbs, setCarbs] = useState(goals.carbs);
  const [fat, setFat] = useState(goals.fat);
  const [protein, setProtein] = useState(goals.protein);

  // Only reset local state when the modal transitions to open, not every
  // time `goals` reference changes (which happens on each profile render).
  useEffect(() => {
    if (open) {
      setCarbs(goals.carbs);
      setFat(goals.fat);
      setProtein(goals.protein);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = () => {
    onSave({
      carbs: Math.max(1, carbs),
      fat: Math.max(1, fat),
      protein: Math.max(1, protein),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Macro Goals</DialogTitle>
          <DialogDescription>Set your daily protein, carb and fat targets.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="macro-carbs">Carbs (g)</Label>
            <Input
              id="macro-carbs"
              type="number" inputMode="numeric"
              min={1}
              value={carbs}
              onChange={(e) => setCarbs(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="macro-fat">Fat (g)</Label>
            <Input
              id="macro-fat"
              type="number" inputMode="numeric"
              min={1}
              value={fat}
              onChange={(e) => setFat(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="macro-protein">Protein (g)</Label>
            <Input
              id="macro-protein"
              type="number" inputMode="numeric"
              min={1}
              value={protein}
              onChange={(e) => setProtein(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              Calorie goal:{' '}
              <span className="font-semibold text-foreground">
                {Math.max(1, carbs) * 4 + Math.max(1, fat) * 9 + Math.max(1, protein) * 4} cal
              </span>
            </p>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
