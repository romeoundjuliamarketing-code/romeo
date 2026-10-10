import React from 'react';
import type { TrustAction } from '../../../utils/sparringTrust';
import type { JoinGate } from '../../../utils/joinGate';
import type { TrustProblem } from './TrustNoticeCard';
import TrustOverlay from './TrustOverlay';
import ReachIntroContent from './ReachIntroContent';
import LocationPrimerContent from './LocationPrimerContent';
import ReachLimitContent from './ReachLimitContent';

export type JoinOverlay = 'intro' | 'primer' | 'explain' | 'limit';

// Everything the detail sheet needs to show the join gate: overlays (inside the
// open modal) and the problem card.
export interface JoinFlowView {
  overlay: JoinOverlay | null;
  introBusy: boolean;
  introError: string | null;
  problem: TrustProblem | null;
  /** What the client knows about the radius before the binding join. */
  gate: JoinGate;
  onIntroNext: () => void;
  onPrimerAllow: () => void;
  /** Closes the current overlay without marking anything as done. */
  onOverlayClose: () => void;
  onProblemAction: (action: TrustAction) => void;
}

export default function JoinFlowOverlay({ flow }: { flow: JoinFlowView }): React.ReactElement | null {
  if (flow.overlay === null) return null;
  return (
    <TrustOverlay onClose={flow.onOverlayClose}>
      {flow.overlay === 'intro' && (
        <ReachIntroContent
          mode="intro"
          onPrimary={flow.onIntroNext}
          onSecondary={flow.onOverlayClose}
          busy={flow.introBusy}
          error={flow.introError}
        />
      )}
      {flow.overlay === 'explain' && <ReachIntroContent mode="explain" onPrimary={flow.onOverlayClose} />}
      {flow.overlay === 'limit' && (
        <ReachLimitContent unlocked={flow.gate.kind === 'tooFar' && flow.gate.unlocked} onClose={flow.onOverlayClose} />
      )}
      {flow.overlay === 'primer' && (
        <LocationPrimerContent onAllow={flow.onPrimerAllow} onLater={flow.onOverlayClose} />
      )}
    </TrustOverlay>
  );
}
