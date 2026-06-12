import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { searchFoods, lookupOrCreateFood, type FoodSearchResult } from '@/features/energy/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ScanBarcode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MIN_SEARCH_LENGTH } from '@/components/energy/foodEntryUtils';

interface FoodSearchSectionProps {
  /** Called when the user picks a search result or an AI lookup resolves. */
  onSelectFood: (item: FoodSearchResult) => void;
  /** Opens the barcode scanner overlay (owned by the parent). */
  onScanBarcode: () => void;
  /** True while a scanned barcode is being resolved. */
  isScanLooking: boolean;
}

/** Debounced food search with a results dropdown, AI lookup fallback, and barcode scan trigger. */
export function FoodSearchSection({ onSelectFood, onScanBarcode, isScanLooking }: FoodSearchSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    const q = debouncedSearchQuery.trim();
    if (q.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    setSearchError(null);
    searchFoods(q, 10)
      .then((results) => {
        if (!cancelled) {
          setSearchResults(results);
          setSearchError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setSearchError(e instanceof Error ? e.message : 'Could not search for food. Please try again.');
          setSearchResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery]);

  const handleSelectFood = useCallback(
    (item: FoodSearchResult) => {
      onSelectFood(item);
      setSearchQuery('');
      setSearchResults([]);
      setDropdownOpen(false);
      setSearchError(null);
    },
    [onSelectFood]
  );

  const handleSearchBlur = useCallback(() => {
    setTimeout(() => setDropdownOpen(false), 150);
  }, []);

  const handleLookupWithAI = useCallback(async () => {
    const name = searchQuery.trim();
    if (name.length < 2) return;
    setIsLookingUp(true);
    setSearchError(null);
    try {
      const result = await lookupOrCreateFood(name);
      handleSelectFood(result);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Could not look up food. Please try again.');
    } finally {
      setIsLookingUp(false);
    }
  }, [searchQuery, handleSelectFood]);

  const showDropdown =
    dropdownOpen &&
    searchQuery.trim().length >= MIN_SEARCH_LENGTH &&
    (isSearching || searchResults.length > 0 || !!searchError);

  return (
    <div className="relative">
      <Label htmlFor="food-search">Search food (optional)</Label>
      <div className="flex gap-2">
        <Input
          id="food-search"
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => searchQuery.trim().length >= MIN_SEARCH_LENGTH && setDropdownOpen(true)}
          onBlur={handleSearchBlur}
          placeholder="e.g., chicken, apple"
          aria-label="Search for food to auto-fill nutrients"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="food-search-results"
          className={cn('flex-1', showDropdown && 'rounded-b-none border-b-0')}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={isScanLooking}
          onClick={onScanBarcode}
          title="Scan barcode"
          aria-label="Scan product barcode"
        >
          {isScanLooking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScanBarcode className="h-4 w-4" />
          )}
        </Button>
      </div>
      {showDropdown && (
        <div
          id="food-search-results"
          role="listbox"
          className="absolute z-50 w-full rounded-b-md border border-t-0 border-input bg-popover shadow-md max-h-48 overflow-auto"
        >
          {isSearching && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}
          {!isSearching && searchError && (
            <p className="px-3 py-3 text-sm text-destructive">{searchError}</p>
          )}
          {!isSearching && !searchError && searchResults.length === 0 && (
            <div className="px-3 py-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                No results – enter manually below.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isLookingUp || searchQuery.trim().length < 2}
                onClick={(e) => {
                  e.preventDefault();
                  void handleLookupWithAI();
                }}
              >
                {isLookingUp ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Looking up…
                  </>
                ) : (
                  'Look up with AI'
                )}
              </Button>
            </div>
          )}
          {!isSearching && !searchError && searchResults.length > 0 && (
            <ul className="py-1">
              {searchResults.map((item, idx) => (
                <li key={`${item.name}-${idx}`} role="option">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectFood(item);
                    }}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {item.defaultUnit && item.unitWeightGrams
                        ? `${Math.round(item.calories * item.unitWeightGrams / 100)} cal/${item.defaultUnit}`
                        : `${item.calories} cal per 100 ${item.isLiquid ? 'ml' : 'g'}`
                      }
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
