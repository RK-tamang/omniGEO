import type { Metadata } from "next";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { geogrid, locations, reviewStats } from "@/lib/dashboard-data";

export const metadata: Metadata = { title: "Local SEO" };

function rankTone(rank: number) {
  if (rank <= 3) return "bg-mint/25 text-chalk border-mint/40";
  if (rank <= 6) return "bg-aqua/20 text-chalk border-aqua/40";
  if (rank <= 9) return "bg-gold/20 text-chalk border-gold/40";
  return "bg-coral/20 text-chalk border-coral/40";
}

export default function LocalPage() {
  const avgRating = (locations.reduce((s, l) => s + l.rating, 0) / locations.length).toFixed(1);
  const healthy = locations.filter((l) => l.status === "Healthy").length;
  const avgRank = Math.round(locations.reduce((s, l) => s + l.localRank, 0) / locations.length);
  const totalReviews = locations.reduce((s, l) => s + l.reviews, 0);
  const maxDist = Math.max(...reviewStats.distribution.map((d) => d.count));

  return (
    <>
      <DashboardHeader
        title="Local SEO"
        sub="Multi-location health: local pack ranks on a grid, review velocity and profile completeness per location."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Average rating" value={`${avgRating}`} delta={0.1} unit="stars" hint={`${totalReviews} reviews total`} />
        <KpiCard label="New reviews (30d)" value={`${reviewStats.new30d}`} delta={9} unit="reviews" hint={`${Math.round(reviewStats.responded * 100)}% response rate`} />
        <KpiCard label="Healthy locations" value={`${healthy}/${locations.length}`} delta={1} unit="storefronts" hint="Profile complete + top 5" />
        <KpiCard label="Avg local rank" value={`#${avgRank}`} delta={2} unit="spots" hint="Grid center average" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Grid rank — Andheri, Mumbai"
          sub="Local pack position sampled across a 7×7 grid around the location"
          aside={
            <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-widest text-mist">
              49 points
            </span>
          }
        >
          <div
            className="mx-auto grid max-w-lg grid-cols-7 gap-1.5"
            role="img"
            aria-label="Grid rank heat map: strongest at the center with rank 1, weakening to rank 9 at the edges"
          >
            {geogrid.map((rank, i) => (
              <div
                key={i}
                className={`flex aspect-square items-center justify-center rounded-lg border font-mono text-xs ${rankTone(rank)} ${
                  i === 24 ? "ring-2 ring-iris/70" : ""
                }`}
                title={`Sample point ${i + 1}: local rank ${rank}`}
              >
                {rank}
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 border-t border-line pt-4 font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-mint/60" /> 1–3
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-aqua/60" /> 4–6
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-gold/60" /> 7–9
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-coral/60" /> 10+
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm border border-iris/70" /> location
            </span>
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title="Reviews" sub={`Across ${locations.length} locations · last 90 days`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-display text-5xl font-normal italic leading-none text-chalk">{reviewStats.average}</p>
              <p className="mt-2 font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                {reviewStats.total} reviews · ★ average
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl text-mint">{reviewStats.new30d}</p>
              <p className="mt-1 font-mono text-[0.55rem] uppercase tracking-widest text-mist-dim">new · 30d</p>
            </div>
          </div>

          <ul className="mt-6 space-y-2">
            {reviewStats.distribution.map((d) => (
              <li key={d.stars} className="flex items-center gap-3 text-xs">
                <span className="w-8 font-mono text-mist-dim">{d.stars}★</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full ${d.stars >= 4 ? "bg-mint" : d.stars === 3 ? "bg-gold" : "bg-coral"}`}
                    style={{ width: `${(d.count / maxDist) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-mist">{d.count}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-line pt-4">
            <p className="font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">Unanswered questions</p>
            <ul className="mt-2.5 space-y-2 text-xs text-mist">
              {reviewStats.asked.map((q) => (
                <li key={q} className="flex gap-2">
                  <span className="text-iris">?</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <Panel className="mt-6" title="Locations" sub="Profile completeness, reviews and local pack rank per storefront">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line-strong font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                <th className="pb-3 pr-4 font-normal">Location</th>
                <th className="pb-3 pr-4 font-normal">Rating</th>
                <th className="pb-3 pr-4 font-normal">Reviews</th>
                <th className="pb-3 pr-4 font-normal">New (30d)</th>
                <th className="pb-3 pr-4 font-normal">Profile</th>
                <th className="pb-3 pr-4 font-normal">Local rank</th>
                <th className="pb-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l.name} className="border-b border-line/70 transition-colors hover:bg-surface-1">
                  <td className="py-3 pr-4">
                    <span className="text-chalk">{l.name}</span>
                    <span className="mt-0.5 block font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                      {l.city}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-mist">★ {l.rating}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-mist">{l.reviews}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-mint">+{l.newReviews30d}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className={`h-full rounded-full ${l.completeness >= 85 ? "bg-mint" : l.completeness >= 70 ? "bg-gold" : "bg-coral"}`}
                          style={{ width: `${l.completeness}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-mist">{l.completeness}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">
                    <span className={l.localRank <= 5 ? "text-mint" : l.localRank <= 10 ? "text-gold" : "text-coral"}>
                      #{l.localRank}
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-widest ${
                        l.status === "Healthy"
                          ? "border-mint/40 bg-mint/10 text-mint"
                          : l.status === "At risk"
                            ? "border-gold/40 bg-gold/10 text-gold"
                            : "border-coral/40 bg-coral/10 text-coral"
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 font-mono text-[0.62rem] text-mist-dim">
          Noida needs the most work: 58% profile completeness and no photos since June — that combo drops you out of
          the local pack fastest.
        </p>
      </Panel>
    </>
  );
}
