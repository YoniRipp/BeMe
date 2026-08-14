import { useEffect, useState } from 'react';

/** Absent in non-browser environments and older WebViews. */
function matchMediaSafe(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(query);
}

/** True when matchMedia can be trusted at all; callers gating behaviour need to know. */
export function supportsMediaQueries(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

/**
 * Subscribes to a CSS media query, answering correctly from the first render.
 *
 * Returns `false` where matchMedia does not exist, which is indistinguishable from a
 * genuine non-match — callers gating behaviour rather than styling should pair this with
 * `supportsMediaQueries()`.
 */
export function useMediaQuery(query: string): boolean {
  // Read synchronously on the first render. Waiting for the effect leaves a frame where
  // the answer is wrong, which matters when callers gate behaviour on it rather than
  // just styling.
  const [matches, setMatches] = useState(() => matchMediaSafe(query)?.matches ?? false);

  useEffect(() => {
    const mql = matchMediaSafe(query);
    if (!mql) return;
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Matches Tailwind's `lg` breakpoint, where the sidebar stops being a drawer. */
export const LG_BREAKPOINT_QUERY = '(min-width: 1024px)';
