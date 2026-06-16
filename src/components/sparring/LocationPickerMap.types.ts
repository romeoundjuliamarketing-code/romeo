export interface LocationPickerMapProps {
  // Recenter the map on this coordinate when it changes (e.g. resolved user location)
  centerOn: { latitude: number; longitude: number } | null;
  // Currently selected marker, or null when nothing is picked yet
  marker: { latitude: number; longitude: number } | null;
  // Called with the tapped coordinate
  onPress: (latitude: number, longitude: number) => void;
  // Whether to render the user's current-location indicator
  showsUserLocation?: boolean;
}
