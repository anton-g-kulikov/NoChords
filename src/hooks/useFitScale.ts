/**
 * Measures the chart and reports the type scale that fits it (ADR-054).
 *
 * The measuring is all this hook does; the arithmetic is in `lib/fit.ts`. A line is measured by
 * summing its segments rather than reading the line's own width, because a line that has already
 * wrapped reports the width of the box, not of the text — which is the very thing being fixed.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fitScale } from '../lib/fit';

/** How many times one change may re-measure before the size is taken as settled. */
const MAX_PASSES = 4;

export function useFitScale(
  ref: React.RefObject<HTMLElement>,
  deps: React.DependencyList
): number {
  const [scale, setScale] = useState(1);
  /** Passes spent settling the change in hand. */
  const passes = useRef(0);

  const measure = useCallback(() => {
    const root = ref.current;
    if (!root) return;

    /*
     * The scale is read back off the element rather than remembered.
     *
     * A measurement only means something next to the size it was taken at, and a remembered one
     * can be a step ahead of the DOM — the observer firing twice before a paint is enough. Then
     * every ratio is normalised by a scale that is not on screen, and the chart hunts between two
     * sizes instead of settling. What the element says is, by definition, what was measured.
     */
    const current = Number.parseFloat(getComputedStyle(root).getPropertyValue('--sheet-scale')) || 1;

    const ratios: number[] = [];
    for (const line of root.querySelectorAll<HTMLElement>('.line')) {
      const available = line.getBoundingClientRect().width;
      let natural = 0;
      for (const segment of line.children) {
        /*
         * Fractional widths, not `offsetWidth`.
         *
         * `offsetWidth` is rounded to whole pixels, and a line is the sum of a dozen of them: the
         * rounding accumulates into an underestimate of a few pixels, the scale is computed as
         * fitting, and the line wraps anyway. Rounding the scale down (`fitScale`) does not save
         * it, because the error is in what was measured rather than in the arithmetic.
         */
        natural += (segment as HTMLElement).getBoundingClientRect().width;
      }
      if (natural > 0 && available > 0) ratios.push(available / natural);
    }

    setScale(fitScale(ratios, current));
  }, [ref]);

  // Before paint: a chart that renders at the wrong size and corrects itself is a visible flash.
  useLayoutEffect(() => {
    passes.current = 0;
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  /*
   * Measure again once a new scale is on the page.
   *
   * One pass would be enough if the answer were purely proportional, but the floor is not: a first
   * measurement landing under it applies the floor instead of the target, and the next pass is what
   * discovers the chart can be larger than that. It settles when the scale stops moving — React
   * bails on an identical value — and the counter is only a stop against a pathological cycle.
   */
  useLayoutEffect(() => {
    if (passes.current >= MAX_PASSES) return;
    passes.current += 1;
    measure();
  }, [scale, measure]);

  useEffect(() => {
    const root = ref.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;

    /*
     * A rotation, a window drag: a change of *width* changes what fits. A change of height does not
     * — and it is what the chart's own rescaling produces, so answering it closed a loop: every
     * new scale changed the height, the height reset the pass count, and a fit that could not quite
     * settle measured forever (ADR-073). Only the width is listened to.
     */
    let width = root.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const next = root.getBoundingClientRect().width;
      if (next === width) return;
      width = next;
      passes.current = 0;
      measure();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [measure, ref]);

  /*
   * Measure again when a font arrives (ADR-073).
   *
   * The chart's faces load after first paint, and text set in the fallback is a different width.
   * The height loop above used to catch this by accident — the new font changed the height — so
   * without it the chart would keep a scale fitted to a font nobody sees.
   */
  useEffect(() => {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    if (!fonts) return undefined;
    const refit = () => {
      passes.current = 0;
      measure();
    };
    fonts.addEventListener('loadingdone', refit);
    void fonts.ready.then(refit);
    return () => fonts.removeEventListener('loadingdone', refit);
  }, [measure]);

  return scale;
}
