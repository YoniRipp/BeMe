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

export interface SleepEditCheckIn {
  id: string;
  date: string;
  sleepHours?: number;
}

interface SleepEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (hours: number) => void;
  /** When set, edit this check-in (show date, prefill hours). When not set, edit/add for today using currentHours. */
  checkIn?: SleepEditCheckIn;
  /** Used when checkIn is not set (today mode). */
  currentHours?: number;
}

export function SleepEditModal({
  open,
  onOpenChange,
  onSave,
  checkIn,
  currentHours,
}: SleepEditModalProps) {
  const initialHours = checkIn != null ? checkIn.sleepHours : currentHours;
  const [hours, setHours] = useState(initialHours?.toString() || '');

  useEffect(() => {
    const value = checkIn != null ? checkIn.sleepHours : currentHours;
    setHours(value?.toString() || '');
  }, [checkIn, currentHours, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(parseFloat(hours));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{checkIn ? 'Edit Sleep' : 'Log Sleep'}</DialogTitle>
          <DialogDescription>Record how many hours you slept.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {checkIn && (
              <div>
                <Label>Date</Label>
                <p className="text-sm text-muted-foreground mt-1" aria-readonly>
                  {checkIn.date}
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="hours">Sleep Hours</Label>
              <Input
                id="hours"
                type="number" inputMode="decimal"
                step="0.5"
                min="0"
                max="24"
                required
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g., 7.5"
              />
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
