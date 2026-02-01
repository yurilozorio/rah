import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/section";
import { Clock, Sparkles, ArrowRight } from "lucide-react";
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

type HomeContent = {
  servicesTitle?: string;
  servicesSubtitle?: string;
};

const getImageUrl = (media?: StrapiMedia | string | null) => {
  const url = typeof media === "string" ? media : getStrapiMediaUrl(media);
  if (!url) return null;
  const baseUrl = getStrapiAssetBaseUrl();
  return baseUrl ? `${baseUrl}${url}` : url;
};

export default async function ServicesPage() {
  const homeResponse = await fetchStrapi<{ id: number; attributes: HomeContent }>("/api/home");
  const servicesResponse = await fetchStrapi<{ id: number; attributes: Service }[]>(
    "/api/services?sort=order:asc&populate=*"
  );
  const home = normalizeSingle(homeResponse.data);
  const services = normalizeCollection(servicesResponse.data);

  return (
    <div className="relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="blob blob-pink absolute -top-32 -right-32 h-96 w-96" />
      <div className="blob blob-coral absolute -bottom-32 -left-32 h-80 w-80" />
      
      <Section 
        title={home?.servicesTitle || "Nossos Serviços"} 
        subtitle={home?.servicesSubtitle || "Descubra todos os tratamentos que oferecemos"} 
        className="relative z-10"
      >
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const coverImage = getImageUrl(service.coverImage);
            return (
              <Card 
                key={service.id} 
                className="card-hover group overflow-hidden border-0 bg-gradient-to-br from-white to-pink-50/30 shadow-lg"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  {coverImage ? (
                    <>
                      <Image 
                        src={coverImage} 
                        alt={service.name} 
                        fill 
                        className="object-cover transition-transform duration-500 group-hover:scale-105" 
                        unoptimized 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-pink-100 to-rose-100">
                      <Sparkles className="h-16 w-16 text-primary/40" />
                    </div>
                  )}
                  {/* Price tag */}
                  <div className="absolute top-4 right-4 rounded-full bg-white/90 backdrop-blur-sm px-3 py-1 shadow-lg">
                    <span className="text-sm font-bold text-primary">{formatPrice(service.price)}</span>
                  </div>
                </div>
                
                <CardContent className="flex flex-col gap-4 p-6">
                  <div>
                    <h3 className="text-xl font-semibold font-display text-foreground group-hover:text-primary transition-colors">
                      {service.name}
                    </h3>
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{service.durationMinutes} minutos</span>
                    </div>
                  </div>
                  
                  {service.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{service.description}</p>
                  )}
                  
                  <div className="flex gap-3">
                    <Button 
                      asChild 
                      variant="outline" 
                      className="flex-1 border-primary/30 hover:border-primary hover:bg-primary/5"
                    >
                      <Link href={`/services/${service.slug}`}>Ver detalhes</Link>
                    </Button>
                    <Button 
                      asChild 
                      className="flex-1 bg-gradient-to-r from-primary to-accent-warm text-white shadow-md hover:shadow-lg transition-shadow"
                    >
                      <Link href="/agenda">
                        Agendar
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* CTA Banner */}
        <Card className="mt-12 border-0 bg-gradient-to-r from-primary to-accent-warm p-1 shadow-xl">
          <CardContent className="flex flex-col items-center gap-6 rounded-xl bg-gradient-to-r from-primary to-accent-warm p-8 text-center text-white md:flex-row md:justify-between md:text-left">
            <div>
              <h3 className="text-2xl font-bold font-display">Não sabe qual escolher?</h3>
              <p className="mt-2 text-white/90">Entre em contato e ajudamos você a encontrar o tratamento ideal</p>
            </div>
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 shadow-lg shrink-0">
              <Link href="/contact">
                Fale Conosco
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
