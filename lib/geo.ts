export type GeoPoint = { latitude: number; longitude: number };

const PI = Math.PI;
const EARTH_AXIS = 6378245;
const ECCENTRICITY = 0.006693421622965943;

function outsideChina({ latitude, longitude }: GeoPoint) {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271;
}

function latitudeOffset(x: number, y: number) {
  let value = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  value += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
  value += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
  value += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
  return value;
}

function longitudeOffset(x: number, y: number) {
  let value = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  value += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
  value += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
  value += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
  return value;
}

/** Convert stored GPS/WGS84 coordinates for display on AMap's GCJ-02 basemap. */
export function wgs84ToGcj02(point: GeoPoint): GeoPoint {
  if (outsideChina(point)) return point;
  const x = point.longitude - 105;
  const y = point.latitude - 35;
  const radians = point.latitude / 180 * PI;
  const sin = Math.sin(radians);
  const magic = 1 - ECCENTRICITY * sin * sin;
  const root = Math.sqrt(magic);
  const dLat = latitudeOffset(x, y) * 180 / ((EARTH_AXIS * (1 - ECCENTRICITY)) / (magic * root) * PI);
  const dLng = longitudeOffset(x, y) * 180 / (EARTH_AXIS / root * Math.cos(radians) * PI);
  return { latitude: point.latitude + dLat, longitude: point.longitude + dLng };
}

/** Invert the local display conversion so manual pins remain stored as WGS84. */
export function gcj02ToWgs84(point: GeoPoint): GeoPoint {
  if (outsideChina(point)) return point;
  let estimate = { ...point };
  for (let attempt = 0; attempt < 5; attempt++) {
    const projected = wgs84ToGcj02(estimate);
    estimate = {
      latitude: estimate.latitude + point.latitude - projected.latitude,
      longitude: estimate.longitude + point.longitude - projected.longitude,
    };
  }
  return estimate;
}
