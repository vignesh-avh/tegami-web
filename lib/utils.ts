export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const timeAgo = (isoDate: string): string => {
  if (!isoDate) return "";
  try {
    const date = new Date(isoDate);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
    return `${Math.floor(seconds / 86400)} d ago`;
  } catch { return ""; }
};

export const getSaleTimeDetails = (endDateStr?: string) => {
  if (!endDateStr) return { text: "", isLessThanOneHour: false, isLessThan24Hours: false };
  try {
    const endDate = new Date(endDateStr);
    const diff = endDate.getTime() - new Date().getTime();
    if (diff <= 0) return { text: "Expired", isLessThanOneHour: false, isLessThan24Hours: false };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const minutes = Math.floor(diff / (1000 * 60)) % 60;

    let text = "";
    if (diff < 3600000) text = `${minutes}m`;
    else if (hours < 24) text = `${hours}h ${minutes}m`;
    else text = `${days}d`;

    return { text, isLessThanOneHour: diff < 3600000, isLessThan24Hours: hours < 24 };
  } catch { return { text: "", isLessThanOneHour: false, isLessThan24Hours: false }; }
};

export const getDaysSinceUpdate = (dateString?: string): number => {
  if (!dateString) return -1;
  try {
    const date = new Date(dateString);
    const diff = new Date().getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  } catch { return -1; }
};

// --- NAVIGATION HELPERS ---

// Google/MapLibre Polyline Decoder
export function decodePolyline(encoded: string): { lat: number, lng: number }[] {
  if (!encoded) return [];
  const points: { lat: number, lng: number }[] = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ lat: lat / 1E5, lng: lng / 1E5 });
  }
  return points;
}

// GpsKalmanFilter Ported to TypeScript
export class GpsKalmanFilter {
  private estimatedLat = 0;
  private estimatedLng = 0;
  private errorCovariance = 0;
  private lastTimestampMs = 0;
  private initialized = false;
  private numUpdates = 0;
  private PROCESS_NOISE = 1.0;

  seed(lat: number, lng: number, accuracy: number, timestamp: number) {
    this.estimatedLat = lat;
    this.estimatedLng = lng;
    this.errorCovariance = Math.max(accuracy, 1.0) ** 2;
    this.lastTimestampMs = timestamp;
    this.initialized = true;
    this.numUpdates = 0;
  }

  filter(measuredLat: number, measuredLng: number, accuracy: number, timestampMs: number, speedMps: number = 0): { lat: number, lng: number } {
    const measurementNoise = Math.max(accuracy, 1.0);

    if (!this.initialized) {
      this.seed(measuredLat, measuredLng, accuracy, timestampMs);
      this.numUpdates = 1;
      return { lat: this.estimatedLat, lng: this.estimatedLng };
    }

    this.numUpdates++;

    // Geographic Snap for Cold Start
    const dist = calculateDistance(this.estimatedLat, this.estimatedLng, measuredLat, measuredLng) * 1000; // to meters
    if (this.numUpdates <= 5 && dist > 40 && accuracy <= 40) {
      this.estimatedLat = measuredLat;
      this.estimatedLng = measuredLng;
      this.errorCovariance = measurementNoise ** 2;
      this.lastTimestampMs = timestampMs;
      return { lat: this.estimatedLat, lng: this.estimatedLng };
    }

    const dtSeconds = Math.max((timestampMs - this.lastTimestampMs) / 1000.0, 0.0);
    this.lastTimestampMs = timestampMs;

    const movement = Math.min(Math.max(speedMps, 0), 45) * 1.5;
    this.errorCovariance += dtSeconds * this.PROCESS_NOISE ** 2 + dtSeconds * dtSeconds * movement * movement;

    const measurementVariance = measurementNoise ** 2;
    const kalmanGain = this.errorCovariance / (this.errorCovariance + measurementVariance);

    this.estimatedLat += kalmanGain * (measuredLat - this.estimatedLat);
    this.estimatedLng += kalmanGain * (measuredLng - this.estimatedLng);
    this.errorCovariance *= (1.0 - kalmanGain);

    return { lat: this.estimatedLat, lng: this.estimatedLng };
  }

  reset() {
    this.initialized = false;
    this.errorCovariance = 0;
    this.lastTimestampMs = 0;
    this.numUpdates = 0;
  }
}