import { DashboardHeader, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function GeoWriterPage() {
  return (
    <div className="space-y-6">
      <DashboardHeader
        title="GEO Content Writer"
        sub="Drafts full GEO-optimized blogs and articles — citation-ready, structured, entity-rich"
      />

      <Panel title="Choose a content type" sub="Each template produces a draft with sources attached." level={2}>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Start Writing</Button>
            <Button variant="secondary">View Templates</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-iris text-2xl mb-3">✍️</div>
              <h3 className="font-medium text-chalk mb-2">GEO Blog Post</h3>
              <p className="text-sm text-mist">Full article from topic with citations, FAQ, schema</p>
              <Button className="mt-4 w-full" size="sm">Start Writing</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-aqua text-2xl mb-3">📋</div>
              <h3 className="font-medium text-chalk mb-2">Content Brief</h3>
              <p className="text-sm text-mist">Structure, sources, target prompts, schema needs</p>
              <Button className="mt-4 w-full" size="sm" variant="secondary">Generate Brief</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-gold text-2xl mb-3">📝</div>
              <h3 className="font-medium text-chalk mb-2">FAQ Section</h3>
              <p className="text-sm text-mist">Direct answers for AI Overviews, ready to embed</p>
              <Button className="mt-4 w-full" size="sm" variant="secondary">Generate FAQ</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-mint text-2xl mb-3">🎯</div>
              <h3 className="font-medium text-chalk mb-2">Comparison Article</h3>
              <p className="text-sm text-mist">Side-by-side with feature tables, pros/cons, verdict</p>
              <Button className="mt-4 w-full" size="sm" variant="secondary">Create Comparison</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-coral text-2xl mb-3">📊</div>
              <h3 className="font-medium text-chalk mb-2">Listicle</h3>
              <p className="text-sm text-mist">Numbered list with citations, stats, expert quotes</p>
              <Button className="mt-4 w-full" size="sm" variant="secondary">Create Listicle</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-purple text-2xl mb-3">🔄</div>
              <h3 className="font-medium text-chalk mb-2">Content Refresh</h3>
              <p className="text-sm text-mist">Update stale content with fresh data, new citations</p>
              <Button className="mt-4 w-full" size="sm" variant="secondary">Refresh Content</Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}