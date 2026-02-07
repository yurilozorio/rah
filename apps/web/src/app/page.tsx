import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Section } from "@/components/section";
import { Star, Clock, Sparkles, Phone, Mail, MapPin, Instagram, MessageCircle, Tag, Timer, CreditCard } from "lucide-react";
import {
  fetchStrapi,
  getStrapiAssetBaseUrl,
  getStrapiMediaUrl,
  normalizeCollection,
  normalizeSingle,
  type StrapiMedia
} from "@/lib/strapi";
import { formatPrice } from "@/lib/format";
import { buildActivePromotionsMap } from "@/lib/promotions";

type Service = {
  id: number;
  name: string;
  slug: string;
  price: number;
  durationMinutes: number;
  description?: string;
  coverImage?: StrapiMedia;
};

type Promotion = {
  id: number;
  service?: { id: number } | null;
  startDate: string;
  endDate: string;
  promotionalPrice: number;
  validPaymentMethods?: Array<{ name: string }>;
};

type Testimonial = {
  name: string;
  quote: string;
  rating?: number;
  avatar?: StrapiMedia;
};

type HomeContent = {
  siteName?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroCtaLabel?: string;
  heroCtaLink?: string;
  heroSecondaryCtaLabel?: string;
  heroSecondaryCtaLink?: string;
  servicesTitle?: string;
  servicesSubtitle?: string;
  testimonialsTitle?: string;
  testimonialsSubtitle?: string;
  contactCta?: string;
  announcement?: string;
  heroImage?: StrapiMedia;
};

type ContactContent = {
  title?: string;
  subtitle?: string;
  whatsapp?: string;
  phone?: string;
  address?: string;
  instagram?: string;
  email?: string;
};

const getImageUrl = (media?: StrapiMedia | string | null) => {
  const url = typeof media === "string" ? media : getStrapiMediaUrl(media);
  if (!url) return null;
  const baseUrl = getStrapiAssetBaseUrl();
  return baseUrl ? `${baseUrl}${url}` : url;
};

