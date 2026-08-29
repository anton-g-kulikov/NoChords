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
      const available = line.clientWidth;
      let natural = 0;
      for (const segment of line.children) {
        natural += (segment as HTMLElement).offsetWidth;
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

    // A rotation, a keyboard, a window drag: all change what fits.
    const observer = new ResizeObserver(() => {
      passes.current = 0;
      measure();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [measure, ref]);

  return scale;
}
