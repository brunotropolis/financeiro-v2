"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  Repeat,
  TrendingUp,
  List,
  Search,
  Settings,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { section: "DASHBOARDS", items: [
    { href: "/", label: "Visão geral", icon: LayoutDashboard },
    { href: "/lancar", label: "Lançar", icon: PlusCircle },
    { href: "/recorrentes", label: "Recorrentes", icon: Repeat },
    { href: "/receitas", label: "Receitas", icon: TrendingUp },
    { href: "/lancamentos", label: "Lançamentos", icon: List },
  ]},
  { section: "AJUSTES", items: [
    { href: "/configuracoes/greenn", label: "Greenn auto-sync", icon: Settings },
    { href: "/ajuda", label: "Ajuda", icon: HelpCircle },
  ]},
];

export function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-bg border-r border-line/60 px-4 py-5">
      {/* User chip */}
      <div className="flex items-center gap-3 mb-5 px-2">
        <div className="h-9 w-9 rounded-full bg-lime-gradient grid place-items-center text-bg font-semibold text-sm">
          {(userEmail?.[0] ?? "B").toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{userEmail ?? "Bruno"}</div>
          <div className="text-[11px] text-ink-dim truncate">Caixa v2</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-dim" />
        <input
          placeholder="Buscar…"
          className="w-full bg-surface border border-line rounded-lg pl-9 pr-12 py-2 text-sm placeholder:text-ink-dim focus:outline-none focus:border-muted"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-dim bg-elevated border border-line rounded px-1.5 py-0.5">
          ⌘K
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto">
        {NAV.map((group) => (
          <div key={group.section} className="mb-6">
            <div className="text-[10px] font-semibold tracking-wider text-ink-dim mb-2 px-2">
              {group.section}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-lime text-bg font-semibold"
                          : "text-ink-soft hover:bg-surface hover:text-ink"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active ? "text-bg" : "text-ink-dim")} />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Brand mark */}
      <div className="pt-4 border-t border-line/60 flex items-center gap-2 px-2">
        <div className="h-5 w-5 rounded-md bg-lime/15 grid place-items-center">
          <span className="text-lime text-xs">●</span>
        </div>
        <span className="text-xs text-ink-soft font-medium tracking-wider">CAIXA</span>
      </div>
    </aside>
  );
}
