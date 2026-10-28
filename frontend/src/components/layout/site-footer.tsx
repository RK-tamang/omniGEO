import Link from "next/link";
import { features } from "@/lib/content";
import { footerLinks } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-line">
      <div className="aurora -top-40 left-1/4 size-[480px] bg-iris/10" aria-hidden />
      <div className="container-page relative py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="max-w-sm">
              <Link href="/" className="font-display text-xl italic text-chalk" aria-label="OmniGEO home">
                OmniGEO
              </Link>
              <p className="mt-4 text-sm leading-relaxed text-mist">
              AI search visibility and SEO in one platform. Know what ChatGPT says about you — and change it.
            </p>
            <p className="mt-6 text-xs text-mist-dim">Built by Optivus Technologies</p>
          </div>

          <FooterColumn title="Platform" links={[...features.map((f) => ({ label: f.nav, href: `/features/${f.slug}` })), { label: "Pricing", href: "/pricing" }]} />
          <FooterColumn title="Company" links={[...footerLinks.company]} />
          <FooterColumn
            title="Resources"
            links={[
              { label: "Blog", href: "/blog" },
              { label: "Free AI scan", href: "/scan" },
              { label: "RSS feed", href: "/blog/rss.xml" },
              { label: "FAQ", href: "/#faq" },
              { label: "Contact", href: "/contact" },
            ]}
          />
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-line pt-8 text-xs text-mist-dim sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} OmniGEO. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-chalk">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-chalk">
              Terms
            </Link>
            <Link href="/data-processing" className="hover:text-chalk">
              Data Processing
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: readonly { label: string; href: string }[] }) {
  return (
    <nav aria-label={title}>
      <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-mist-dim">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link href={link.href} className="text-sm text-mist transition-colors hover:text-chalk">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
