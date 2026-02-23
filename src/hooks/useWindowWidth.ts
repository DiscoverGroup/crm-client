import { useState, useEffect } from 'react';

/**
 * Returns the current window width and re-renders when it changes.
 *
 * Why: `window.innerWidth` read directly in render/JSX returns the value at
 * mount time and never updates — the layout freezes.  This hook subscribes to
 * the resize event so every component using it stays responsive at runtime.
 *
 * Usage:
 *   const windowWidth = useWindowWidth();
 *   const isMobile = windowWidth < 640;
 */
export function useWindowWidth(): number {
  const [width, setWidth] = useState<number>(() => window.innerWidth);

  useEffect(() => {
    let rafId: number;

    const handleResize = () => {
      // RAF-throttle: at most one state update per animation frame
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setWidth(window.innerWidth);
      });
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return width;
}
