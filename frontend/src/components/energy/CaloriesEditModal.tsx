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
import { Label } from '@/components/ui/label';

interface CaloriesEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (consumed: number, burned: number) => void;
  currentConsumed?: number;
  currentBurned?: number;
}

export function CaloriesEditModal({ 
  open, 
  onOpenChange, 
  onSave, 
  currentConsumed = 0, 
  currentBurned = 0 
}: CaloriesEditModalProps) {
  const [consumed, setConsumed] = useState(currentConsumed.toString());
  const [burned, setBurned] = useState(currentBurned.toString());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(parseInt(consumed), parseInt(burned));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Calories</DialogTitle>
          <DialogDescription>Adjust the calorie total recorded for this entry.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="consumed">Calories Consumed</Label>
              <Input
                id="consumed"
                type="number" inputMode="numeric"
                min="0"
                required
                value={consumed}
                onChange={(e) => setConsumed(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="burned">Calories Burned</Label>
              <Input
                id="burned"
                type="number" inputMode="numeric"
                min="0"
                required
                value={burned}
                onChange={(e) => setBurned(e.target.value)}
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
