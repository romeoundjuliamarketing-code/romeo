import type { SparringWithMeta } from '../../hooks/useOpenSparrings';
import type { StudioMapMarker } from '../../hooks/useStudioMapMarkers';

export interface SparringMapViewProps {
  sparrings:            SparringWithMeta[];
  studioMarkers:        StudioMapMarker[];
  sparringModeStudios:  StudioMapMarker[];
  mode:                 'sparrings' | 'studios';
  onSparringPress:      (s: SparringWithMeta) => void;
  onStudioPress:        (st: StudioMapMarker) => void;
  totalUnread:          number;
  onChatPress:          () => void;
}
