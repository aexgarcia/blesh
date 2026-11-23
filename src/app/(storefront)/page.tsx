import Link from "next/link";

import { Button } from "@/shared/ui/button";

export default function HomePage() {
  return (
    <main>
      <section className="relative -mt-[66px] flex min-h-[70svh] items-end overflow-hidden bg-dark text-white">
        <div aria-hidden className="pointer-events-none absolute -right-32 top-10 size-[460px] rounded-full bg-violet/20 blur-[130px]" />
        <div className="relative mx-auto w-full max-w-site px-5 pb-9 pt-32">
          <p className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.08em]">Streetwear · Hecho en Perú</p>
          <h1 className="h-display mb-6 max-w-3xl">BLESH</h1>
          <Button asChild variant="white" size="lg">
            <Link href="/productos">Ver productos</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
