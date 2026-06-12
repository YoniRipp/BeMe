import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { WorkoutTemplate } from './workoutModalUtils';

interface WorkoutTemplateChipsProps {
  templates: WorkoutTemplate[];
  onLoad: (template: WorkoutTemplate) => void;
  onDelete: (index: number) => void;
}

/** "Saved Workouts" strip in the editor: tap a chip to load a template, or delete it. */
export function WorkoutTemplateChips({ templates, onLoad, onDelete }: WorkoutTemplateChipsProps) {
  if (templates.length === 0) return null;

  return (
    <div className="p-3 bg-muted rounded-lg">
      <Label className="mb-2 block">Saved Workouts</Label>
      <div className="flex flex-wrap gap-2">
        {templates.map((t, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onLoad(t)}
              className="text-xs"
            >
              <Copy className="w-3 h-3 mr-1" />
              {t.title}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onDelete(idx)}
              aria-label={`Delete template: ${t.title}`}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
