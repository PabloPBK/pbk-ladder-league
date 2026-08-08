import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/SignOutButton";
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
  if (!showNavigation) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <section className="w-full px-4 pb-24 pt-6 sm:px-6 md:px-8 md:pb-10 md:pt-8 xl:px-10">
          <div className="mb-6 border-b border-zinc-800 pb-5">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {title}
            </h1>

            {description && (
              <p className="mt-1 text-sm text-zinc-400 sm:text-base">
                {description}
              </p>
            )}
          </div>

          {children}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="grid min-h-screen md:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden border-r border-zinc-800 bg-zinc-950 md:flex md:h-screen md:flex-col md:sticky md:top-0">
          <div className="border-b border-zinc-800 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-400">
              Pickleball Kingdom
            </p>

            <h1 className="mt-2 text-xl font-black leading-tight text-yellow-400">
              PBK League
              <br />
              Manager
            </h1>

            <p className="mt-2 text-xs text-zinc-500">
              Tuesday Night DUPR Ladder
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
              Navigation
            </p>

            <Navigation />
          </div>

          <div className="border-t border-zinc-800 p-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400" />

                <p className="text-xs font-semibold text-zinc-300">
                  League system ready
                </p>
              </div>

              <SignOutButton />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-zinc-800 bg-zinc-950/90 px-4 py-4 backdrop-blur md:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-400">
              Pickleball Kingdom
            </p>

            <h1 className="mt-1 text-xl font-black text-yellow-400">
              PBK League Manager
            </h1>
          </header>

          <section className="w-full px-4 pb-24 pt-6 sm:px-6 md:px-8 md:pb-10 md:pt-8 xl:px-10">
            <div className="mb-6 border-b border-zinc-800 pb-5">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                {title}
              </h2>

              {description && (
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                  {description}
                </p>
              )}
            </div>

            {children}
          </section>
        </div>
      </div>
    </main>
  );
}