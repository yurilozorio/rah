import { config } from "./config.js";

// ==================== Notification Settings ====================

export type NotificationSettings = {
  confirmationMessageTemplate: string;
  reminderMessageTemplate: string | null;
  businessName: string;
  businessLatitude: number | null;
  businessLongitude: number | null;
};

// Simple in-memory cache for notification settings
let notificationSettingsCache: {
  data: NotificationSettings | null;
  expiresAt: number;
} = {
  data: null,
  expiresAt: 0
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const getStrapiHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${config.STRAPI_API_TOKEN}`
});

export const fetchNotificationSettings = async (): Promise<NotificationSettings | null> => {
  // Check cache first
  if (notificationSettingsCache.data && Date.now() < notificationSettingsCache.expiresAt) {
    return notificationSettingsCache.data;
  }

  const url = new URL("/api/notification-setting", config.STRAPI_URL);

  const response = await fetch(url.toString(), {
    headers: getStrapiHeaders()
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch notification settings: ${response.status}`);
  }

  const json = await response.json();
  const data = json?.data;
  
  if (!data) {
    return null;
  }

  const attributes = data?.attributes ?? data;
  
  const settings: NotificationSettings = {
    confirmationMessageTemplate: String(attributes?.confirmationMessageTemplate ?? ""),
    reminderMessageTemplate: attributes?.reminderMessageTemplate ? String(attributes.reminderMessageTemplate) : null,
    businessName: String(attributes?.businessName ?? ""),
    businessLatitude: attributes?.businessLatitude != null ? Number(attributes.businessLatitude) : null,
    businessLongitude: attributes?.businessLongitude != null ? Number(attributes.businessLongitude) : null
  };

  // Update cache
  notificationSettingsCache = {
    data: settings,
    expiresAt: Date.now() + CACHE_TTL_MS
  };

  return settings;
};

// ==================== Contact Info ====================

export type ContactInfo = {
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
};

// Simple in-memory cache for contact info
let contactInfoCache: {
  data: ContactInfo | null;
  expiresAt: number;
} = {
  data: null,
  expiresAt: 0
};

export const fetchContactInfo = async (): Promise<ContactInfo | null> => {
  // Check cache first
  if (contactInfoCache.data && Date.now() < contactInfoCache.expiresAt) {
    return contactInfoCache.data;
  }

  const url = new URL("/api/contact", config.STRAPI_URL);

  const response = await fetch(url.toString(), {
    headers: getStrapiHeaders()
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch contact info: ${response.status}`);
  }

  const json = await response.json();
  const data = json?.data;
  
  if (!data) {
    return null;
  }

  const attributes = data?.attributes ?? data;
  
  const contact: ContactInfo = {
    address: attributes?.address ? String(attributes.address) : null,
    phone: attributes?.phone ? String(attributes.phone) : null,
    whatsapp: attributes?.whatsapp ? String(attributes.whatsapp) : null,
    email: attributes?.email ? String(attributes.email) : null
  };

  // Update cache
  contactInfoCache = {
    data: contact,
    expiresAt: Date.now() + CACHE_TTL_MS
  };

  return contact;
};
