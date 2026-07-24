/**
 * OpenStreetMap Nominatim — free, keyless place search/geocoding.
 * No Google Maps, no paid tier, no API key required.
 * Usage policy requires a descriptive User-Agent and a light request rate:
 * https://operations.osmfoundation.org/policies/nominatim/
 */

const SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "ClauxenAgent/1.0 (https://clauxen.app)";

export type PlaceResult = {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  category?: string;
  type?: string;
  address?: {
    road?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
};

type NominatimRow = {
  display_name: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  address?: PlaceResult["address"];
};

export async function searchPlaces(
  query: string,
  maxResults = 5,
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: String(Math.min(Math.max(1, maxResults), 10)),
    addressdetails: "1",
  });

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return [];

  const rows = (await res.json()) as NominatimRow[];
  return rows.map((row) => ({
    name: row.display_name.split(",")[0]?.trim() || row.display_name,
    displayName: row.display_name,
    latitude: parseFloat(row.lat),
    longitude: parseFloat(row.lon),
    category: row.class,
    type: row.type,
    address: row.address,
  }));
}
