"use client";

import { useState } from "react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type MapItem = {
  position: number;
  title: string;
  address: string;
  rating?: number;
  reviews?: number;
};

/**
 * Local pack visibility for a search term.
 *
 * The provider returns the map pack as it stands right now — position, name,
 * address, rating and review count. Everything on this page comes from that
 * one response.
 */
export function LocalSeo() {
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<MapItem[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);

  async function pull(e: React.FormEvent) {
    e.preventDefault();
    const term = keyword.trim();
    if (!term) {
      setMessage("Enter a search term, for example “plumber london”.");
      setState("error");
      return;
    }

    setState("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/dataforseo/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: term, depth: 20 }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.error ?? "Local pack pull failed.");

      setItems(body?.data?.items ?? []);
      setSimulated(Boolean(body.simulated));
      setState("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Local pack pull failed.");
      setState("error");
    }
  }

  const rated = items.filter((i) => typeof i.rating === "number");
  const avgRating = rated.length
    ? (rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length).toFixed(1)
    : "—";
  const totalReviews = items.reduce((s, i) => s + (i.reviews ?? 0), 0);

  const kpis = [
    {
      label: "Results in pack",
      value: `${items.length}`,
      delta: 0,
      unit: "listings",
      hint: items.length ? "From the last pull" : "Nothing pulled yet",
    },
    {
      label: "Average rating",
      value: `${avgRating}`,
      delta: 0,
      unit: "stars",
      hint: `${rated.length} rated listings`,
    },
    {
      label: "Reviews in pack",
      value: `${totalReviews.toLocaleString("en-GB")}`,
      delta: 0,
      unit: "reviews",
      hint: "Summed across the pack",
    },
    {
      label: "Top position",
      value: items.length ? `#${items[0].position}` : "—",
      delta: 0,
      unit: "",
      hint: items.length ? items[0].title : "Nothing pulled yet",
    },
  ];

  return (
    <>
      <DashboardHeader
        title="Local SEO"
        sub="Local pack visibility for a search term: who is listed, where they sit, and how they are rated."
      />

      <Panel title="Pull the local pack" sub="One live provider request per search term" level={2}>
        <form onSubmit={pull} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="plumber london, best coffee shop mumbai"
            aria-label="Search term"
            className="w-full rounded-full border border-line bg-surface-1 px-4 py-2.5 text-sm text-chalk placeholder:text-mist-dim outline-none focus:border-iris/60"
          />
          <Button type="submit" disabled={state === "loading"} className="shrink-0">
            {state === "loading" ? "Pulling…" : "Pull local pack"}
          </Button>
        </form>
        {message ? <p className="mt-3 text-sm text-coral">{message}</p> : null}
        {state === "done" && simulated ? (
          <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-widest text-gold">
            Provider credentials are not configured — these results are simulated by the engine.
          </p>
        ) : null}
      </Panel>

      {items.length === 0 ? (
        <Panel className="mt-6" title="Local pack" sub="Nothing pulled yet" level={2}>
          <EmptyState
            title="No local pack data yet"
            sub="Enter a search term above and pull. The provider returns every listing in the map pack with its position, address, rating and review count."
          />
        </Panel>
      ) : (
        <>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k) => (
              <KpiCard key={k.label} {...k} />
            ))}
          </div>

          <Panel className="mt-6" title="Map pack" sub="Ranked exactly as the provider returned it" level={2}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line-strong font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                    <th className="pb-3 pr-4 font-normal">Position</th>
                    <th className="pb-3 pr-4 font-normal">Listing</th>
                    <th className="pb-3 pr-4 font-normal">Address</th>
                    <th className="pb-3 pr-4 font-normal">Rating</th>
                    <th className="pb-3 font-normal">Reviews</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={`${i.position}-${i.title}`} className="border-b border-line/70 transition-colors hover:bg-surface-1">
                      <td className="py-3 pr-4 font-mono text-xs text-chalk">#{i.position}</td>
                      <td className="py-3 pr-4 text-chalk">{i.title}</td>
                      <td className="py-3 pr-4 text-xs text-mist">{i.address}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-mist">
                        {typeof i.rating === "number" ? `★ ${i.rating}` : "—"}
                      </td>
                      <td className="py-3 font-mono text-xs text-mist">{i.reviews ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 font-mono text-[0.62rem] text-mist-dim">
              {items.length} listings · grid sampling and per-storefront profile audits are not collected by this pull
            </p>
          </Panel>
        </>
      )}
    </>
  );
}
