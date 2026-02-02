type MapLinkOptions = {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
};

/**
 * Generate a Google Maps link for the business location.
 * Prefers coordinates if available, falls back to address search.
 */
export const generateGoogleMapsLink = (options: MapLinkOptions): string | null => {
  const { latitude, longitude, address } = options;
  
  // If we have coordinates, use them for precise location
  if (latitude != null && longitude != null) {
    return `https://maps.google.com/?q=${latitude},${longitude}`;
  }
  
  // Fall back to address search
  if (address) {
    return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  }
  
  return null;
};

/**
 * Generate a universal map link that works on most devices.
 * Uses geo: URI scheme which is recognized by many map apps.
 * Falls back to Google Maps URL if geo: scheme is not supported.
 */
export const generateUniversalMapLink = (options: MapLinkOptions): string | null => {
  const { latitude, longitude, address } = options;
  
  // For WhatsApp messages, Google Maps URLs work best across platforms
  // geo: URIs are not clickable in WhatsApp
  return generateGoogleMapsLink(options);
};
