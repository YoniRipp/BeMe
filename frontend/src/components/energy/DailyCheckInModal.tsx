import { useState, useEffect } from 'react';
import { DailyCheckIn } from '@/types/energy';
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
import { toLocalDateString } from '@/lib/dateRanges';

interface DailyCheckInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (checkIn: Omit<DailyCheckIn, 'id'>) => void;
  checkIn?: DailyCheckIn;
}

export function DailyCheckInModal({ open, onOpenChange, onSave, checkIn }: DailyCheckInModalProps) {
  const [formData, setFormData] = useState({
    date: toLocalDateString(new Date()),
    sleepHours: '',
  });

  useEffect(() => {
    if (checkIn) {
      setFormData({
        date: toLocalDateString(new Date(checkIn.date)),
        sleepHours: checkIn.sleepHours?.toString() || '',
      });
    } else {
      setFormData({
        date: toLocalDateString(new Date()),
        sleepHours: '',
      });
    }
  }, [checkIn, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      date: new Date(formData.date),
      sleepHours: formData.sleepHours ? parseFloat(formData.sleepHours) : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Daily Check-in</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="sleepHours">Sleep Hours</Label>
              <Input
                id="sleepHours"
                type="number" inputMode="decimal"
                step="0.5"
                min="0"
                max="24"
                required
                value={formData.sleepHours}
                onChange={(e) => setFormData({ ...formData, sleepHours: e.target.value })}
                placeholder="e.g., 7.5"
                aria-describedby="sleep-hours-help"
              />
              <p id="sleep-hours-help" className="text-sm text-muted-foreground mt-1">
                Enter the number of hours you slept
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
