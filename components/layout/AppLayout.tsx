import type { ReactNode } from "react";
import { Navigation } from "@/components/navigation/Navigation";

type AppLayoutProps = {
  title: string;
  description?: string;
  children: ReactNode;
  showNavigation?: boolean;
};

export function AppLayout({
  title,
  description,
  children,
  showNavigation = true,
}: AppLayoutProps) {
  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <header className="border-b border-zinc-800 bg-black/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6 sm:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
              Pickleball Kingdom
            </p>

            <h1 className="mt-2 text-3xl font-bold text-yellow-400 sm:text-4xl">
              PBK Ladder League
            </h1>

            <p className="mt-1 text-zinc-400">
              Tuesday Night DUPR Ladder
            </p>
          </div>

          {showNavigation && <Navigation />}
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">{title}</h2>

          {description && (
            <p className="mt-2 max-w-2xl text-zinc-400">
              {description}
            </p>
          )}
        </div>

        {children}
      </section>
    </main>
  );
}
