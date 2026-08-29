/**
 * Fitting the chart to the screen.
 *
 * A line that runs off the edge wraps, and a wrapped line puts a chord above the wrong word — the
 * whole point of the chord-over-lyric layout is that a chord's position comes from the lyric under
 * it (ADR-007). Shrinking the type is the lesser evil: the longest line sets one size for the whole
 * song, so the chart stays even rather than each line finding its own size (ADR-054).
 *
 * Pure arithmetic over measurements the caller takes; nothing here touches the DOM (ADR-005).
 */

/** How small the chart may go before wrapping is the better answer. */
export const MIN_SHEET_SCALE = 0.62;

/**
 * The type scale that fits the widest line, from each line's `available / natural` ratio.
 *
 * Ratios are measured at whatever scale is applied now, which is why the current one is passed in:
 * text width is proportional to type size, so one measurement is enough to land on the answer
 * rather than converging on it over several frames.
 */
export function fitScale(
  ratios: number[],
  currentScale: number,
  minScale: number = MIN_SHEET_SCALE
): number {
  const usable = ratios.filter((ratio) => Number.isFinite(ratio) && ratio > 0);
  if (usable.length === 0 || !(currentScale > 0)) return 1;

  const target = currentScale * Math.min(...usable);
  // Rounded down in hundredths: a scale that jitters in the last decimal would reflow the chart on
  // every measurement, and rounding up would put the widest line back over the edge.
  const stepped = Math.floor(target * 100) / 100;
  return Math.min(1, Math.max(minScale, stepped));
}
