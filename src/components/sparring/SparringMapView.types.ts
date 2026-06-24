import type { SparringWithMeta } from '../../hooks/useOpenSparrings';
import type { StudioMapMarker } from '../../hooks/useStudioMapMarkers';
import type { EventWithMeta } from '../../hooks/useOpenEvents';
import type { VenueMapMarker } from '../../hooks/useVenueMapMarkers';

export interface SparringMapViewProps {
  sparrings:           SparringWithMeta[];
  studioDots:          StudioMapMarker[];
  onSparringPress:     (s: SparringWithMeta) => void;
  onStudioPress:       (st: StudioMapMarker) => void;
  totalUnread:         number;
  onChatPress:         () => void;
  events?:             EventWithMeta[];
  onEventPress?:       (e: EventWithMeta) => void;
  venueDots:           VenueMapMarker[];
  onVenuePress:        (venue: VenueMapMarker) => void;
}
