type StrapiResponse<T> = {
  data: T | null;
};

type StrapiItem<T> = {
  id: number;
  attributes: T;
};

export type StrapiMedia =
  | { url?: string }
  | { data?: { attributes?: { url?: string } } }
  | null
  | undefined;

const getStrapiBaseUrl = () =>
  process.env.STRAPI_URL_INTERNAL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";

export const getStrapiAssetBaseUrl = () =>
  process.env.NEXT_PUBLIC_STRAPI_URL || process.env.STRAPI_URL_INTERNAL || "http://localhost:1337";

export const fetchStrapi = async <T>(path: string, options?: RequestInit) => {
  const url = new URL(path, getStrapiBaseUrl());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  // In development, don't cache. In production, cache for 10 seconds.
  const isDev = process.env.NODE_ENV === "development";

  try {
    const response = await fetch(url.toString(), {
      ...options,
      signal: controller.signal,
      cache: isDev ? "no-store" : "default",
      next: isDev ? undefined : { revalidate: 10 }
    });

    if (!response.ok) {
      throw new Error(`Strapi request failed: ${response.status}`);
    }

    return (await response.json()) as StrapiResponse<T>;
  } catch (error) {
    console.warn("Strapi request failed, using fallback data", error);
    return { data: null } as StrapiResponse<T>;
  } finally {
    clearTimeout(timeout);
  }
};

const isV4Item = <T>(item: StrapiItem<T> | (T & { id: number }) | null | undefined): item is StrapiItem<T> =>
  Boolean(item && typeof item === "object" && "attributes" in item);

export const normalizeCollection = <T>(items?: Array<StrapiItem<T> | (T & { id: number })> | null) =>
  items?.map((item) => (isV4Item(item) ? { id: item.id, ...item.attributes } : item)) ?? [];

export const normalizeSingle = <T>(item?: StrapiItem<T> | (T & { id: number }) | null) =>
  item ? (isV4Item(item) ? { id: item.id, ...item.attributes } : item) : null;

export const getStrapiMediaUrl = (media: StrapiMedia) => {
  if (!media) return null;
  if (typeof (media as { url?: string }).url === "string") {
    return (media as { url?: string }).url ?? null;
  }
  return (media as { data?: { attributes?: { url?: string } } }).data?.attributes?.url ?? null;
};
