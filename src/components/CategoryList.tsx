import { TrendingDown, TrendingUp } from "lucide-react";
import type { Category } from "@/data/mock";
import { cn } from "@/lib/utils";

export function CategoryList({
  categories,
  current,
  compact = false,
}: {
  categories: readonly Category[];
  current?: string;
  compact?: boolean;
}) {
  return (
    <ul className={cn("grid gap-2", !compact && "sm:grid-cols-2 lg:grid-cols-4")}>
      {categories.map((category) => {
        const up = category.trend >= 0;
        const active = category.slug === current;
        return (
          <li key={category.slug}>
            <a
              href={`/c/${category.slug}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-brand-tint hover:bg-brand-soft/60",
                active && "border-brand-tint bg-brand-soft",
              )}
            >
              <span className="font-semibold text-foreground">{category.name}</span>
              <span className="flex items-center gap-2 text-[0.8125rem] tabular-nums">
                <span className="text-secondary-foreground">{category.week}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5",
                    up ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                  {Math.abs(category.trend)}%
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
