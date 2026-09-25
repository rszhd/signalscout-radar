import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { type Card as CardData, platforms } from "@/lib/present";

export function RequestCard({
  request,
  showCategory = true,
}: {
  request: CardData;
  showCategory?: boolean;
}) {
  const platform = platforms[request.platform];

  return (
    <Card className="gap-0 py-0 shadow-[0_1px_2px_rgb(60_64_67/8%)] ring-border transition-shadow hover:shadow-[0_1px_2px_rgb(20_24_21/4%),0_18px_44px_rgb(20_24_21/8%)]">
      <CardContent className="flex flex-col gap-3 px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <img src={platform.icon} alt="" className="size-4 rounded-[3px]" />
          <span className="font-semibold text-secondary-foreground">{platform.name}</span>
          {request.channel && <span className="min-w-0 truncate">r/{request.channel}</span>}
          <span aria-hidden>·</span>
          <span className="shrink-0">{request.age}</span>
        </div>

        {request.title && (
          <h3 className="text-[1.0625rem] leading-snug font-semibold break-words text-foreground">
            {request.title}
          </h3>
        )}
        <p className="text-[0.9375rem] leading-relaxed break-words text-secondary-foreground">
          {request.excerpt}
        </p>

        <div className="rounded-lg bg-brand-soft px-3 py-2 text-[0.875rem] leading-snug text-foreground">
          <span className="font-semibold text-primary">Wants: </span>
          {request.wants}
        </div>
      </CardContent>

      <CardFooter className="justify-between gap-3 border-t bg-surface-soft px-5 py-3">
        {showCategory ? (
          <Badge
            variant="outline"
            render={<a href={`/c/${request.category}`} />}
            className="h-6 rounded-full bg-card px-2.5 text-[0.8125rem]"
          >
            {request.categoryName}
          </Badge>
        ) : (
          <span />
        )}
        <a
          href={request.url}
          target="_blank"
          rel="noopener nofollow ugc"
          className="inline-flex shrink-0 items-center gap-1 text-[0.875rem] font-semibold text-primary hover:underline"
        >
          Open on {platform.name}
          <ArrowUpRight className="size-4" />
        </a>
      </CardFooter>
    </Card>
  );
}
