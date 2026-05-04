"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Today" },
  { href: "/path", label: "Path" },
  { href: "/mirror", label: "Mirror" },
  { href: "/pillars", label: "Pillars" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const path = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/8 bg-surface-base/90 backdrop-blur-md">
      <div className="max-w-lg mx-auto flex justify-around py-3 px-4">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 text-[11px] tracking-wide transition-colors px-2 py-1",
              path === href ? "text-accent" : "text-white/30 hover:text-white/60"
            )}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
