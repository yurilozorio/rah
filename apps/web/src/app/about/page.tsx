import Image from "next/image";
import { Section } from "@/components/section";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchStrapi,
  getStrapiAssetBaseUrl,
  getStrapiMediaUrl,
  normalizeCollection,
  normalizeSingle,
  type StrapiMedia
} from "@/lib/strapi";

type AboutContent = {
  title?: string;
  description?: string;
  mission?: string;
  values?: string;
  coverImage?: StrapiMedia;
  teamTitle?: string;
  teamSubtitle?: string;
  proceduresTitle?: string;
  proceduresSubtitle?: string;
};

type TeamMember = {
  name: string;
  role?: string;
  bio?: string;
  instagram?: string;
  photo?: StrapiMedia;
};

type ProcedureService = {
  name: string;
  durationMinutes: number;
  description?: string;
  coverImage?: StrapiMedia;
};

const getImageUrl = (media?: StrapiMedia | string | null) => {
  const url = typeof media === "string" ? media : getStrapiMediaUrl(media);
  if (!url) return null;
  const baseUrl = getStrapiAssetBaseUrl();
  return baseUrl ? `${baseUrl}${url}` : url; // Use relative URL if no base
};

export default async function AboutPage() {
  const aboutResponse = await fetchStrapi<{ id: number; attributes: AboutContent }>(
    "/api/about?populate=*"
  );
  const teamResponse = await fetchStrapi<{ id: number; attributes: TeamMember }[]>(
    "/api/team-members?sort=order:asc&populate=*"
  );
  const proceduresResponse = await fetchStrapi<{ id: number; attributes: ProcedureService }[]>(
    "/api/services?sort=order:asc&populate=*"
  );

  const about = normalizeSingle(aboutResponse.data);
  const team = normalizeCollection(teamResponse.data);
  const procedures = normalizeCollection(proceduresResponse.data);

  return (
    <div>
      <Section title={about?.title} subtitle={about?.mission} className="bg-white/70">
        <Card className="overflow-hidden border-0 shadow-md">
          {about?.coverImage ? (
            <div className="relative h-48 w-full">
              <Image
                src={getImageUrl(about.coverImage) ?? ""}
                alt={about.title ?? ""}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}
          <CardContent className="space-y-4 p-6 text-muted-foreground">
            {about?.description ? <p>{about.description}</p> : null}
            {about?.values ? <p>{about.values}</p> : null}
          </CardContent>
        </Card>
      </Section>

      <Section title={about?.teamTitle} subtitle={about?.teamSubtitle} className="bg-secondary/30">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {team.map((member) => {
            const photoUrl = getImageUrl(member.photo);
            return (
              <Card key={member.id} className="border-0 bg-white/80 shadow-md">
                {photoUrl ? (
                  <div className="relative h-44 w-full">
                    <Image src={photoUrl} alt={member.name} fill className="object-cover" unoptimized />
                  </div>
                ) : null}
                <CardContent className="space-y-2 p-5">
                  <h3 className="text-lg font-semibold font-display">{member.name}</h3>
                  {member.role ? <p className="text-sm text-muted-foreground">{member.role}</p> : null}
                  {member.bio ? <p className="text-sm text-muted-foreground">{member.bio}</p> : null}
                  {member.instagram ? <p className="text-sm text-muted-foreground">{member.instagram}</p> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section title={about?.proceduresTitle} subtitle={about?.proceduresSubtitle} className="bg-white/80">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {procedures.map((procedure) => {
            const imageUrl = getImageUrl(procedure.coverImage);
            return (
              <Card key={procedure.id} className="border-0 bg-white shadow-md">
                {imageUrl ? (
                  <div className="relative h-40 w-full">
                    <Image src={imageUrl} alt={procedure.name} fill className="object-cover" unoptimized />
                  </div>
                ) : null}
                <CardContent className="space-y-2 p-5">
                  <h3 className="text-lg font-semibold font-display">{procedure.name}</h3>
                  <p className="text-sm text-muted-foreground">{procedure.durationMinutes} min</p>
                  {procedure.description ? (
                    <p className="text-sm text-muted-foreground">{procedure.description}</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
