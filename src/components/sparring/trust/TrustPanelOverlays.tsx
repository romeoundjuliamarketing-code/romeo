import React from 'react';
import TrustOverlay from './TrustOverlay';
import CheckinQrOverlay from './CheckinQrOverlay';
import CheckinScannerOverlay from './CheckinScannerOverlay';
import CheckinHelpOverlay from './CheckinHelpOverlay';
import type { TrustPanel } from './useTrustPanel';

// Check-in overlays at the root of the detail modal (never as a second Modal).
export default function TrustPanelOverlays({ panel, sparringId }: {
  panel: TrustPanel;
  sparringId: string;
}): React.ReactElement | null {
  const { overlay, state } = panel;
  if (overlay === null || state === null) return null;
  const isOrganizer = state.role === 'organizer';
  return (
    <TrustOverlay onClose={panel.closeOverlay}>
      {overlay === 'qr' && <CheckinQrOverlay sparringId={sparringId} />}
      {overlay === 'scanner' && (
        <CheckinScannerOverlay sparringId={sparringId} onCheckedIn={panel.refetch} onClose={panel.closeOverlay} />
      )}
      {overlay === 'help' && (
        <CheckinHelpOverlay
          isOrganizer={isOrganizer}
          onRetry={() => panel.openOverlay(isOrganizer ? 'qr' : 'scanner')}
        />
      )}
    </TrustOverlay>
  );
}
