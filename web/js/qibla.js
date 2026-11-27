// Direction de la Qibla (orthodromie) et distance jusqu'à la Kaaba.
export const KAABA = { lat: 21.4225, lon: 39.8262 };
const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// Angle depuis le nord géographique, sens horaire, normalisé dans [0, 360).
export function qiblaBearing(lat, lon) {
  const p1 = rad(lat), p2 = rad(KAABA.lat), dl = rad(KAABA.lon - lon);
  const y = Math.sin(dl);
  const x = Math.cos(p1) * Math.tan(p2) - Math.sin(p1) * Math.cos(dl);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

// Distance en kilomètres (formule de haversine, rayon moyen 6371 km).
export function qiblaDistanceKm(lat, lon) {
  const dp = rad(KAABA.lat - lat), dl = rad(KAABA.lon - lon);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(KAABA.lat)) * Math.sin(dl / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
