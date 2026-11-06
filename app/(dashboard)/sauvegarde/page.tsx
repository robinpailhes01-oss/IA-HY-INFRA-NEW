import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupPanel } from "@/components/backup/backup-panel";
import { DEMO_MODE } from "@/lib/demo/mode";

// SAUVEGARDE — une copie complète de la base, à télécharger.
export default function BackupPage() {
  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        eyebrow="Outils · Sécurité"
        title={
          <>
            Sauvegarde <em>complète</em>
          </>
        }
        description="Télécharge tout ce que contient ta base : clients, conversations, réservations, finances, fichiers et comptes de connexion."
      />
      <Card className="rise max-w-3xl">
        <CardHeader>
          <CardTitle>Une copie, sur ton ordinateur</CardTitle>
          <CardDescription>À faire avant tout changement d&apos;hébergement, puis de temps en temps.</CardDescription>
        </CardHeader>
        <CardContent>
          <BackupPanel demo={DEMO_MODE} />
        </CardContent>
      </Card>
    </div>
  );
}
