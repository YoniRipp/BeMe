import { memo } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImagePlaceholder } from '@/components/shared/ImagePlaceholder';
import { getFoodImageUrl } from '@/hooks/useFoodImages';
import type { FoodEntry } from '@/types/energy';

interface FoodCardProps {
  entry: FoodEntry;
  onEdit: (entry: FoodEntry) => void;
  onDelete: (id: string) => void;
}

export const FoodCard = memo(function FoodCard({ entry, onEdit, onDelete }: FoodCardProps) {
  const portionText = entry.portionAmount != null
    ? `${entry.portionAmount}${entry.portionUnit ? ` ${entry.portionUnit}` : ''}`
    : null;

  return (
    <div
      className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3 shadow-card hover:border-primary/35 transition-colors cursor-pointer tap-target"
      role="button"
      tabIndex={0}
      aria-label={`Food entry: ${entry.name}, ${entry.calories} calories`}
      onClick={() => onEdit(entry)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit(entry);
        }
      }}
    >
      <div className="shrink-0">
        <ImagePlaceholder type="food" size="md" imageUrl={getFoodImageUrl(entry.name)} className="rounded-xl" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-extrabold text-foreground truncate leading-tight">{entry.name}</p>
        {portionText && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{portionText}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <div className="text-right pr-1">
          <p className="text-[18px] font-extrabold leading-none tabular-nums text-primary">{entry.calories}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">kcal</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-muted-foreground hover:text-destructive reveal-on-hover transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry.id);
          }}
          aria-label={`Delete food entry: ${entry.name}`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
});
