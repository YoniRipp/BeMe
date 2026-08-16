import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Dumbbell, WifiOff, Plus } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ImagePlaceholder } from '@/components/shared/ImagePlaceholder';
import {
  useExercises,
  EQUIPMENT_FILTERS,
  MUSCLE_FILTERS,
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  type CatalogExercise,
} from '@/hooks/useExercises';
import { cn } from '@/lib/utils';

/** Rows rendered up front; more are appended as the user scrolls. */
const PAGE_SIZE = 40;

interface ExercisePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exercise: CatalogExercise) => void;
  /** Shown in the header, e.g. "Replace Bench Press". */
  title?: string;
  /** Tapping the thumbnail opens the full image instead of selecting the row. */
  onPreviewImage?: (image: { src: string; alt: string }) => void;
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // min-h-11 keeps the chip on the 44px touch-target floor for gym use.
        'flex min-h-11 shrink-0 items-center rounded-full border px-4 text-xs font-bold transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

/**
 * Add a movement the catalog doesn't have. Deliberately three fields: a name the user has
 * usually already typed into the search box, and the two facets the picker filters on — a
 * new exercise with no muscle group would be invisible behind any filter chip.
 *
 * The exercise is added to the shared catalog, so everyone gets it. The copy says so:
 * people should know they are contributing, not saving something private.
 */
