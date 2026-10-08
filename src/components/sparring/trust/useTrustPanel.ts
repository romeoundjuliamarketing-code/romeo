import { useCallback, useEffect, useState } from 'react';
import { useSparringTrustState } from '../../../hooks/useSparringReach';
import type { SparringTrustState } from '../../../types/sparringTrust';

export type TrustPanelOverlay = 'qr' | 'scanner' | 'help';

export interface TrustPanel {
  state: SparringTrustState | null;
  /** Server time (ms) as of this render; re-evaluated every 30 s. */
  serverNowMs: number;
  overlay: TrustPanelOverlay | null;
  openOverlay: (kind: TrustPanelOverlay) => void;
  closeOverlay: () => void;
  refetch: () => void;
  /** Called after an answer that may have changed the radius. */
  onReachChanged: () => void;
}

const CLOCK_TICK_MS = 30000;

// State of the check-in / confirmation part of one sparring detail. Lives in
// the detail sheet so overlays can be rendered at the modal root.
export function useTrustPanel(sparringId: string | null, refreshKey: number, onReachChanged: () => void): TrustPanel {
  const { state, offsetMs, loading, refetch } = useSparringTrustState(sparringId, refreshKey);
  const [overlay, setOverlay] = useState<TrustPanelOverlay | null>(null);
  const [, setTick] = useState(0);
  // The id the current `state` belongs to, so a previous sparring's state is
  // never shown for the next one.
  const [settledId, setSettledId] = useState<string | null>(null);

  useEffect(() => { setOverlay(null); }, [sparringId]);
  useEffect(() => { if (!loading) setSettledId(sparringId); }, [loading, sparringId]);

  const active = state !== null;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((n) => n + 1), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [active]);

  const openOverlay = useCallback((kind: TrustPanelOverlay) => setOverlay(kind), []);
  const closeOverlay = useCallback(() => setOverlay(null), []);

  return {
    state: settledId === sparringId ? state : null,
    serverNowMs: Date.now() + offsetMs,
    overlay,
    openOverlay,
    closeOverlay,
    refetch,
    onReachChanged,
  };
}
