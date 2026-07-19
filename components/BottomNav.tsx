"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/meds", label: "Meds", icon: PillIcon },
  { href: "/weight", label: "Weight", icon: ScaleIcon },
  { href: "/finance", label: "Finance", icon: CoinIcon },
  { href: "/more", label: "More", icon: DotsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href === "/more" && pathname.startsWith("/settings"));
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon active={active} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function iconProps(active: boolean) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: active ? 2.2 : 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function PillIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <path d="M12 8v8" />
    </svg>
  );
}

function ScaleIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8a3 3 0 0 1 3 3H9a3 3 0 0 1 3-3Z" />
    </svg>
  );
}

function CoinIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9.5 9.5h3.2a1.8 1.8 0 0 1 0 3.6H9.8h3a1.8 1.8 0 0 1 0 3.4" />
    </svg>
  );
}

function DotsIcon({ active }: { active: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </svg>
  );
}
