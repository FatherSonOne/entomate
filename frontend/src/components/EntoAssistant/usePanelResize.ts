import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * U5 — drag-to-resize the docked panel, and remember the width.
 *
 * Docked only, deliberately. `LogosAssistant.css` declares the panel's width four times
 * (420 default, 360 @1024, 85%/max-340 @768, 90% @380); an inline width beats all four, so
 * a width dragged on a 2560px monitor would otherwise blow out the 340px phone panel. The
 * caller passes `enabled = isDocked`, and at or below 1280 this hook applies nothing at all.
 */

const STORAGE_KEY = 'ento-ai-panel-width';

/** The panel's CSS default — the one the media queries own when nothing is stored. */
export const DEFAULT_PANEL_WIDTH = 420;

/**
 * The floor is the tablet-landscape width, not an invented number. U2b measured what
 * happens below it: the context card wraps and the composer truncates.
 */
export const MIN_PANEL_WIDTH = 360;

/** Coarse enough to move visibly, fine enough to land on a width you meant. */
const KEYBOARD_STEP = 16;

/**
 * Never past half the viewport, and never past 720px. Docked, the app shell reflows into
 * whatever is left — past 50% the record you opened the assistant to look at is narrower
 * than the assistant, which defeats the point of docking.
 */
export function maxPanelWidth(viewportWidth: number): number {
  // Guard the range itself, not just the value: on a narrow viewport the ceiling can fall
  // below the floor, and an inverted range makes Math.min/max return nonsense.
  return Math.max(Math.min(720, Math.round(viewportWidth * 0.5)), MIN_PANEL_WIDTH);
}

export function clampPanelWidth(width: number, viewportWidth: number): number {
  return Math.round(Math.min(Math.max(width, MIN_PANEL_WIDTH), maxPanelWidth(viewportWidth)));
}

function loadWidth(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampPanelWidth(parsed, window.innerWidth) : null;
  } catch {
    // Private browsing / storage disabled. A remembered width is a nicety; falling back to
    // the CSS default is a complete experience, so this is genuinely nothing to report.
    return null;
  }
}

export function usePanelResize(
  panelRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const [width, setWidth] = useState<number | null>(loadWidth);

  const commit = useCallback((next: number) => {
    // Write through to the node as well as to state. The drag sets `style.width` directly
    // (see onPointerDown), so React's idea of the width and the DOM's can differ mid-drag —
    // and if a commit lands on the value state already holds, React bails out of the
    // re-render and the node would keep the intermediate width forever. Writing here makes
    // the two agree no matter which commits coalesce.
    if (panelRef.current) panelRef.current.style.width = `${next}px`;
    setWidth(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* see loadWidth */
    }
  }, [panelRef]);

  // A width stored on a 2560px monitor is out of range on a 1280px laptop. Re-clamp rather
  // than discard: the user's intent was "wide", and the closest legal width honours it.
  useEffect(() => {
    if (!enabled || width === null) return;
    const onResize = () => {
      setWidth(prev => (prev === null ? prev : clampPanelWidth(prev, window.innerWidth)));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [enabled, width]);

  const draggingRef = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const panel = panelRef.current;
    if (!panel || e.button !== 0) return;
    e.preventDefault();

    const handle = e.currentTarget;
    const startX = e.clientX;
    const startWidth = panel.offsetWidth;
    let latest = startWidth;

    // Pointer capture retargets every subsequent move to the handle, so the drag survives
    // the cursor outrunning an 8px strip — and needs no document-level listeners to do it.
    handle.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    document.body.classList.add('la-resizing');

    const onMove = (ev: PointerEvent) => {
      // The panel is docked to the RIGHT edge, so dragging left widens it: the delta inverts.
      latest = clampPanelWidth(startWidth - (ev.clientX - startX), window.innerWidth);
      // Written straight to the node rather than through state. setState per pointermove is
      // ~60 re-renders a second through the whole assistant tree — the drag would stutter on
      // exactly the machines that make a wide panel worth having. State commits once, on up.
      panel.style.width = `${latest}px`;
    };

    const finish = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      if (handle.hasPointerCapture?.(e.pointerId)) handle.releasePointerCapture(e.pointerId);
      document.body.classList.remove('la-resizing');
      draggingRef.current = false;
      commit(latest);
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', finish);
    // A cancelled pointer (browser gesture, device disconnect) still leaves the panel at
    // whatever the last move set. Commit it rather than letting state and DOM disagree.
    handle.addEventListener('pointercancel', finish);
  }, [panelRef, commit]);

  // A drag-only affordance is unreachable without a pointer. This is the ARIA window-splitter
  // pattern: arrows nudge, Home resets.
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const current = width ?? panelRef.current?.offsetWidth ?? DEFAULT_PANEL_WIDTH;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      commit(clampPanelWidth(current + KEYBOARD_STEP, window.innerWidth));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      commit(clampPanelWidth(current - KEYBOARD_STEP, window.innerWidth));
    } else if (e.key === 'Home') {
      e.preventDefault();
      commit(clampPanelWidth(DEFAULT_PANEL_WIDTH, window.innerWidth));
    }
  }, [width, panelRef, commit]);

  const onDoubleClick = useCallback(() => {
    commit(clampPanelWidth(DEFAULT_PANEL_WIDTH, window.innerWidth));
  }, [commit]);

  return {
    /** Inline width, or null to leave the CSS media queries in charge. */
    appliedWidth: enabled ? width : null,
    /** For the handle's ARIA range — kept here so the bounds are declared once. */
    minWidth: MIN_PANEL_WIDTH,
    maxWidth: maxPanelWidth(typeof window === 'undefined' ? 0 : window.innerWidth),
    isDragging: draggingRef,
    onPointerDown,
    onKeyDown,
    onDoubleClick,
  };
}
