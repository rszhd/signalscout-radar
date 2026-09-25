import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { categoryBySlug, formatAge, platforms, type Request } from "@/data/mock";

export function RequestCard({
  request,
  showCategory = true,
}: {
  request: Request;
  showCategory?: boolean;
}) {
  const platform = platforms[request.platform];
  const category = categoryBySlug(request.category);

  return (
    <Card className="gap-0 py-0 shadow-[0_1px_2px_rgb(60_64_67/8%)] ring-border transition-shadow hover:shadow-[0_1px_2px_rgb(20_24_21/4%),0_18px_44px_rgb(20_24_21/8%)]">
      <CardContent className="flex flex-col gap-3 px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <img src={platform.icon} alt="" className="size-4 rounded-[3px]" />
          <span className="font-semibold text-secondary-foreground">{platform.name}</span>
          {request.channel && <span>r/{request.channel}</span>}
          {request.under && (
            <span className="min-w-0 truncate">
              Comment on “{request.under}”
            </span>
          )}
          <span aria-hidden>·</span>
          <span>{formatAge(request.age)}</span>
        </div>

        {request.title && (
          <h3 className="text-[1.0625rem] leading-snug font-semibold text-foreground">
            {request.title}
          </h3>
        )}
        <p className="text-[0.9375rem] leading-relaxed text-secondary-foreground">
          {request.excerpt}
        </p>

        <div className="rounded-lg bg-brand-soft px-3 py-2 text-[0.875rem] leading-snug text-foreground">
          <span className="font-semibold text-primary">Wants: </span>
          {request.wants}
        </div>
      </CardContent>

      <CardFooter className="justify-between border-t bg-surface-soft px-5 py-3">
        {showCategory && category ? (
          <Badge
            variant="outline"
            render={<a href={`/c/${category.slug}`} />}
            className="h-6 rounded-full bg-card px-2.5 text-[0.8125rem]"
          >
            {category.name}
          </Badge>
        ) : (
          <span />
        )}
        <a
          href={request.url}
          className="inline-flex items-center gap-1 text-[0.875rem] font-semibold text-primary hover:underline"
        >
          Open on {platform.name}
          <ArrowUpRight className="size-4" />
        </a>
      </CardFooter>
    </Card>
  );
}
