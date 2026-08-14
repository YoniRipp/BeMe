import { useState } from 'react';
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
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/shared/ToastProvider';
import { toLocalDateString } from '@/lib/dateRanges';
import { format, addDays } from 'date-fns';

interface DuplicateDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDuplicate: (sourceDate: string, targetDate: string) => Promise<void>;
}

export function DuplicateDayDialog({
  open,
  onOpenChange,
  onDuplicate,
}: DuplicateDayDialogProps) {
  const [sourceDate, setSourceDate] = useState(() =>
    toLocalDateString(new Date()),
  );
  const [targetDate, setTargetDate] = useState(() =>
    toLocalDateString(addDays(new Date(), 1)),
  );
  const [saving, setSaving] = useState(false);

  const handleDuplicate = async () => {
    if (sourceDate === targetDate) {
      toast.error('Source and target dates must be different.');
      return;
    }
    setSaving(true);
    try {
      await onDuplicate(sourceDate, targetDate);
      toast.success(`Copied entries to ${format(new Date(targetDate + 'T00:00:00'), 'MMM d')}`);
      onOpenChange(false);
    } catch {
      toast.error('Failed to duplicate entries. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy Day&apos;s Food</DialogTitle>
          <DialogDescription>Copy every food entry from one day onto another.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Copy all food entries from one day to another.
          </p>

          <div>
            <label htmlFor="source-date" className="text-sm font-medium">
              Copy from
            </label>
            <Input
              id="source-date"
              type="date"
              value={sourceDate}
              onChange={(e) => setSourceDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label htmlFor="target-date" className="text-sm font-medium">
              Copy to
            </label>
            <Input
              id="target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleDuplicate} disabled={saving || !sourceDate || !targetDate}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Copying...
              </>
            ) : (
              'Copy Entries'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
