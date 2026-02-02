import { Section } from "@/components/section";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchStrapi, normalizeSingle } from "@/lib/strapi";
import { Phone, Mail, MapPin, Instagram, MessageCircle, Clock, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

type ContactContent = {
  title?: string;
  subtitle?: string;
  instagram?: string;
  whatsapp?: string;
  email?: string;
  phone?: string;
  address?: string;
  businessHoursTitle?: string;
  businessHours?: string;
};

export default async function ContactPage() {
  const response = await fetchStrapi<{ id: number; attributes: ContactContent }>("/api/contact");
  const contact = normalizeSingle(response.data);

  return (
    <div className="relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="blob blob-sage absolute -top-32 -left-32 h-96 w-96" />
      <div className="blob blob-nude absolute -bottom-32 -right-32 h-80 w-80" />
      <div className="blob blob-soft absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64" />
      
      <Section 
        title={contact?.title || "Entre em Contato"} 
        subtitle={contact?.subtitle || "Estamos prontas para atender você"} 
        className="relative z-10"
      >
        {/* Main contact grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
          {/* WhatsApp - Featured */}
          {contact?.whatsapp ? (
            <a 
              href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="group col-span-2 lg:col-span-1"
            >
              <Card className="card-hover h-full border-0 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg overflow-hidden">
                <CardContent className="flex flex-col items-center gap-2 sm:gap-4 p-4 sm:p-8 text-center">
                  <div className="flex h-12 w-12 sm:h-20 sm:w-20 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg shadow-green-200/50 transition-transform group-hover:scale-110">
                    <MessageCircle className="h-6 w-6 sm:h-10 sm:w-10" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-xl font-semibold text-foreground">WhatsApp</h3>
                    <p className="mt-0.5 sm:mt-1 text-xs sm:text-base text-muted-foreground">Resposta rápida</p>
                  </div>
                  <p className="text-sm sm:text-lg font-medium text-green-600">{contact.whatsapp}</p>
                  <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-green-600 group-hover:gap-3 transition-all">
                    Iniciar conversa <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                  </span>
                </CardContent>
              </Card>
            </a>
          ) : null}
          
          {/* Phone */}
          {contact?.phone ? (
            <a href={`tel:${contact.phone.replace(/\D/g, '')}`} className="group">
              <Card className="card-hover h-full border-0 bg-gradient-to-br from-white to-secondary/40 shadow-lg">
                <CardContent className="flex flex-col items-center gap-2 sm:gap-4 p-4 sm:p-8 text-center">
                  <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-accent-sage text-white shadow-lg shadow-accent/30 transition-transform group-hover:scale-110">
                    <Phone className="h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-lg font-semibold text-foreground">Telefone</h3>
                    <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground">Ligue para nós</p>
                  </div>
                  <p className="text-xs sm:text-base font-medium text-primary">{contact.phone}</p>
                </CardContent>
              </Card>
            </a>
          ) : null}
          
          {/* Email */}
          {contact?.email ? (
            <a href={`mailto:${contact.email}`} className="group">
              <Card className="card-hover h-full border-0 bg-gradient-to-br from-white to-accent/30 shadow-lg">
                <CardContent className="flex flex-col items-center gap-2 sm:gap-4 p-4 sm:p-8 text-center">
                  <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-accent to-accent-warm text-white shadow-lg shadow-accent/30 transition-transform group-hover:scale-110">
                    <Mail className="h-6 w-6 sm:h-8 sm:w-8" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-lg font-semibold text-foreground">Email</h3>
                    <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground">Envie uma mensagem</p>
                  </div>
                  <p className="text-xs sm:text-base font-medium text-primary break-all">{contact.email}</p>
                </CardContent>
              </Card>
            </a>
          ) : null}
        </div>
        
        {/* Instagram Card - Full width */}
        {contact?.instagram ? (
          <a 
            href={`https://instagram.com/${contact.instagram.replace('@', '')}`}
            target="_blank"
            rel="noreferrer"
            className="mt-8 block group"
          >
            <Card className="card-hover border-0 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 p-1 shadow-xl">
              <CardContent className="flex flex-col items-center gap-4 rounded-xl bg-white p-8 text-center md:flex-row md:text-left">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white shadow-lg transition-transform group-hover:scale-110">
                  <Instagram className="h-10 w-10" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-foreground">Siga-nos no Instagram</h3>
                  <p className="mt-1 text-muted-foreground">Veja nossos trabalhos e novidades</p>
                  <p className="mt-2 text-lg font-medium bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                    {contact.instagram}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-pink-500 font-medium group-hover:gap-3 transition-all">
                  Seguir <ArrowRight className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </a>
        ) : null}
        
        {/* Address and Map Section */}
        {contact?.address ? (
          <Card className="mt-8 border-0 bg-gradient-to-br from-white to-secondary/40 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2">
                {/* Address info */}
                <div className="flex flex-col justify-center gap-6 p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent-sage text-white">
                      <MapPin className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">Nossa Localização</h3>
                      <p className="mt-2 text-muted-foreground leading-relaxed">{contact.address}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-gold to-accent-warm text-white">
                      <Clock className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">
                        {contact.businessHoursTitle || "Horário de Funcionamento"}
                      </h3>
                      <p className="mt-2 text-muted-foreground whitespace-pre-line">
                        {contact.businessHours || "Segunda a Sábado\n9h às 19h"}
                      </p>
                    </div>
                  </div>
                  
                  <Button asChild size="lg" className="mt-4 w-full bg-gradient-to-r from-primary to-accent-sage text-white shadow-lg md:w-auto">
                    <a 
                      href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin className="mr-2 h-5 w-5" />
                      Abrir no Google Maps
                    </a>
                  </Button>
                </div>
                
                {/* Map embed */}
                <div className="relative min-h-[300px] bg-gradient-to-br from-secondary to-accent/30">
                  <iframe
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(contact.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    width="100%"
                    height="100%"
                    style={{ border: 0, position: 'absolute', inset: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Localização no mapa"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
        
        {/* CTA Section */}
        <Card className="mt-12 border-0 bg-gradient-to-r from-primary to-accent-sage p-1 shadow-xl">
          <CardContent className="flex flex-col items-center gap-6 rounded-xl bg-gradient-to-r from-primary to-accent-sage p-8 text-center text-white">
            <Sparkles className="h-12 w-12" />
            <div>
              <h3 className="text-2xl font-bold font-display">Pronta para agendar?</h3>
              <p className="mt-2 text-white/90">Escolha o melhor horário para você</p>
            </div>
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 shadow-lg">
              <Link href="/agenda">
                Agendar Agora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
