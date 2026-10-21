import Link from "next/link";
import { Button, ButtonArrow } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden py-24">
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div className="aurora left-1/2 top-1/3 size-[420px] -translate-x-1/2 bg-iris/14" aria-hidden />
      <div className="container-page relative text-center">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.3em] text-mist-dim">Error 404</p>
        <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-chalk sm:text-5xl">
          This page returned{" "}
          <span className="font-display font-normal italic text-gradient">nothing to cite.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-mist">
          The page you&rsquo;re after doesn&rsquo;t exist — or moved and we forgot to leave a citation.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonArrow href="/">Back to home</ButtonArrow>
          <Button href="/contact" variant="secondary">
            Report a broken link
          </Button>
        </div>
        <p className="mt-10 text-sm text-mist-dim">
          Or jump straight to{" "}
          <Link href="/features/ai-visibility" className="text-mist underline decoration-line-strong underline-offset-4 hover:text-chalk">
            AI visibility
          </Link>{" "}
          or{" "}
          <Link href="/pricing" className="text-mist underline decoration-line-strong underline-offset-4 hover:text-chalk">
            pricing
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
