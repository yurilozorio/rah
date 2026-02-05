/**
 * Generate a Google Maps link for the business location using address search.
 * This shows the correct place card in Google Maps.
 */
export const generateGoogleMapsLink = (address?: string | null): string | null => {
  if (address) {
    return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  }
  
  return null;
};