function CreateExerciseForm({
  initialName,
  isCreating,
  error,
  onCancel,
  onCreate,
}: {
  initialName: string;
  isCreating: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: (values: { name: string; muscleGroup?: string; equipment?: string }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [muscleGroup, setMuscleGroup] = useState<string | undefined>();
  const [equipment, setEquipment] = useState<string | undefined>();

  const trimmed = name.trim();
  const canSubmit = trimmed.length >= 2 && !isCreating;

  return (
    <form
      className="rounded-2xl border border-border bg-card p-4 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onCreate({ name: trimmed, muscleGroup, equipment });
      }}
    >
      <p className="text-[15px] font-bold leading-tight text-foreground">New exercise</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Added to the shared exercise library — everyone can use it.
      </p>

      <label className="mt-3 block text-eyebrow font-bold uppercase tracking-wider text-muted-foreground" htmlFor="custom-exercise-name">
        Name
      </label>
      <Input
        id="custom-exercise-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Zercher Squat"
        className="mt-1.5 h-11"
        maxLength={80}
        autoComplete="off"
        autoFocus
      />

      <p className="mt-3 text-eyebrow font-bold uppercase tracking-wider text-muted-foreground">Muscle group</p>
      <div className="-mx-1 mt-1.5 flex flex-wrap gap-2 px-1">
        {MUSCLE_FILTERS.map((mg) => (
          <FilterChip
            key={mg}
            label={MUSCLE_LABELS[mg] ?? mg}
            active={muscleGroup === mg}
            onClick={() => setMuscleGroup(muscleGroup === mg ? undefined : mg)}
          />
        ))}
      </div>

      <p className="mt-3 text-eyebrow font-bold uppercase tracking-wider text-muted-foreground">Equipment</p>
      <div className="-mx-1 mt-1.5 flex flex-wrap gap-2 px-1">
        {EQUIPMENT_FILTERS.map((eq) => (
          <FilterChip
            key={eq}
            label={EQUIPMENT_LABELS[eq] ?? eq}
            active={equipment === eq}
            onClick={() => setEquipment(equipment === eq ? undefined : eq)}
          />
        ))}
      </div>

      {error && (
        <p className="mt-3 text-xs font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {isCreating ? 'Adding…' : 'Add exercise'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ExercisePickerSheet({
  open,
  onOpenChange,
  onSelect,
  title = 'Add exercise',
  onPreviewImage,
}: ExercisePickerSheetProps) {
  const { filterExercises, isLoading, error, reload, createExercise, isCreating } = useExercises();
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<string | undefined>();
  const [muscleGroup, setMuscleGroup] = useState<string | undefined>();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Start each visit from a clean slate.
  useEffect(() => {
    if (open) {
      setQuery('');
      setEquipment(undefined);
      setMuscleGroup(undefined);
      setVisibleCount(PAGE_SIZE);
      setCreating(false);
      setCreateError(null);
    }
  }, [open]);

  const handleCreate = async (values: { name: string; muscleGroup?: string; equipment?: string }) => {
    setCreateError(null);
    try {
      // Selecting straight after creating is the whole point — the user came here to log
      // this movement, not to file it. An existing name resolves to that catalog row, so
      // they still leave with a usable exercise.
      const created = await createExercise(values);
      setCreating(false);
      onSelect(created);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Could not add the exercise. Please try again.');
    }
  };

  // filterExercises changes identity when the catalog does, so a late arrival (a retry
  // that lands after `isLoading` already went false, or a reconnect) recomputes here.
  const results = useMemo(
    () => filterExercises({ query, equipment, muscleGroup }),
    [filterExercises, query, equipment, muscleGroup],
  );

  // Reset paging and scroll position whenever the result set changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query, equipment, muscleGroup]);

  const visible = results.slice(0, visibleCount);
  const hasFilters = Boolean(query || equipment || muscleGroup);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || visibleCount >= results.length) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) {
      setVisibleCount((c) => c + PAGE_SIZE);
    }
  };

  const clearFilters = () => {
    setQuery('');
    setEquipment(undefined);
    setMuscleGroup(undefined);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="pulse-bottom-sheet flex h-[88vh] flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 pb-3 pt-4 text-left">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="truncate text-lg font-extrabold tracking-tight">
              {creating ? 'New exercise' : title}
            </SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close exercise picker"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search and facets belong to browsing; while the create form is open they
              would compete with the form's own chips. */}
          {!creating && (
            <>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search exercises"
                className="h-11 pl-9"
                autoComplete="off"
                aria-label="Search exercises"
              />
            </div>

            <div className="-mx-4 mt-1 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FilterChip label="All gear" active={!equipment} onClick={() => setEquipment(undefined)} />
              {EQUIPMENT_FILTERS.map((eq) => (
                <FilterChip
                  key={eq}
                  label={EQUIPMENT_LABELS[eq] ?? eq}
                  active={equipment === eq}
                  onClick={() => setEquipment(equipment === eq ? undefined : eq)}
                />
              ))}
            </div>

            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FilterChip label="All muscles" active={!muscleGroup} onClick={() => setMuscleGroup(undefined)} />
              {MUSCLE_FILTERS.map((mg) => (
                <FilterChip
                  key={mg}
                  label={MUSCLE_LABELS[mg] ?? mg}
                  active={muscleGroup === mg}
                  onClick={() => setMuscleGroup(muscleGroup === mg ? undefined : mg)}
                />
              ))}
            </div>
            </>
          )}

        </SheetHeader>

        <div
          ref={listRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
        >
          {creating ? (
            <CreateExerciseForm
              initialName={query.trim()}
              isCreating={isCreating}
              error={createError}
              onCancel={() => {
                setCreating(false);
                setCreateError(null);
              }}
              onCreate={handleCreate}
            />
          ) : isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading exercises…</p>
          ) : error ? (
            // A failed fetch used to fall through to the empty state, which told the user
            // their exercise doesn't exist instead of that the catalog never arrived.
            <div className="py-12 text-center" role="alert">
              <WifiOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">Couldn’t load exercises</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-4 inline-flex min-h-11 items-center rounded-full border border-border px-5 text-xs font-bold text-primary transition-colors hover:bg-primary/5"
              >
                Try again
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <Dumbbell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">No exercises found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasFilters ? 'Try a different search or filter.' : 'The exercise catalog is empty.'}
              </p>
              <div className="mt-4 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {query.trim() ? `Add "${query.trim()}"` : 'Add a custom exercise'}
                </button>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-xs font-bold text-primary transition-colors hover:bg-primary/5"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="px-0.5 pb-2 text-eyebrow font-bold uppercase tracking-wider text-muted-foreground">
                {results.length} {results.length === 1 ? 'exercise' : 'exercises'}
              </p>
              <div className="space-y-1.5">
                {visible.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-card transition-colors hover:border-primary/40"
                  >
                    {ex.imageUrl && onPreviewImage ? (
                      <button
                        type="button"
                        className="shrink-0"
                        onClick={() => onPreviewImage({ src: ex.imageUrl!, alt: ex.name })}
                        aria-label={`View image for ${ex.name}`}
                      >
                        <ImagePlaceholder type="exercise" size="md" imageUrl={ex.imageUrl} />
                      </button>
                    ) : (
                      <ImagePlaceholder type="exercise" size="md" imageUrl={ex.imageUrl} />
                    )}
                    <button
                      type="button"
                      onClick={() => onSelect(ex)}
                      className="min-w-0 flex-1 text-left tap-target"
                      aria-label={`Select ${ex.name}`}
                    >
                      <p className="truncate text-[15px] font-bold leading-tight text-foreground">{ex.name}</p>
                      <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">
                        {[
                          MUSCLE_LABELS[ex.muscleGroup ?? ''] ?? ex.muscleGroup,
                          EQUIPMENT_LABELS[ex.equipment ?? ex.category ?? ''] ?? ex.equipment ?? ex.category,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </button>
                  </div>
                ))}
              </div>
              {visibleCount < results.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="mt-3 min-h-11 w-full rounded-xl border border-dashed border-border text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  Show more
                </button>
              )}
              {/* Results can be non-empty and still miss what the user means — a near-match
                  by name is exactly when someone needs this most. */}
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-xs font-bold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Can’t find it? Add an exercise
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
