import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Section } from "@/components/section";
import { Star, Clock, Sparkles, Phone, Mail, MapPin, Instagram, MessageCircle } from "lucide-react";
import {
  fetchStrapi,
  getStrapiAssetBaseUrl,
  getStrapiMediaUrl,
  normalizeCollection,
  normalizeSingle,
  type StrapiMedia
} from "@/lib/strapi";
import { formatPrice } from "@/lib/format";

type Service = {
  name: string;
  slug: string;
  price: number;
  durationMinutes: number;
  description?: string;
  coverImage?: StrapiMedia;
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

const imageBaseUrl = getStrapiAssetBaseUrl();

const getImageUrl = (media?: StrapiMedia | string | null) => {
  const url = typeof media === "string" ? media : getStrapiMediaUrl(media);
  return url ? `${imageBaseUrl}${url}` : null;
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
  const homeResponse = await fetchStrapi<{ data: { id: number; attributes: HomeContent } }>(
    "/api/home?populate=*"
  );
  const servicesResponse = await fetchStrapi<{ data: { id: number; attributes: Service }[] }>(
    "/api/services?sort=order:asc&populate=*"
  );
  const testimonialsResponse = await fetchStrapi<{ data: { id: number; attributes: Testimonial }[] }>(
    "/api/testimonials?sort=order:asc&populate=*"
  );
  const contactResponse = await fetchStrapi<{ data: { id: number; attributes: ContactContent } }>(
    "/api/contact"
  );

  const home = normalizeSingle(homeResponse.data);
  const services = normalizeCollection(servicesResponse.data);
  const testimonials = normalizeCollection(testimonialsResponse.data);
  const contact = normalizeSingle(contactResponse.data);

  const heroImageUrl = getImageUrl(home?.heroImage);
  const contactSubtitle = contact?.subtitle ?? home?.contactCta;

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative gradient-hero">
        {/* Decorative blobs */}
        <div className="blob blob-pink absolute top-10 left-10 h-72 w-72" />
        <div className="blob blob-coral absolute bottom-10 right-20 h-56 w-56" />
        
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
                <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent-warm text-white shadow-lg shadow-pink-300/40 hover:shadow-xl hover:shadow-pink-300/50 transition-all">
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
              <div className="relative h-80 w-80 overflow-hidden rounded-[2rem] border-4 border-white shadow-2xl shadow-pink-200/50 lg:h-96 lg:w-96">
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
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const coverImage = getImageUrl(service.coverImage);
            return (
              <Card key={service.id} className="card-hover group overflow-hidden border-0 bg-gradient-to-br from-white to-pink-50/30 shadow-lg">
                {coverImage ? (
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <Image 
                      src={coverImage} 
                      alt={service.name} 
                      fill 
                      className="object-cover transition-transform duration-500 group-hover:scale-105" 
                      unoptimized 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-pink-100 to-rose-100">
                    <Sparkles className="h-16 w-16 text-primary/40" />
                  </div>
                )}
                <CardContent className="flex flex-col gap-4 p-6">
                  <div>
                    <h3 className="text-xl font-semibold font-display text-foreground">{service.name}</h3>
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {service.durationMinutes} min
                      </span>
                      <span className="font-semibold text-primary">{formatPrice(service.price)}</span>
                    </div>
                  </div>
                  {service.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
                  ) : null}
                  <Button asChild className="bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors">
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
        <div className="blob blob-rose absolute top-0 left-1/4 h-64 w-64" />
        <div className="blob blob-pink absolute bottom-0 right-1/4 h-48 w-48" />
        
        <Section
          title={home?.testimonialsTitle}
          subtitle={home?.testimonialsSubtitle}
          className="relative z-10"
        >
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.slice(0, 3).map((testimonial) => {
              const avatarUrl = getImageUrl(testimonial.avatar);
              return (
                <Card key={testimonial.id} className="card-hover relative overflow-hidden border-0 bg-gradient-to-br from-white via-white to-pink-50/50 shadow-lg">
                  <div className="quote-mark -top-2 left-4">"</div>
                  
                  <CardContent className="relative z-10 flex h-full flex-col gap-4 p-6 pt-8">
                    <StarRating rating={testimonial.rating ?? 5} />
                    
                    <blockquote className="flex-1 text-base leading-relaxed text-foreground/80 italic">
                      "{testimonial.quote}"
                    </blockquote>
                    
                    <div className="flex items-center gap-4 border-t border-pink-100 pt-4">
                      {avatarUrl ? (
                        <div className="relative h-12 w-12 overflow-hidden rounded-full ring-2 ring-primary/20 ring-offset-2">
                          <Image src={avatarUrl} alt={testimonial.name} fill className="object-cover" unoptimized />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent-warm text-lg font-semibold text-white">
                          {testimonial.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-foreground">{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">Cliente verificada</p>
                      </div>
                    </div>
                  </CardContent>
                  
                  <div className="absolute bottom-0 right-0 h-32 w-32 rounded-tl-full bg-gradient-to-tl from-pink-100/50 to-transparent" />
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
      <section className="relative bg-gradient-to-b from-white to-pink-50 py-20">
        <Section title={contact?.title} subtitle={contactSubtitle}>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {contact?.whatsapp ? (
              <a 
                href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="contact-card group"
              >
                <div className="icon-wrapper">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <h4 className="font-semibold text-foreground">WhatsApp</h4>
                <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors">{contact.whatsapp}</p>
              </a>
            ) : null}
            
            {contact?.phone ? (
              <a href={`tel:${contact.phone.replace(/\D/g, '')}`} className="contact-card group">
                <div className="icon-wrapper">
                  <Phone className="h-6 w-6" />
                </div>
                <h4 className="font-semibold text-foreground">Telefone</h4>
                <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors">{contact.phone}</p>
              </a>
            ) : null}
            
            {contact?.email ? (
              <a href={`mailto:${contact.email}`} className="contact-card group">
                <div className="icon-wrapper">
                  <Mail className="h-6 w-6" />
                </div>
                <h4 className="font-semibold text-foreground">Email</h4>
                <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors">{contact.email}</p>
              </a>
            ) : null}
            
            {contact?.instagram ? (
              <a 
                href={`https://instagram.com/${contact.instagram.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="contact-card group"
              >
                <div className="icon-wrapper">
                  <Instagram className="h-6 w-6" />
                </div>
                <h4 className="font-semibold text-foreground">Instagram</h4>
                <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors">{contact.instagram}</p>
              </a>
            ) : null}
          </div>
          
          {contact?.address ? (
            <Card className="mt-8 border-0 bg-white shadow-lg overflow-hidden">
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center md:flex-row md:text-left">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent-warm text-white">
                  <MapPin className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Nosso Endereço</h4>
                  <p className="text-muted-foreground">{contact.address}</p>
                </div>
                <Button asChild className="ml-auto bg-gradient-to-r from-primary to-accent-warm text-white shadow-md">
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
