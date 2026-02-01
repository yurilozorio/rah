// import type { Core } from '@strapi/strapi';
import fs from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const seedServices = [
  { name: "Nanopigmentação", slug: "nanopigmentacao", price: 18000, durationMinutes: 90, featured: true },
  { name: "Design com henna", slug: "design-com-henna", price: 8000, durationMinutes: 45, featured: true },
  { name: "Brow Lamination", slug: "brow-lamination", price: 15000, durationMinutes: 60, featured: true },
  { name: "Lash Lifting", slug: "lash-lifting", price: 12000, durationMinutes: 60, featured: true },
  { name: "Limpeza de pele", slug: "limpeza-de-pele", price: 14000, durationMinutes: 75, featured: true },
  { name: "Depilação", slug: "depilacao", price: 6000, durationMinutes: 30, featured: false }
];

const imageSources = {
  hero: {
    name: "hero.jpg",
    url: "https://lh3.googleusercontent.com/sitesv/APaQ0ST1zW1V9FzNABBE7ocxbLIkfKX9ZJwQdaYh-CxNiXBtDp1cLdaqYpknUQrJTjlUebYRE4Go5-vU7HMnSp5jpUXMvHrNHIykS9iOH1xHnCVXJ1iP01tvaQBV6sqtGxmcdzSV7Zsr2lxQFHY8CWOwWhkwNxuigUB153BV5OYAAUT5J1b65AxTlbKV=w16383"
  },
  services: [
    {
      name: "service-1.jpg",
      url: "https://lh3.googleusercontent.com/sitesv/APaQ0SRtbnVOijoV_XjLlHbBvxLrTtI9QKTGJHHqeqfN-bd5euY2EslzmEldDC_ufPmxknEvXI3aid7bIKm6j6kNCUAENBew5vGYtEWx5f8G_J9v8zlO9qBBeuhwk7ON5ZweyYzOmhMzr7HH7jRzsp-OKzc-JMNArUI8R_8PUeUIvlLLNG3JawVCiZVEBMGCDsuOEp2POILfYD3solH4gHfafr1yQivr99IsWd60OQM=w1280"
    },
    {
      name: "service-2.jpg",
      url: "https://lh3.googleusercontent.com/sitesv/APaQ0SR9GpraQg0TwVP9klEoaz71kUlhYAHdZBkKnlaCWlLyd7qUXMdZexYR5HMk9ER01GkKwNNNvdPRoMYDv2Klvf87J-TkxvL7QZeuxdc-eQlA43sMHkA9aSdvuM77V-L5YEACV3bM12hq2aS7KU0X2UeAq8pPKQF9BNuYpn_EwX3e-OIYo6bLo1p8UYh_k2r0u8wki_hq-IefR5n0GbuEqaWvIIpqCq6pos9G=w1280"
    },
    {
      name: "service-3.jpg",
      url: "https://lh3.googleusercontent.com/sitesv/APaQ0SQawvMRkXPCKBDF05R6z7-64YY3oPDf7goKKrWRPqsoQOaVKlXo8kyUMkt3m-oWY9_wZdZ6pwtPreDXksCE_K3pymHLb3Fo6kfYmU5xVUvcs9hL8sULyIwJEmIO2XgLLhcuiQ3jHuZZXMPumVcmtX2a5YyAcWNgqW3EQ8yZAHZhVLx2QyWo105E33J87gmkcn_7TZ--SkIyqwt0owDEOVR7UTBePcN-nj6z=w1280"
    },
    {
      name: "service-4.jpg",
      url: "https://lh3.googleusercontent.com/sitesv/APaQ0SSaS2pScEvah_sBpC6NVcK731eO4HoOyYppfVh9Ya5l_E33B7yN3iE0wJ408IGYSBy1oyfRexUXI6jCMDMpFsSMVVp1UB436HNJFvw0bZodf-iBlNSvuRmm8as3g1rBiYtqRV6mn3mdDEGbCQFdtyNWUauLtqxF7BwKMhR1kxsQR5PVJ2AbThNgri8lYPFm8IAybsTrf60So3DR09CxDvCh9P33AYQEyktv=w1280"
    },
    {
      name: "service-5.jpg",
      url: "https://lh3.googleusercontent.com/sitesv/APaQ0STYMeowXCWabdXiLv9_hBQh9ylotIGTO6CUPBUNFOnsm-ToWu20UyQtRXapFl6OJ47oWwxteEpt_kZWXsLTbW5vfPWcW45S8qPLrANI6vxAgBZp9h_F77uX5SNLV2vWX9wA2_WmkRcfuKqY92v0OnZiepO25-EwBreDF3dNd-tv1jYD7grYtcnKxE9JDOHXWg5Wj2D4PyeBSZORJ5cQHIkcyyIN96YnaY5QRd4=w1280"
    },
    {
      name: "service-6.jpg",
      url: "https://lh3.googleusercontent.com/sitesv/APaQ0STjK5sRGfznoFwM4IT6VfvSCGa4-hzibZai_I0My34NEwToTwriAe4gRjx7xVzz8sQXyFzp9R4C_qojK15sG99lTQ2584oJhIrKx49qjQKAg847aofp6QNrxJX0kvao8SiOgl2kGSrkZBi-jzJr8jx2c8YsZNP1BiJMI7nD4DKekcCWuSfj5ZhOlabr8hlPN3c3ju3aEKz-kAr2JLJQPRYMimVedK8Xcfsk=w1280"
    }
  ]
};

