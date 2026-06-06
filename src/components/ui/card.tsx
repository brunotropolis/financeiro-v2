import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  variant = "default",
}: {
  className?: string;
  children: React.ReactNode;
  variant?: "default" | "lime";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        variant === "default" && "bg-surface border-line/60",
        variant === "lime" && "bg-lime-gradient border-transparent text-bg",
        className
      )}
    >
      {children}
    </div>
  );
}
