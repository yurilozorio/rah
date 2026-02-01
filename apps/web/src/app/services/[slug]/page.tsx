import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchStrapi, getStrapiAssetBaseUrl, getStrapiMediaUrl, normalizeCollection, type StrapiMedia } from "@/lib/strapi";
import { formatPrice } from "@/lib/format";
import { Clock, Sparkles, CheckCircle, ArrowLeft, ArrowRight, Calendar } from "lucide-react";

type Service = {
  id: number;
  name: string;
  slug: string;
  price: number;
  durationMinutes: number;
  description?: string;
  coverImage?: StrapiMedia;
};

const getImageUrl = (media?: StrapiMedia | string | null) => {
  const url = typeof media === "string" ? media : getStrapiMediaUrl(media);
  if (!url) return null;
  const baseUrl = getStrapiAssetBaseUrl();
  return baseUrl ? `${baseUrl}${url}` : url;
};

// Default benefits for services (could be customized per service in CMS later)
const defaultBenefits = [
  "Profissionais especializados e experientes",
  "Produtos de alta qualidade",
  "Ambiente acolhedor e relaxante",
  "Resultados visíveis e duradouros",
];

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const response = await fetchStrapi<{ id: number; attributes: Service }[]>(
    `/api/services?filters[slug][$eq]=${slug}&populate=*`
  );
  const allServicesResponse = await fetchStrapi<{ id: number; attributes: Service }[]>(
    `/api/services?sort=order:asc&populate=coverImage`
  );
  
  const services = normalizeCollection(response.data);
  const allServices = normalizeCollection(allServicesResponse.data);
  const service = services[0];

  if (!service) {
    notFound();
  }

  const coverImage = getImageUrl(service.coverImage);
  
  // Get related services (excluding current)
  const relatedServices = allServices
    .filter((s) => s.slug !== service.slug)
    .slice(0, 3);

  return (
    <div className="relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="blob blob-pink absolute -top-40 -right-40 h-96 w-96" />
      <div className="blob blob-coral absolute -bottom-40 -left-40 h-80 w-80" />
      
      {/* Hero Section */}
      <section className="relative z-10 bg-gradient-to-b from-pink-50 to-white py-8 md:py-12">
        <div className="mx-auto max-w-4xl px-4">
          {/* Breadcrumb */}
          <Link 
            href="/services" 
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Todos os serviços
          </Link>
          
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            {/* Image */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-xl">
              {coverImage ? (
                <>
                  <Image 
                    src={coverImage} 
                    alt={service.name} 
                    fill 
                    className="object-cover" 
                    unoptimized 
                    priority
                  />
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10" />
                </>
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-pink-100 to-rose-100">
                  <Sparkles className="h-24 w-24 text-primary/30" />
                </div>
              )}
            </div>
            
            {/* Title and Info */}
            <div className="flex flex-col gap-6">
              <h1 className="text-3xl font-bold font-display text-foreground md:text-4xl lg:text-5xl">
                {service.name}
              </h1>
              
              {service.description && (
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {service.description}
                </p>
              )}
              
              {/* Quick Stats */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-md">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent-warm text-white">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duração</p>
                    <p className="font-semibold">{service.durationMinutes} min</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-md">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-400 text-white">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Investimento</p>
                    <p className="font-semibold text-primary">{formatPrice(service.price)}</p>
                  </div>
                </div>
              </div>
              
              {/* CTA Button */}
              <Button 
                asChild 
                size="lg" 
                className="w-full bg-gradient-to-r from-primary to-accent-warm text-white shadow-lg sm:w-auto"
              >
                <Link href="/agenda">
                  <Calendar className="mr-2 h-5 w-5" />
                  Agendar Agora
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 mx-auto max-w-4xl px-4 py-12">
        <h2 className="text-2xl font-bold font-display text-center mb-8">Por que escolher esse serviço?</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {defaultBenefits.map((benefit, index) => (
            <Card key={index} className="border-0 bg-white shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm text-foreground font-medium">{benefit}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Related Services */}
      {relatedServices.length > 0 && (
        <section className="relative z-10 bg-gradient-to-b from-transparent to-pink-50 py-16">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-2xl font-bold font-display text-center mb-8">
              Outros Serviços
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedServices.map((related) => {
                const relatedImage = getImageUrl(related.coverImage);
                return (
                  <Link key={related.id} href={`/services/${related.slug}`} className="group">
                    <Card className="card-hover h-full overflow-hidden border-0 bg-white shadow-lg">
                      <div className="relative h-36 w-full overflow-hidden">
                        {relatedImage ? (
                          <Image 
                            src={relatedImage} 
                            alt={related.name} 
                            fill 
                            className="object-cover transition-transform duration-300 group-hover:scale-105" 
                            unoptimized 
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-pink-100 to-rose-100">
                            <Sparkles className="h-10 w-10 text-primary/40" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {related.name}
                        </h3>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{related.durationMinutes} min</span>
                          <span className="font-semibold text-primary">{formatPrice(related.price)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Mobile Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-pink-100 p-4 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-foreground">{service.name}</p>
            <p className="text-sm text-primary font-medium">{formatPrice(service.price)}</p>
          </div>
          <Button 
            asChild 
            className="bg-gradient-to-r from-primary to-accent-warm text-white shadow-lg"
          >
            <Link href="/agenda">Agendar</Link>
          </Button>
        </div>
      </div>
      
      {/* Spacer for mobile fixed CTA */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}
