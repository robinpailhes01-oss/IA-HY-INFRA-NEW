import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RestorePanel } from "@/components/backup/restore-panel";
import { ShieldAlert } from "lucide-react";

// RESTAURATION — remet une sauvegarde dans la base connectée à ce tableau de bord.
// Désactivée tant que HY_ENABLE_RESTORE=1 n'est pas posée dans les variables du projet.
export default function RestorePage() {
  const enabled = process.env.HY_ENABLE_RESTORE === "1";
  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        eyebrow="Outils · Sécurité"
        title={
          <>
            Restaurer une <em>sauvegarde</em>
          </>
        }
        description="Remet les clients, conversations, réservations, finances, fichiers et comptes de connexion d'une sauvegarde dans la base actuelle."
      />
      {enabled ? (
        <Card className="rise max-w-3xl">
          <CardHeader>
            <CardTitle>Importer le fichier ZIP</CardTitle>
            <CardDescription>
              À faire une seule fois, juste après avoir préparé la nouvelle base. Retire ensuite la variable HY_ENABLE_RESTORE.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RestorePanel />
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={<ShieldAlert />} title="La restauration est désactivée" className="rise">
          Par sécurité, cette page ne fonctionne que si la variable <code>HY_ENABLE_RESTORE</code> vaut <code>1</code> dans les variables du
          projet. Active-la le temps de la restauration, puis retire-la.
        </EmptyState>
      )}
    </div>
  );
}
