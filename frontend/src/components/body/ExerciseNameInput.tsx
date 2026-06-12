import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { ImagePlaceholder } from '@/components/shared/ImagePlaceholder';
import type { CatalogExercise } from '@/hooks/useExercises';

/**
 * Free-text exercise name input with catalog autocomplete: type to filter the
 * exercise catalog, pick a suggestion with mouse or arrow keys + Enter.
 */
export function ExerciseNameInput({
  value,
  onChange,
  onBlur,
  exercises,
  placeholder,
  ariaInvalid,
  ariaDescribedBy,
}: {
  value: string;
  onChange: (val: string) => void;
  onBlur: () => void;
  exercises: CatalogExercise[];
  placeholder?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const query = value.toLowerCase().trim();
  const suggestions = query.length >= 1
    ? exercises.filter(ex => ex.name.toLowerCase().includes(query)).slice(0, 8)
    : [];

  useEffect(() => {
    setHighlightIdx(-1);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectSuggestion = (name: string) => {
    onChange(name);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        placeholder={placeholder}
        className="w-full font-semibold"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => onBlur(), 150);
        }}
        onKeyDown={(e) => {
          if (!showSuggestions || suggestions.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIdx(prev => Math.min(prev + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx(prev => Math.max(prev - 1, 0));
          } else if (e.key === 'Enter' && highlightIdx >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[highlightIdx].name);
          } else if (e.key === 'Escape') {
            setShowSuggestions(false);
          }
        }}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((ex, i) => (
            <button
              key={ex.id}
              type="button"
              className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                i === highlightIdx ? 'bg-muted' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(ex.name);
              }}
            >
              <ImagePlaceholder type="exercise" size="sm" imageUrl={ex.imageUrl} />
              <div className="min-w-0">
                <p className="font-medium truncate">{ex.name}</p>
                {ex.muscleGroup && (
                  <p className="text-xs text-muted-foreground capitalize">{ex.muscleGroup}{ex.category ? ` · ${ex.category}` : ''}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
