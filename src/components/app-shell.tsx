"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ChartLine,
  House,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const STUDENT_NAV: NavItem[] = [
  { href: "/me", label: "今天", icon: House, exact: true },
  { href: "/me/sessions", label: "課程", icon: CalendarDays },
  { href: "/me/progress", label: "進度", icon: ChartLine },
  { href: "/me/groups", label: "小團", icon: Users },
  { href: "/messages", label: "訊息", icon: MessageCircle },
];

const COACH_NAV: NavItem[] = [
  { href: "/coach", label: "看板", icon: LayoutDashboard, exact: true },
  { href: "/coach/groups", label: "小團", icon: Users },
  { href: "/coach/sessions", label: "課程", icon: CalendarDays },
  { href: "/messages", label: "訊息", icon: MessageCircle },
];

export function AppShell({
  role,
  unread = 0,
  children,
}: {
  role: Role;
  unread?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const nav = role === "coach" ? COACH_NAV : STUDENT_NAV;
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href={role === "coach" ? "/coach" : "/me"} className="display flex items-center gap-2 text-2xl text-ink">
            <LogoMark />
            揪練
          </Link>
          <nav aria-label="主要功能" className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item) ? "page" : undefined}
                className={`relative rounded-lg px-3 py-1.5 text-[0.9375rem] ${
                  isActive(item) ? "bg-track-soft font-medium text-track" : "text-ink-2 hover:text-ink"
                }`}
              >
                {item.label}
                {item.href === "/messages" && unread > 0 ? <UnreadBadge n={unread} /> : null}
              </Link>
            ))}
          </nav>
          <Link href="/settings" aria-label="設定" className="rounded-lg p-2 text-ink-2 hover:bg-track-soft hover:text-track">
            <Settings className="size-5" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-5 pb-28 md:pb-12">{children}</main>

      <nav
        aria-label="主要功能"
        className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-md">
          {nav.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[0.75rem] ${
                    active ? "font-medium text-track" : "text-ink-3"
                  }`}
                >
                  <span className="relative">
                    <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                    {item.href === "/messages" && unread > 0 ? <UnreadBadge n={unread} /> : null}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function UnreadBadge({ n }: { n: number }) {
  return (
    <span className="num absolute -top-1.5 -right-2.5 min-w-[1.125rem] rounded-full bg-stop px-1 text-center text-[0.6875rem] leading-[1.125rem] font-bold text-white">
      {n > 9 ? "9+" : n}
      <span className="sr-only"> 則未讀</span>
    </span>
  );
}

/** 標誌：三階往下的階梯（人越多越便宜） */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--track)" />
      <rect x="6" y="9" width="6" height="16" rx="1.5" fill="#fff" />
      <rect x="13" y="14" width="6" height="11" rx="1.5" fill="#fff" opacity="0.85" />
      <rect x="20" y="18" width="6" height="7" rx="1.5" fill="var(--lane)" />
    </svg>
  );
}
