import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Productos",
};

/** Catálogo público: se conecta al módulo catalog en las fases 3 y 6. */
export default function ProductsPage() {
  return (
    <main className="mx-auto w-full max-w-site flex-1 px-5 py-16">
      <p className="eyebrow">Catálogo</p>
      <h1 className="h-section mb-6">Productos</h1>
      <div className="rounded-card border border-line bg-surface p-8">
        <p className="font-semibold">Todavía no hay productos publicados.</p>
        <p className="mt-1 text-muted">Vuelve pronto para ver la colección.</p>
      </div>
    </main>
  );
}
