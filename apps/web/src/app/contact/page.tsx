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
  mapUrl?: string;
};

export default async function ContactPage() {
  const response = await fetchStrapi<{ id: number; attributes: ContactContent }>("/api/contact");
  const contact = normalizeSingle(response.data);

  return (
    <div className="relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="blob blob-pink absolute -top-32 -left-32 h-96 w-96" />
      <div className="blob blob-coral absolute -bottom-32 -right-32 h-80 w-80" />
      <div className="blob blob-rose absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64" />
      
      <Section 
        title={contact?.title || "Entre em Contato"} 
        subtitle={contact?.subtitle || "Estamos prontas para atender você"} 
        className="relative z-10"
      >
        {/* Main contact grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* WhatsApp - Featured */}
          {contact?.whatsapp ? (
            <a 
              href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="group md:col-span-2 lg:col-span-1"
            >
              <Card className="card-hover h-full border-0 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg overflow-hidden">
                <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg shadow-green-200/50 transition-transform group-hover:scale-110">
                    <MessageCircle className="h-10 w-10" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">WhatsApp</h3>
                    <p className="mt-1 text-muted-foreground">Resposta rápida</p>
                  </div>
                  <p className="text-lg font-medium text-green-600">{contact.whatsapp}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-green-600 group-hover:gap-3 transition-all">
                    Iniciar conversa <ArrowRight className="h-4 w-4" />
                  </span>
                </CardContent>
              </Card>
            </a>
          ) : null}
          
          {/* Phone */}
          {contact?.phone ? (
            <a href={`tel:${contact.phone.replace(/\D/g, '')}`} className="group">
              <Card className="card-hover h-full border-0 bg-gradient-to-br from-white to-pink-50 shadow-lg">
                <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent-warm text-white shadow-lg shadow-pink-200/50 transition-transform group-hover:scale-110">
                    <Phone className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Telefone</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Ligue para nós</p>
                  </div>
                  <p className="font-medium text-primary">{contact.phone}</p>
                </CardContent>
              </Card>
            </a>
          ) : null}
          
          {/* Email */}
          {contact?.email ? (
            <a href={`mailto:${contact.email}`} className="group">
              <Card className="card-hover h-full border-0 bg-gradient-to-br from-white to-rose-50 shadow-lg">
                <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-lg shadow-rose-200/50 transition-transform group-hover:scale-110">
                    <Mail className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Email</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Envie uma mensagem</p>
                  </div>
                  <p className="font-medium text-rose-500 break-all">{contact.email}</p>
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
          <Card className="mt-8 border-0 bg-gradient-to-br from-white to-pink-50/50 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2">
                {/* Address info */}
                <div className="flex flex-col justify-center gap-6 p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent-warm text-white">
                      <MapPin className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">Nossa Localização</h3>
                      <p className="mt-2 text-muted-foreground leading-relaxed">{contact.address}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 text-white">
                      <Clock className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">Horário de Funcionamento</h3>
                      <p className="mt-2 text-muted-foreground">
                        Segunda a Sábado<br />
                        9h às 19h
                      </p>
                    </div>
                  </div>
                  
                  <Button asChild size="lg" className="mt-4 w-full bg-gradient-to-r from-primary to-accent-warm text-white shadow-lg md:w-auto">
                    <a 
                      href={contact.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin className="mr-2 h-5 w-5" />
                      Abrir no Google Maps
                    </a>
                  </Button>
                </div>
                
                {/* Map placeholder / visual */}
                <div className="relative min-h-[300px] bg-gradient-to-br from-pink-100 to-rose-100">
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/80 shadow-lg backdrop-blur-sm">
                      <MapPin className="h-12 w-12 text-primary" />
                    </div>
                    <p className="mt-4 text-center text-muted-foreground">
                      Clique no botão para ver<br />a localização no mapa
                    </p>
                  </div>
                  {/* Decorative elements */}
                  <div className="absolute top-4 left-4 h-8 w-8 rounded-full bg-primary/20" />
                  <div className="absolute bottom-8 right-8 h-12 w-12 rounded-full bg-accent/30" />
                  <div className="absolute top-1/3 right-1/4 h-6 w-6 rounded-full bg-rose-300/40" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
        
        {/* CTA Section */}
        <Card className="mt-12 border-0 bg-gradient-to-r from-primary to-accent-warm p-1 shadow-xl">
          <CardContent className="flex flex-col items-center gap-6 rounded-xl bg-gradient-to-r from-primary to-accent-warm p-8 text-center text-white">
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
