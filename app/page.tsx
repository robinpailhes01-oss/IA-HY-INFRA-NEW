import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-2">
          <Badge variant="secondary" className="w-fit">
            Sprint 0 — Setup
          </Badge>
          <CardTitle className="text-2xl text-primary">
            ⚓ Harmonie Yacht
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Infrastructure initialisée : Next.js 15, Tailwind, shadcn/ui et le
            client Supabase sont en place.
          </p>
          <p>
            Prochaine étape —{" "}
            <strong className="text-foreground">Sprint 1</strong> : création du
            schéma de base de données.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
