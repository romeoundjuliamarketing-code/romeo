import type { SparringWithMeta } from '../../hooks/useOpenSparrings';
import type { StudioMapMarker } from '../../hooks/useStudioMapMarkers';
import type { EventWithMeta } from '../../hooks/useOpenEvents';
import type { VenueMapMarker } from '../../hooks/useVenueMapMarkers';
import type { GeoPoint, MapRegion } from '../../utils/mapStartRegion';

export interface SparringMapViewProps {
  sparrings:           SparringWithMeta[];
  studioDots:          StudioMapMarker[];
  onSparringPress:     (s: SparringWithMeta) => void;
  /** Sparring whose marker is shown selected (preview or detail open). */
  activeSparringId:    string | null;
  onStudioPress:       (st: StudioMapMarker) => void;
  events?:             EventWithMeta[];
  onEventPress?:       (e: EventWithMeta) => void;
  venueDots:           VenueMapMarker[];
  onVenuePress:        (venue: VenueMapMarker) => void;
  /** Viewport to move to: the first one only if the user has not panned yet, every new object always (explicit search change). */
  startRegion:         MapRegion | null;
  /** Height covered by the screen's top overlay (incl. safe area). */
  overlayTop:          number;
  /** Height covered by the bottom controls/preview (incl. safe area); keeps attribution visible above them. */
  overlayBottom:       number;
  /** The user finished moving the map by gesture; never called for the map's own camera moves. */
  onUserRegionChange?: (region: MapRegion) => void;
  /** Join reach around the device position (150 km, 300 km once unlocked); null hides it. */
  reachCircle?:        { center: GeoPoint; radiusKm: number } | null;
}
