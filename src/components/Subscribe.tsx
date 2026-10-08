import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface TagGroup {
  category: string;
  name: string;
  tags: { slug: string; name: string; week: number }[];
}

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

/**
 * Pick tags, enter an address, get the confirmation email. US-456.
 *
 * `groups` with one entry is a category or tag page: the chips of that
 * category. Several is the /subscribe page, with a search over all of them.
 */
export function Subscribe({
  groups,
  selected = [],
  title = "Get these buyers by email",
}: {
  groups: TagGroup[];
  selected?: string[];
  title?: string;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(selected));
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const many = groups.length > 1;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        tags: group.name.toLowerCase().includes(q)
          ? group.tags
          : group.tags.filter((tag) => tag.name.toLowerCase().includes(q)),
      }))
      .filter((group) => group.tags.length > 0);
  }, [groups, query]);

  const names = new Map(groups.flatMap((group) => group.tags.map((tag) => [tag.slug, tag.name] as const)));

  function toggle(slug: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (picked.size === 0) {
      setState({ kind: "error", message: "Pick at least one tag." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tags: [...picked] }),
      });
      const body = (await response.json().catch(() => ({}))) as { status?: string; message?: string };
      if (!response.ok) {
        setState({ kind: "error", message: body.message ?? "Something went wrong. Please try again." });
      } else if (body.status === "already") {
        setState({ kind: "done", message: "You already get these tags. The next email comes tomorrow morning." });
      } else {
        setState({ kind: "done", message: `Check ${email} and click the link to confirm.` });
      }
    } catch {
      setState({ kind: "error", message: "Something went wrong. Please try again." });
    }
  }

  return (
    <form onSubmit={submit} className="@container rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-[0.9375rem] text-secondary-foreground">
        Pick what you sell. Every morning we email you the new posts from people asking for it. Free, and one click
        stops it.
      </p>

      {many && (
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tags: desks, CRM, headphones…"
          aria-label="Search tags"
          className="mt-4 h-10 rounded-full px-4"
        />
      )}

      <div className={cn("mt-4 flex flex-col gap-4", many && "max-h-[28rem] overflow-y-auto pr-1")}>
        {shown.map((group) => (
          <fieldset key={group.category}>
            {many && <legend className="mb-2 text-[0.8125rem] font-semibold text-muted-foreground">{group.name}</legend>}
            <div className="flex flex-wrap gap-2">
              {group.tags.map((tag) => {
                const on = picked.has(tag.slug);
                return (
                  <button
                    key={tag.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(tag.slug)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[0.875rem] transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-secondary-foreground hover:border-brand-tint hover:text-primary",
                    )}
                  >
                    {tag.name}
                    {tag.week > 0 && (
                      <span className={cn("tabular-nums", on ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {tag.week}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        {shown.length === 0 && <p className="text-[0.9375rem] text-muted-foreground">No tag matches “{query}”.</p>}
      </div>

      {many && picked.size > 0 && (
        <p className="mt-4 text-[0.875rem] text-secondary-foreground">
          {picked.size} picked: {[...picked].map((slug) => names.get(slug) ?? slug).join(", ")}
        </p>
      )}

      {state.kind === "done" ? (
        <p className="mt-4 rounded-xl bg-brand-soft px-4 py-3 text-[0.9375rem] text-primary">{state.message}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2 @lg:flex-row">
          <Input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            aria-label="Your email"
            className="h-10 rounded-full px-4 @lg:max-w-xs"
          />
          <Button type="submit" disabled={state.kind === "sending"} className="h-10 rounded-full px-5 font-semibold">
            {state.kind === "sending" ? "Sending…" : "Email me these buyers"}
          </Button>
        </div>
      )}
      {state.kind === "error" && <p className="mt-2 text-[0.875rem] text-destructive">{state.message}</p>}
    </form>
  );
}