const downloadFile = async (url: string, filename: string) => {
  if (!url || !filename) {
    throw new Error("Missing image URL or filename.");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filePath = join(tmpdir(), filename);
  await fs.writeFile(filePath, buffer);
  const contentType = response.headers.get("content-type") || "image/jpeg";

  return {
    filepath: filePath,
    originalFilename: filename,
    mimetype: contentType,
    size: buffer.length
  };
};

const ensureUpload = async (strapi: any, filename: string, url: string) => {
  const existing = await strapi.db.query("plugin::upload.file").findOne({
    where: { name: filename }
  });

  if (existing) {
    return existing;
  }

  const file = await downloadFile(url, filename);
  const uploaded = await strapi.plugin("upload").service("upload").upload({
    data: {},
    files: [file]
  });

  await fs.unlink(file.filepath).catch(() => undefined);
  return Array.isArray(uploaded) ? uploaded[0] : uploaded;
};

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    const now = new Date();
    const heroSubtitle =
      "Nanopigmentação • Brow Lamination • Lash Lifting • Design com henna • Limpeza de pele • Depilação";

    let heroImage: any = null;
    let serviceImages: any[] = [];

    try {
      heroImage = await ensureUpload(strapi, imageSources.hero.name, imageSources.hero.url);
      serviceImages = await Promise.all(
        imageSources.services.map((image) => ensureUpload(strapi, image.name, image.url))
      );
    } catch (error) {
      strapi.log.error("Erro ao baixar ou enviar imagens do Google Sites", error);
    }

    const upsertSingle = async (uid: string, data: Record<string, any>) => {
      const existing = await strapi.documents(uid).findMany({ status: "published" });
      if (Array.isArray(existing) && existing.length > 0) {
        await Promise.all(
          existing.map((entry: { documentId: string }) =>
            strapi.documents(uid).update({
              documentId: entry.documentId,
              data,
              status: "published"
            })
          )
        );
        return existing[0];
      }
      return strapi.documents(uid).create({ data, status: "published" });
    };

    await upsertSingle("api::home.home", {
      siteName: "Rayssa Lozorio Estética",
      heroTitle: "Estética que realça sua beleza natural",
      heroSubtitle,
      heroCtaLabel: "Agende seu horário",
      heroCtaLink: "/agenda",
      heroSecondaryCtaLabel: "Agendar pelo WhatsApp",
      heroSecondaryCtaLink: "https://wa.me/5527996975347",
      servicesTitle: "Experiência completa em estética e beleza",
      servicesSubtitle: "",
      testimonialsTitle: "Depoimentos",
      testimonialsSubtitle: "O que nossas clientes dizem",
      contactCta: "Agende seu horário pelo WhatsApp",
      announcement: "Todos os procedimentos com descontos no mês de fevereiro.",
      heroImage: heroImage?.id,
      publishedAt: now
    });

    await upsertSingle("api::about.about", {
      title: "Sobre nós",
      description:
        "Na Rayssa Lozorio Estética, cada atendimento é pensado de forma individual, respeitando a beleza natural, o formato do rosto e as necessidades da sua pele.",
      mission:
        "Trabalhamos com técnicas modernas de Nanopigmentação, Design de sobrancelhas, Lash Lifting, drenagem e estética facial, sempre priorizando naturalidade, segurança e resultados elegantes.",
      values: "Aqui, beleza não é exagero - é equilíbrio, cuidado e autoestima.",
      teamTitle: "Equipe",
      teamSubtitle: "Conheça quem cuida de você.",
      proceduresTitle: "Procedimentos",
      proceduresSubtitle: "Detalhes do atendimento e diferenciais.",
      coverImage: heroImage?.id,
      publishedAt: now
    });

    await upsertSingle("api::contact.contact", {
      title: "Contato",
      subtitle: "Fale com a gente para agendar seu horário.",
      instagram: "@rayssalozorio",
      whatsapp: "(27) 99697-5347",
      email: "contato@exemplo.com",
      phone: "(27) 99697-5347",
      address: "Vila Velha, ES",
      footerNote: "Atendimento com horário marcado.",
      publishedAt: now
    });

    for (const [index, service] of seedServices.entries()) {
      const coverImage = serviceImages[index]?.id;
      const existing = await strapi
        .documents("api::service.service")
        .findFirst({ filters: { slug: service.slug }, status: "published" });

      const data = {
        ...service,
        description: "",
        coverImage,
        order: index + 1,
        publishedAt: now
      };

      if (existing?.documentId) {
        await strapi.documents("api::service.service").update({
          documentId: existing.documentId,
          data,
          status: "published"
        });
      } else {
        await strapi.documents("api::service.service").create({ data, status: "published" });
      }
    }

    const teamExisting = await strapi
      .documents("api::team-member.team-member")
      .findFirst({ filters: { name: "Rayssa Lozorio" }, status: "published" });
    const teamData = {
      name: "Rayssa Lozorio",
      photo: heroImage?.id ?? serviceImages[0]?.id,
      instagram: "@rayssalozorio",
      order: 1,
      publishedAt: now
    };

    if (teamExisting?.documentId) {
      await strapi.documents("api::team-member.team-member").update({
        documentId: teamExisting.documentId,
        data: teamData,
        status: "published"
      });
    } else {
      await strapi.documents("api::team-member.team-member").create({ data: teamData, status: "published" });
    }

    const publicRole = await strapi.db
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "public" } });

    if (publicRole) {
      const actions = [
        "api::home.home.find",
        "api::service.service.find",
        "api::service.service.findOne",
        "api::about.about.find",
        "api::contact.contact.find",
        "api::testimonial.testimonial.find",
        "api::testimonial.testimonial.findOne",
        "api::team-member.team-member.find",
        "api::team-member.team-member.findOne"
      ];

      const permissionService = strapi.documents("plugin::users-permissions.permission");
      const existingPermissions = await permissionService.findMany({
        filters: { action: { $in: actions }, role: publicRole.id },
        status: "published"
      });
      const existingActions = new Set(
        existingPermissions.map((permission: { action: string }) => permission.action)
      );

      for (const action of actions) {
        if (!existingActions.has(action)) {
          await permissionService.create({
            data: { action, role: publicRole.id },
            status: "published"
          });
        }
      }
    }
  },
};
