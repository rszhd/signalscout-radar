import { useState } from "react";
import { RequestCard } from "@/components/RequestCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Platform, platforms, type Request } from "@/data/mock";

type Filter = "all" | Platform;

const order: Filter[] = ["all", "reddit", "x", "linkedin", "youtube", "tiktok", "instagram"];

export function Feed({
  requests,
  showCategory = true,
}: {
  requests: readonly Request[];
  showCategory?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? requests : requests.filter((r) => r.platform === filter);

  return (
    <div className="flex flex-col gap-5">
      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <TabsList className="h-10! w-full justify-start gap-1 overflow-x-auto rounded-full border bg-card p-1 sm:w-fit">
          {order.map((key) => {
            const count =
              key === "all" ? requests.length : requests.filter((r) => r.platform === key).length;
            // A tab that leads to an empty list is noise on a category page.
            if (count === 0) return null;
            return (
              <TabsTrigger
                key={key}
                value={key}
                className="h-8 flex-none rounded-full px-3.5 text-[0.875rem] data-active:bg-brand-soft data-active:text-primary data-active:shadow-none"
              >
                {key !== "all" && (
                  <img src={platforms[key].icon} alt="" className="size-3.5 rounded-[2px]" />
                )}
                {key === "all" ? "All" : platforms[key].name}
                <span className="text-muted-foreground tabular-nums">{count}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <div className="grid gap-4">
        {shown.map((request) => (
          <RequestCard key={request.id} request={request} showCategory={showCategory} />
        ))}
        {shown.length === 0 && (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
            No requests from this platform in the last 7 days.
          </p>
        )}
      </div>
    </div>
  );
}
