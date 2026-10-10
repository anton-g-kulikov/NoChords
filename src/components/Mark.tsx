import { MARK_CLOSE, MARK_OPEN } from '../lib/mark';

/** Each bracket's own box on the icon's 512 grid, with a hair of room for the lean. */
const VIEW_BOX = { open: '104 116 152 280', close: '256 116 152 280' } as const;

/**
 * One of the mark's two brackets, on its own (ADR-100). The lockup sets the name between them —
 * `[ NoChords ]` — so the mark and the name are one thing, and the home-screen icon is the same two
 * brackets with the name taken out. Same drawing as the installed icons, held to it by MK-01.
 */
export function Bracket({ side, className }: { side: 'open' | 'close'; className?: string }) {
  return (
    <svg
      className={className}
      viewBox={VIEW_BOX[side]}
      aria-hidden="true"
      focusable="false"
    >
      <path fill="currentColor" d={side === 'open' ? MARK_OPEN : MARK_CLOSE} />
    </svg>
  );
}
