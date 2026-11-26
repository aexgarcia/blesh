"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-site px-5 py-16">
      <h1 className="h-section">No pudimos cargar esta página</h1>
      <p className="mt-4 text-muted">Vuelve a intentarlo. Tu carrito permanece en este dispositivo.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-full bg-ink px-6 py-3 font-bold text-white">Volver a intentar</button>
    </main>
  );
}
