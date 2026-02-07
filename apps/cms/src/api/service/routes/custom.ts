export default {
  routes: [
    {
      method: "POST",
      path: "/services/:documentId/unpublish",
      handler: "service.unpublish",
    },
  ],
};
