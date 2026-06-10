// Geofencing math for the Primary attendance layer (GPS Check-In).
// No paid map SDK — we compute great-circle distance from the browser
// Geolocation API reading to the venue, and compare against the 200m radius.

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance in metres between two lat/lng points. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** True if the player's reading is inside the venue geofence (default 200m). */
export function isWithinGeofence(
  player: { lat: number; lng: number },
  venue: { lat: number; lng: number },
  radiusMeters = 200,
): boolean {
  return distanceMeters(player, venue) <= radiusMeters;
}
