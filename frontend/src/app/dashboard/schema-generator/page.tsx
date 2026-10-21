import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function SchemaGeneratorPage() {
  return (
    <div className="space-y-6">
      <Panel title="Schema Generator" sub="Generates JSON-LD (Article, FAQPage, HowTo, Product, LocalBusiness) — one-click inject">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Generate Schema</Button>
            <Button variant="secondary">Validate Existing</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-iris text-2xl mb-3">📰</div>
              <h3 className="font-medium text-chalk mb-2">Article</h3>
              <p className="text-sm text-mist mb-4">Blog posts, news, guides</p>
              <Button className="w-full" size="sm">Generate</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-gold text-2xl mb-3">❓</div>
              <h3 className="font-medium text-chalk mb-2">FAQPage</h3>
              <p className="text-sm text-mist mb-4">FAQ sections, Q&A pages</p>
              <Button className="w-full" size="sm" variant="secondary">Generate</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-mint text-2xl mb-3">🛠️</div>
              <h3 className="font-medium text-chalk mb-2">HowTo</h3>
              <p className="text-sm text-mist mb-4">Tutorials, guides, walkthroughs</p>
              <Button className="w-full" size="sm" variant="secondary">Generate</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-coral text-2xl mb-3">🛍️</div>
              <h3 className="font-medium text-chalk mb-2">Product</h3>
              <p className="text-sm text-mist mb-4">E-commerce products, pricing</p>
              <Button className="w-full" size="sm" variant="secondary">Generate</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-aqua text-2xl mb-3">🏢</div>
              <h3 className="font-medium text-chalk mb-2">LocalBusiness</h3>
              <p className="text-sm text-mist mb-4">Locations, hours, contact info</p>
              <Button className="w-full" size="sm" variant="secondary">Generate</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-purple text-2xl mb-3">🏷️</div>
              <h3 className="font-medium text-chalk mb-2">Organization</h3>
              <p className="text-sm text-mist mb-4">Company, brand, social profiles</p>
              <Button className="w-full" size="sm" variant="secondary">Generate</Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}