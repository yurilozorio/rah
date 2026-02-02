import { config } from "./config.js";

// ==================== Service Types ====================

export type StrapiService = {
  id: number;
  name: string;
  slug: string;
  price: number;
  durationMinutes: number;
};

const normalizeService = (payload: any): StrapiService => {
  const attributes = payload?.attributes ?? payload;
  const rawName = attributes?.name ?? attributes?.title ?? "Serviço";
  const rawSlug = attributes?.slug ?? "";
  const rawPrice = Number(attributes?.price ?? 0);
  const rawDuration = Number(attributes?.durationMinutes ?? attributes?.duration ?? 0);

  return {
    id: Number(payload?.id ?? attributes?.id ?? 0),
    name: String(rawName),
    slug: String(rawSlug),
    price: Number.isFinite(rawPrice) ? Math.round(rawPrice) : 0,
    durationMinutes: Number.isFinite(rawDuration) ? Math.round(rawDuration) : 0
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

// ==================== Client Types ====================

export type StrapiClient = {
  id: number;
  documentId: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  loyaltyPoints: number;
};

export type CreateClientInput = {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
};

const normalizeClient = (payload: any): StrapiClient => {
  const attributes = payload?.attributes ?? payload;
  return {
    id: Number(payload?.id ?? attributes?.id ?? 0),
    documentId: String(payload?.documentId ?? ""),
    name: String(attributes?.name ?? ""),
    phone: String(attributes?.phone ?? ""),
    email: attributes?.email ? String(attributes.email) : null,
    notes: attributes?.notes ? String(attributes.notes) : null,
    loyaltyPoints: Number(attributes?.loyaltyPoints ?? 0)
  };
};

const getStrapiHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${config.STRAPI_API_TOKEN}`
});

// ==================== Client Functions ====================

export const findClientByPhone = async (phone: string): Promise<StrapiClient | null> => {
  const url = new URL("/api/clients", config.STRAPI_URL);
  url.searchParams.set("filters[phone][$eq]", phone);

  const response = await fetch(url.toString(), {
    headers: getStrapiHeaders()
  });

  if (!response.ok) {
    throw new Error(`Failed to find client by phone: ${response.status}`);
  }

  const json = await response.json();
  const items = json?.data ?? [];

  if (!items.length) {
    return null;
  }

  return normalizeClient(items[0]);
};

export const createClient = async (data: CreateClientInput): Promise<StrapiClient> => {
  const url = new URL("/api/clients", config.STRAPI_URL);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: getStrapiHeaders(),
    body: JSON.stringify({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        notes: data.notes || null,
        loyaltyPoints: 0
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to create client: ${response.status} - ${errorBody}`);
  }

  const json = await response.json();
  return normalizeClient(json.data);
};

export const updateClient = async (
  documentId: string,
  data: Partial<Omit<StrapiClient, "id" | "documentId">>
): Promise<StrapiClient> => {
  const url = new URL(`/api/clients/${documentId}`, config.STRAPI_URL);

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: getStrapiHeaders(),
    body: JSON.stringify({ data })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to update client: ${response.status} - ${errorBody}`);
  }

  const json = await response.json();
  return normalizeClient(json.data);
};

export const addLoyaltyPoints = async (
  documentId: string,
  pointsToAdd: number
): Promise<StrapiClient> => {
  // First, get current points
  const url = new URL(`/api/clients/${documentId}`, config.STRAPI_URL);
  
  const getResponse = await fetch(url.toString(), {
    headers: getStrapiHeaders()
  });

  if (!getResponse.ok) {
    throw new Error(`Failed to get client for loyalty update: ${getResponse.status}`);
  }

  const currentData = await getResponse.json();
  const currentPoints = Number(currentData.data?.loyaltyPoints ?? 0);

  // Update with new points
  return updateClient(documentId, {
    loyaltyPoints: currentPoints + pointsToAdd
  });
};

export const setLoyaltyPoints = async (
  documentId: string,
  points: number
): Promise<StrapiClient> => {
  // Set points directly (replace, not add)
  return updateClient(documentId, {
    loyaltyPoints: points
  });
};

export const subtractLoyaltyPoints = async (
  documentId: string,
  pointsToSubtract: number
): Promise<StrapiClient> => {
  // First, get current points
  const url = new URL(`/api/clients/${documentId}`, config.STRAPI_URL);
  
  const getResponse = await fetch(url.toString(), {
    headers: getStrapiHeaders()
  });

  if (!getResponse.ok) {
    throw new Error(`Failed to get client for loyalty update: ${getResponse.status}`);
  }

  const currentData = await getResponse.json();
  const currentPoints = Number(currentData.data?.loyaltyPoints ?? 0);

  // Update with reduced points (minimum 0)
  return updateClient(documentId, {
    loyaltyPoints: Math.max(0, currentPoints - pointsToSubtract)
  });
};

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
