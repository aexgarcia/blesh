import Link from "next/link";

import { Button } from "@/shared/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-site flex-1 flex-col items-start justify-center gap-6 px-5 py-24">
      <p className="eyebrow">Error 404</p>
      <h1 className="h-display">Página no encontrada</h1>
      <p className="max-w-md text-muted">La dirección no existe o ya no está disponible.</p>
      <Button asChild size="lg">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
