import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::service.service",
  ({ strapi }) => ({
    async unpublish(ctx) {
      const { documentId } = ctx.params;

      const result = await strapi.documents("api::service.service").unpublish({
        documentId,
      });

      if (!result) {
        return ctx.notFound("Service not found");
      }

      ctx.body = { ok: true, documentId };
    },
  })
);
