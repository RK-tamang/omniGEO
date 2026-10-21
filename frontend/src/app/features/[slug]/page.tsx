import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { features, getFeature } from "@/lib/content";
import { Button, ButtonArrow } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Faq } from "@/components/ui/faq";
import { Reveal } from "@/components/ui/reveal";
import { CtaBand } from "@/components/home/cta-band";
import { FeaturePreview } from "@/components/features/feature-preview";

export function generateStaticParams() {
  return features.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const feature = getFeature(slug);
  if (!feature) return {};
  return {
    title: feature.title,
    description: feature.description,
    alternates: { canonical: `/features/${feature.slug}` },
    openGraph: {
      title: `${feature.title} — OmniGEO`,
      description: feature.description,
      url: `/features/${feature.slug}`,
      type: "website",
    },
  };
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = getFeature(slug);
  if (!feature) notFound();

  const others = features.filter((f) => f.slug !== feature.slug);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pb-16 pt-24 lg:pb-20 lg:pt-28">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="aurora -top-24 -left-24 size-[440px] bg-iris/16" aria-hidden />
        <div className="container-page relative">
          <nav aria-label="Breadcrumb" className="font-mono text-[0.7rem] text-mist-dim">
            <Link href="/" className="hover:text-chalk">
              home
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <Link href="/#platform" className="hover:text-chalk">
              platform
            </Link>
            <span className="mx-2 opacity-50">/</span>
            <span className="text-mist">{feature.slug}</span>
          </nav>

          <div className="mt-8 grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div className="max-w-3xl">
              <Badge>{feature.kicker}</Badge>
              <h1 className="text-balance mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-chalk sm:text-5xl">
                {feature.headline}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mist">{feature.description}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <ButtonArrow href="/scan">Analyze my site</ButtonArrow>
                <Button href="/pricing" variant="secondary">
                  See pricing
                </Button>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <FeaturePreview title={feature.title} />
            </div>
          </div>

          {/* metrics strip */}
          <div className="mt-14 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
            {feature.metrics.map((m) => (
              <div key={m.label} className="bg-ink-950 px-5 py-6">
                <div className="font-display text-3xl text-gradient">{m.value}</div>
                <div className="mt-1 font-mono text-[0.6rem] uppercase tracking-widest text-mist-dim">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 lg:py-24">
        <div className="container-page">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.4fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="kicker mb-4">
                <span className="size-1 rounded-full bg-iris" />
                What you get
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-chalk sm:text-3xl">
                Everything {feature.title} includes
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-mist">{feature.description}</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {feature.bullets.map((b, i) => (
                <Reveal key={b.title} delay={i * 80}>
                  <div className="glass glass-hover h-full rounded-2xl p-6">
                    <span className="font-mono text-[0.7rem] text-iris">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="mt-3 text-base font-medium text-chalk">{b.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-mist">{b.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="border-y border-line bg-ink-900/40 py-20 lg:py-24">
        <div className="container-page">
          <Reveal>
            <p className="kicker mb-4">
              <span className="size-1 rounded-full bg-aqua" />
              How it works
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-chalk sm:text-3xl">
              Up and running in an afternoon
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {feature.steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div className="glass h-full rounded-2xl p-7">
                  <span className="inline-flex size-10 items-center justify-center rounded-full border border-line font-mono text-sm text-gradient">
                    {i + 1}
                  </span>
                  <h3 className="mt-5 text-base font-medium text-chalk">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mist">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 lg:py-24">
        <div className="container-page">
          <Reveal>
            <p className="kicker mb-4">
              <span className="size-1 rounded-full bg-gold" />
              FAQ
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-chalk sm:text-3xl">
              About {feature.title.toLowerCase()}
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <Faq items={feature.faq} />
          </Reveal>
        </div>
      </section>

      {/* Cross-links */}
      <section className="border-t border-line py-16">
        <div className="container-page">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-mist-dim">Keep exploring</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {others.map((f) => (
              <Link
                key={f.slug}
                href={`/features/${f.slug}`}
                className="glass glass-hover rounded-xl p-5 text-sm text-mist hover:text-chalk"
              >
                <span className="block font-medium text-chalk">{f.nav}</span>
                <span className="mt-1 block text-xs leading-relaxed text-mist-dim">{f.kicker}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
