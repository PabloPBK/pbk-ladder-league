import Link from "next/link";
import type { ReactNode } from "react";

type PBKButtonProps = {
  href: string;
  children: ReactNode;
  primary?: boolean;
};

export function PBKButton({
  href,
  children,
  primary = false,
}: PBKButtonProps) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "flex min-h-16 items-center justify-center rounded-2xl bg-blue-600 px-6 py-4 text-center text-lg font-semibold text-white transition hover:bg-blue-500"
          : "flex min-h-16 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 px-6 py-4 text-center text-lg font-semibold text-white transition hover:border-zinc-500 hover:bg-zinc-800"
      }
    >
      {children}
    </Link>
  );
}
