export type PromotionLike = {
  service?: {
    id?: number | string;
    data?: { id?: number | string } | null;
  } | null;
  startDate?: string | null;
  endDate?: string | null;
};

export const getPromotionServiceId = (promo: PromotionLike) => {
  const service = (promo as any)?.service;
  const serviceData = service?.data ?? service;
  const rawId = serviceData?.id ?? serviceData?.data?.id;
  if (rawId === null || rawId === undefined) return null;
  const id = Number(rawId);
  return Number.isFinite(id) ? id : null;
};

export const isPromotionActive = (promo: PromotionLike, nowIso: string) => {
  if (!promo?.startDate || !promo?.endDate) return false;
  return promo.startDate <= nowIso && promo.endDate >= nowIso;
};

/**
 * Build a map of serviceId -> active promotion.
 * A promotion is active if startDate <= now <= endDate.
 * Services that should be hidden (deactivate behavior) are handled by the
 * worker unpublishing them in Strapi, so they simply won't appear in the
 * services API response.
 */
export const buildActivePromotionsMap = <T extends PromotionLike>(
  promotions: T[],
  nowIso = new Date().toISOString()
) => {
  const activePromotions = new Map<number, T>();
  for (const promo of promotions ?? []) {
    const serviceId = getPromotionServiceId(promo);
    if (!serviceId) continue;
    if (isPromotionActive(promo, nowIso)) {
      activePromotions.set(serviceId, promo);
    }
  }
  return activePromotions;
};
