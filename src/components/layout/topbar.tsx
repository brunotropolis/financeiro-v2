import { Bell, Moon, RefreshCw, Globe } from "lucide-react";

export function Topbar({ breadcrumb }: { breadcrumb: string[] }) {
  return (
    <header className="h-14 px-6 flex items-center justify-between border-b border-line/60">
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-2 text-ink-dim">
          <div className="h-5 w-5 rounded-md bg-elevated border border-line grid place-items-center">
            <span className="text-[10px]">◢</span>
          </div>
          <span>★</span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {breadcrumb.map((seg, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-ink-dim">/</span>}
              <span className={i === breadcrumb.length - 1 ? "text-ink" : "text-ink-dim"}>
                {seg}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button className="h-8 w-8 rounded-lg hover:bg-surface grid place-items-center text-ink-soft">
          <Moon className="h-4 w-4" />
        </button>
        <button className="h-8 w-8 rounded-lg hover:bg-surface grid place-items-center text-ink-soft">
          <RefreshCw className="h-4 w-4" />
        </button>
        <button className="h-8 w-8 rounded-lg hover:bg-surface grid place-items-center text-ink-soft">
          <Bell className="h-4 w-4" />
        </button>
        <button className="h-8 w-8 rounded-lg hover:bg-surface grid place-items-center text-ink-soft">
          <Globe className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
