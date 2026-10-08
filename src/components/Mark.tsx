import { MARK_FLAG, MARK_HEAD, MARK_STEM } from '../lib/mark';

/**
 * The quaver on a tile, in the scheme's own colours (ADR-070): the tile washed in the second ink
 * like a button that is on, the note in that ink. The installed icon keeps its solid tile, because
 * a home screen is not this page.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <path d={MARK_HEAD} />
        <rect {...MARK_STEM} />
        <path d={MARK_FLAG} />
      </g>
    </svg>
  );
}
