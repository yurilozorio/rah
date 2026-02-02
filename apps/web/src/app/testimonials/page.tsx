import Image from "next/image";
import { Section } from "@/components/section";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import {
  fetchStrapi,
  getStrapiAssetBaseUrl,
  getStrapiMediaUrl,
  normalizeCollection,
  normalizeSingle,
  type StrapiMedia
} from "@/lib/strapi";

type Testimonial = {
  name: string;
  quote: string;
  rating?: number;
  avatar?: StrapiMedia;
};

type HomeContent = {
  testimonialsTitle?: string;
  testimonialsSubtitle?: string;
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

export default async function TestimonialsPage() {
  const homeResponse = await fetchStrapi<{ id: number; attributes: HomeContent }>("/api/home");
  const response = await fetchStrapi<{ id: number; attributes: Testimonial }[]>(
    "/api/testimonials?sort=order:asc&populate=*"
  );
  const home = normalizeSingle(homeResponse.data);
  const testimonials = normalizeCollection(response.data);

  return (
    <div className="relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="blob blob-sage absolute -top-20 -left-20 h-64 w-64" />
      <div className="blob blob-nude absolute -bottom-20 -right-20 h-80 w-80" />
      
      <Section 
        title={home?.testimonialsTitle} 
        subtitle={home?.testimonialsSubtitle} 
        className="relative z-10"
      >
        <div className="grid grid-cols-2 gap-3 sm:gap-8 lg:grid-cols-3">
          {testimonials.map((testimonial) => {
            const avatarUrl = getImageUrl(testimonial.avatar);
            
            return (
              <Card 
                key={testimonial.id} 
                className="card-hover relative overflow-hidden border-0 bg-gradient-to-br from-white via-white to-secondary/40 shadow-lg"
              >
                {/* Decorative quote mark */}
                <div className="quote-mark -top-2 left-2 sm:left-4 text-3xl sm:text-5xl">"</div>
                
                <CardContent className="relative z-10 flex h-full flex-col gap-2 sm:gap-4 p-3 sm:p-6 pt-6 sm:pt-8">
                  {/* Star rating */}
                  <StarRating rating={testimonial.rating ?? 5} />
                  
                  {/* Quote */}
                  <blockquote className="flex-1 text-xs sm:text-base leading-relaxed text-foreground/80 italic line-clamp-4 sm:line-clamp-none">
                    "{testimonial.quote}"
                  </blockquote>
                  
                  {/* Author */}
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
                
                {/* Decorative gradient overlay */}
                <div className="absolute bottom-0 right-0 h-16 w-16 sm:h-32 sm:w-32 rounded-tl-full bg-gradient-to-tl from-secondary/50 to-transparent" />
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