function StarRating({ rating = 5 }: { rating?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? "star-filled" : "star-empty"}`}
          fill={i <= rating ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
}

export default async function Home() {
  const homeResponse = await fetchStrapi<{ id: number; attributes: HomeContent }>(
    "/api/home?populate=*"
  );
  const servicesResponse = await fetchStrapi<{ id: number; attributes: Service }[]>(
    "/api/services?sort=order:asc&populate=*"
  );
  const testimonialsResponse = await fetchStrapi<{ id: number; attributes: Testimonial }[]>(
    "/api/testimonials?sort=order:asc&populate=*"
  );
  const contactResponse = await fetchStrapi<{ id: number; attributes: ContactContent }>(
    "/api/contact"
  );
  const promotionsResponse = await fetchStrapi<{ id: number; attributes: Promotion }[]>(
    "/api/promotions?populate=*&filters[active][$eq]=true&filters[endDate][$gte]=" + new Date().toISOString()
  );

  const home = normalizeSingle(homeResponse.data);
  const services = normalizeCollection(servicesResponse.data);
  const testimonials = normalizeCollection(testimonialsResponse.data);
  const contact = normalizeSingle(contactResponse.data);
  const promotions = normalizeCollection(promotionsResponse.data);

  const activePromotions = buildActivePromotionsMap(promotions);

  const heroImageUrl = getImageUrl(home?.heroImage);
  const contactSubtitle = contact?.subtitle ?? home?.contactCta;

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative gradient-hero">
        {/* Decorative blobs */}
        <div className="blob blob-sage absolute top-10 left-10 h-72 w-72" />
        <div className="blob blob-nude absolute bottom-10 right-20 h-56 w-56" />
        
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-20 md:flex-row md:items-center md:justify-between lg:py-28">
          <div className="max-w-xl space-y-6">
            {home?.announcement ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
                {home.announcement}
              </span>
            ) : null}
            {home?.heroTitle ? (
              <h1 className="text-4xl font-bold font-display leading-tight md:text-5xl lg:text-6xl">
                <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text">
                  {home.heroTitle}
                </span>
              </h1>
            ) : null}
            {home?.heroSubtitle ? (
              <p className="text-lg text-muted-foreground md:text-xl">{home.heroSubtitle}</p>
            ) : null}
            <div className="flex flex-wrap gap-4">
              {home?.heroCtaLabel ? (
                <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent-sage text-white shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 transition-all">
                  <Link href={home.heroCtaLink ?? "/agenda"}>{home.heroCtaLabel}</Link>
                </Button>
              ) : null}
              {home?.heroSecondaryCtaLabel ? (
                <Button variant="outline" size="lg" asChild className="border-2 border-primary/30 bg-white/50 backdrop-blur-sm hover:bg-white hover:border-primary">
                  <Link href={home.heroSecondaryCtaLink ?? "/services"}>{home.heroSecondaryCtaLabel}</Link>
                </Button>
              ) : null}
            </div>
          </div>
          {heroImageUrl ? (
            <div className="relative hidden md:block md:shrink-0">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/20 to-accent/20 blur-2xl" />
              <div className="relative h-80 w-80 overflow-hidden rounded-[2rem] border-4 border-white shadow-2xl shadow-accent/40 lg:h-96 lg:w-96">
                <Image src={heroImageUrl} alt={home?.heroTitle ?? ""} fill className="object-cover" unoptimized />
              </div>
            </div>
          ) : null}
        </div>
        
        {/* Wave divider */}
        <div className="wave-divider">
          <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M0 50C240 90 480 100 720 80C960 60 1200 30 1440 50V100H0V50Z" fill="white" fillOpacity="0.5"/>
            <path d="M0 70C240 100 480 90 720 70C960 50 1200 60 1440 80V100H0V70Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Services Section */}
      <Section
        title={home?.servicesTitle}
        subtitle={home?.servicesSubtitle}
        className="bg-white"
      >
        <div className="grid grid-cols-2 gap-3 sm:gap-8 lg:grid-cols-3">
          {services.map((service) => {
            const coverImage = getImageUrl(service.coverImage);
            const promo = activePromotions.get(service.id);
            return (
              <Card key={service.id} className={`card-hover group overflow-hidden border-0 bg-gradient-to-br from-white to-secondary/30 shadow-lg !p-0 !gap-0 ${
                promo ? "ring-2 ring-red-300 shadow-[0_0_20px_rgba(239,68,68,0.15)]" : ""
              }`}>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl">
                  {coverImage ? (
                    <>
                      <Image 
                        src={coverImage} 
                        alt={service.name} 
                        fill 
                        className="object-cover transition-transform duration-500 group-hover:scale-105" 
                        unoptimized 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-secondary to-accent/50">
                      <Sparkles className="h-10 w-10 sm:h-16 sm:w-16 text-primary/40" />
                    </div>
                  )}
                  {promo && (
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-white shadow-lg">
                      <Tag className="h-3 w-3" />
                      Promoção
                    </div>
                  )}
                </div>
                <CardContent className="flex flex-col gap-2 sm:gap-4 p-3 sm:p-6 !px-3 sm:!px-6">
                  <div>
                    <h3 className="text-sm sm:text-xl font-semibold font-display text-foreground line-clamp-2">{service.name}</h3>
                    <div className="mt-1 sm:mt-2 flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                        {service.durationMinutes} min
                      </span>
                      {promo ? (
                        <span className="text-right">
                          <span className="block text-[10px] sm:text-xs line-through">{formatPrice(service.price)}</span>
                          <span className="font-bold text-red-600 text-xs sm:text-base">{formatPrice(promo.promotionalPrice)}</span>
                        </span>
                      ) : (
                        <span className="font-semibold text-primary">{formatPrice(service.price)}</span>
                      )}
                    </div>
                    {promo && (
                      <div className="mt-2 rounded-md bg-gradient-to-r from-red-50 to-orange-50 p-1.5 sm:p-2 border border-red-100">
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-red-600 font-semibold">
                          <Timer className="h-3 w-3 shrink-0" />
                          <span>
                            Até {new Date(promo.endDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}
                            {" às "}
                            {new Date(promo.endDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                          </span>
                        </div>
                        {promo.validPaymentMethods && promo.validPaymentMethods.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] sm:text-xs text-muted-foreground">
                            <CreditCard className="h-3 w-3 shrink-0" />
                            <span>{promo.validPaymentMethods.map(pm => pm.name).join(", ")}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {service.description ? (
                    <p className="line-clamp-2 text-xs sm:text-sm text-muted-foreground hidden sm:block whitespace-pre-line">{service.description}</p>
                  ) : null}
                  <Button asChild size="sm" className="bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors text-xs sm:text-sm h-8 sm:h-10">
                    <Link href={`/services/${service.slug}`}>Ver detalhes</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="mt-10 text-center">
          <Button asChild variant="outline" size="lg" className="border-2 border-primary/30 hover:border-primary hover:bg-primary/5">
            <Link href="/services">Ver todos os serviços</Link>
          </Button>
        </div>
      </Section>

      {/* Testimonials Section */}
      <section className="relative py-20">
        <div className="blob blob-nude absolute top-0 left-1/4 h-64 w-64" />
        <div className="blob blob-sage absolute bottom-0 right-1/4 h-48 w-48" />
        
        <Section
          title={home?.testimonialsTitle}
          subtitle={home?.testimonialsSubtitle}
          className="relative z-10"
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-8 lg:grid-cols-3">
            {testimonials.slice(0, 4).map((testimonial) => {
              const avatarUrl = getImageUrl(testimonial.avatar);
              return (
                <Card key={testimonial.id} className="card-hover relative overflow-hidden border-0 bg-gradient-to-br from-white via-white to-secondary/40 shadow-lg">
                  <div className="quote-mark -top-2 left-2 sm:left-4 text-3xl sm:text-5xl">"</div>
                  
                  <CardContent className="relative z-10 flex h-full flex-col gap-2 sm:gap-4 p-3 sm:p-6 pt-6 sm:pt-8">
                    <StarRating rating={testimonial.rating ?? 5} />
                    
                    <blockquote className="flex-1 text-xs sm:text-base leading-relaxed text-foreground/80 italic line-clamp-4 sm:line-clamp-none">
                      "{testimonial.quote}"
                    </blockquote>
                    
                    <div className="flex items-center gap-2 sm:gap-4 border-t border-accent/30 pt-2 sm:pt-4">
                      {avatarUrl ? (
                        <div className="relative h-8 w-8 sm:h-12 sm:w-12 overflow-hidden rounded-full ring-2 ring-primary/20 ring-offset-1 sm:ring-offset-2">
                          <Image src={avatarUrl} alt={testimonial.name} fill className="object-cover" unoptimized />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent-sage text-sm sm:text-lg font-semibold text-white">
                          {testimonial.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="text-xs sm:text-base font-semibold text-foreground">{testimonial.name}</p>
                        <p className="text-[10px] sm:text-sm text-muted-foreground">Cliente verificada</p>
                      </div>
                    </div>
                  </CardContent>
                  
                  <div className="absolute bottom-0 right-0 h-16 w-16 sm:h-32 sm:w-32 rounded-tl-full bg-gradient-to-tl from-secondary/50 to-transparent" />
                </Card>
              );
            })}
          </div>
          <div className="mt-10 text-center">
            <Button asChild variant="outline" size="lg" className="border-2 border-primary/30 hover:border-primary hover:bg-primary/5">
              <Link href="/testimonials">Ver todos os depoimentos</Link>
            </Button>
          </div>
        </Section>
      </section>

      {/* Contact Section */}
      <section className="relative bg-gradient-to-b from-white to-secondary/40 py-20">
        <Section title={contact?.title} subtitle={contactSubtitle}>
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {contact?.whatsapp ? (
              <a 
                href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="contact-card group"
              >
                <div className="icon-wrapper !h-10 !w-10 sm:!h-12 sm:!w-12">
                  <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <h4 className="text-sm sm:text-base font-semibold text-foreground">WhatsApp</h4>
                <p className="text-xs sm:text-sm text-muted-foreground group-hover:text-primary transition-colors">{contact.whatsapp}</p>
              </a>
            ) : null}
            
            {contact?.phone ? (
              <a href={`tel:${contact.phone.replace(/\D/g, '')}`} className="contact-card group">
                <div className="icon-wrapper !h-10 !w-10 sm:!h-12 sm:!w-12">
                  <Phone className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <h4 className="text-sm sm:text-base font-semibold text-foreground">Telefone</h4>
                <p className="text-xs sm:text-sm text-muted-foreground group-hover:text-primary transition-colors">{contact.phone}</p>
              </a>
            ) : null}
            
            {contact?.email ? (
              <a href={`mailto:${contact.email}`} className="contact-card group">
                <div className="icon-wrapper !h-10 !w-10 sm:!h-12 sm:!w-12">
                  <Mail className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <h4 className="text-sm sm:text-base font-semibold text-foreground">Email</h4>
                <p className="text-xs sm:text-sm text-muted-foreground group-hover:text-primary transition-colors break-all">{contact.email}</p>
              </a>
            ) : null}
            
            {contact?.instagram ? (
              <a 
                href={`https://instagram.com/${contact.instagram.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="contact-card group"
              >
                <div className="icon-wrapper !h-10 !w-10 sm:!h-12 sm:!w-12">
                  <Instagram className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <h4 className="text-sm sm:text-base font-semibold text-foreground">Instagram</h4>
                <p className="text-xs sm:text-sm text-muted-foreground group-hover:text-primary transition-colors">{contact.instagram}</p>
              </a>
            ) : null}
          </div>
          
          {contact?.address ? (
            <Card className="mt-8 border-0 bg-white shadow-lg overflow-hidden">
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center md:flex-row md:text-left">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent-sage text-white">
                  <MapPin className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Nosso Endereço</h4>
                  <p className="text-muted-foreground">{contact.address}</p>
                </div>
                <Button asChild className="ml-auto bg-gradient-to-r from-primary to-accent-sage text-white shadow-md">
                  <a 
                    href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver no mapa
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </Section>
      </section>
    </div>
  );
}
