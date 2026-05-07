interface NominatimResult {
  lat: string;
  lon: string;
}

export interface Geocoordinates {
  lat: number;
  lng: number;
}

export async function geocodeAddress(query: string): Promise<Geocoordinates | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Strikeforce-App/1.0' },
    });
    const data = (await response.json()) as NominatimResult[];
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
