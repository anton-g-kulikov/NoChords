/**
 * Whether a media query matches, kept current as the window changes.
 *
 * For layout that CSS alone cannot move: where a component renders, rather than how it looks.
 * Without `matchMedia` (tests, very old browsers) it answers no, which is the phone layout — the
 * one that works everywhere.
 */
import { useEffect, useState } from 'react';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(query).matches === true;
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => matches(query));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const update = () => setMatch(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return match;
}
