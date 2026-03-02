import { config } from "./config.js";

// ==================== Service Types ====================

export type StrapiService = {
  id: number;
  name: string;
  slug: string;
  price: number;
  durationMinutes: number;
  cost: number;
};

const normalizeService = (payload: any): StrapiService => {
  const attributes = payload?.attributes ?? payload;
  const rawName = attributes?.name ?? attributes?.title ?? "Serviço";
  const rawSlug = attributes?.slug ?? "";
  const rawPrice = Number(attributes?.price ?? 0);
  const rawDuration = Number(attributes?.durationMinutes ?? attributes?.duration ?? 0);
  const rawCost = Number(attributes?.cost ?? 0);

  return {
    id: Number(payload?.id ?? attributes?.id ?? 0),
    name: String(rawName),
    slug: String(rawSlug),
    price: Number.isFinite(rawPrice) ? Math.round(rawPrice) : 0,
    durationMinutes: Number.isFinite(rawDuration) ? Math.round(rawDuration) : 0,
    cost: Number.isFinite(rawCost) ? Math.round(rawCost) : 0
  };
};

export const fetchServiceById = async (serviceId: number) => {
  // Strapi v5 uses documentId for findOne, so we use filters with numeric id instead
  const url = new URL(`/api/services`, config.STRAPI_URL);
  url.searchParams.set("filters[id][$eq]", String(serviceId));
  url.searchParams.set("populate", "*");

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to fetch service ${serviceId}: ${response.status}`);
  }

  const json = await response.json();
  const items = json?.data ?? [];
  
  if (!items.length) {
    throw new Error(`Service ${serviceId} not found`);
  }

  return normalizeService(items[0]);
};

export const fetchAllServices = async (): Promise<StrapiService[]> => {
  const url = new URL("/api/services", config.STRAPI_URL);
  url.searchParams.set("pagination[pageSize]", "100");
  url.searchParams.set("sort", "order:asc");

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to fetch services: ${response.status}`);
  }

  const json = await response.json();
  const items = json?.data ?? [];
  return items.map(normalizeService);
};

/** @deprecated Use fetchAllServices instead — cost is now included in StrapiService */
export type StrapiServiceWithCost = StrapiService;

/** @deprecated Use fetchAllServices instead — cost is now included in StrapiService */
export const fetchAllServicesWithCost = fetchAllServices;

// ==================== Promotion Helpers ====================

/**
 * Fetch the active promotional price for a service, if any.
 * Returns the promotional price (as integer cents) or null if no active promotion.
 */
export const fetchActivePromotionPrice = async (serviceId: number): Promise<number | null> => {
  const now = new Date().toISOString();
  const url = new URL("/api/promotions", config.STRAPI_URL);
  url.searchParams.set("populate", "service");
  url.searchParams.set("filters[service][id][$eq]", String(serviceId));
  url.searchParams.set("filters[startDate][$lte]", now);
  url.searchParams.set("filters[endDate][$gte]", now);
  url.searchParams.set("filters[active][$eq]", "true");
  url.searchParams.set("pagination[pageSize]", "1");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const json = await response.json();
    const items = json?.data ?? [];
    if (!items.length) return null;

    const attrs = items[0]?.attributes ?? items[0];
    const promoPrice = Number(attrs?.promotionalPrice ?? 0);
    return Number.isFinite(promoPrice) ? Math.round(promoPrice) : null;
  } catch {
    return null;
  }
};

const getStrapiHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${config.STRAPI_API_TOKEN}`
});

// ==================== Notification Settings ====================

export type NotificationSettings = {
  confirmationMessageTemplate: string;
  reminderMessageTemplate: string | null;
  completionMessageTemplate: string | null;
  cancellationMessageTemplate: string | null;
  businessName: string;
  businessLatitude: string | null;
  businessLongitude: string | null;
  calendarCaption: string | null;
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
    completionMessageTemplate: attributes?.completionMessageTemplate ? String(attributes.completionMessageTemplate) : null,
    cancellationMessageTemplate: attributes?.cancellationMessageTemplate ? String(attributes.cancellationMessageTemplate) : null,
    businessName: String(attributes?.businessName ?? ""),
    businessLatitude: attributes?.businessLatitude ? String(attributes.businessLatitude) : null,
    businessLongitude: attributes?.businessLongitude ? String(attributes.businessLongitude) : null,
    calendarCaption: attributes?.calendarCaption ? String(attributes.calendarCaption) : null
  };

  // Update cache
  notificationSettingsCache = {
    data: settings,
    expiresAt: Date.now() + CACHE_TTL_MS
  };

  return settings;
};

/**
 * Clear the notification settings cache (useful for testing or after updates)
 */
export const clearNotificationSettingsCache = () => {
  notificationSettingsCache = {
    data: null,
    expiresAt: 0
  };
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
