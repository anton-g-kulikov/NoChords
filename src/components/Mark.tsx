import { MARK_PATHS } from '../lib/mark';

/**
 * The empty brackets on a tile, in the scheme's own colours (ADR-070, ADR-074): the tile washed in
 * the second ink like a button that is on, the brackets in that ink. The installed icon keeps its
 * solid tile, because a home screen is not this page.
 */
export function Mark({ className }: { className?: string }) {
  return (
    // Cropped closer than the icon's 512 grid: a home screen wants margin round the mark, but in a
    // 38px tile beside the name it read small and light. Same drawing, nearer view.
    <svg className={className} viewBox="64 64 384 384" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        {MARK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
