import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query. Starts `false` on the server and on the first client
 * render, then settles after mount — so treat it as "not yet known" rather than "false".
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Absent in non-browser environments and older WebViews; treat as "no match"
    // rather than throwing during render.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Matches Tailwind's `lg` breakpoint, where the sidebar stops being a drawer. */
export const LG_BREAKPOINT_QUERY = '(min-width: 1024px)';
