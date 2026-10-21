import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function WhitelabelPage() {
  return (
    <div className="space-y-6">
      <Panel title="White-label Reporting" sub="Branded PDF and link reports for agency clients — your logo, your domain">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Create Report</Button>
            <Button variant="secondary">Manage Branding</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-iris text-2xl mb-3">📄</div>
              <h3 className="font-medium text-chalk mb-2">White-label PDF</h3>
              <p className="text-sm text-mist mb-4">Full branded report with your logo, colors, domain</p>
              <Button className="w-full" size="sm">Generate PDF</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-aqua text-2xl mb-3">🔗</div>
              <h3 className="font-medium text-chalk mb-2">Shareable Link</h3>
              <p className="text-sm text-mist mb-4">Password-protected live report link</p>
              <Button className="w-full" size="sm" variant="secondary">Create Link</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-gold text-2xl mb-3">🎨</div>
              <h3 className="font-medium text-chalk mb-2">Brand Settings</h3>
              <p className="text-sm text-mist mb-4">Logo, colors, domain, footer, CSS</p>
              <Button className="w-full" size="sm" variant="secondary">Configure</Button>
            </div>
            <div className="bg-surface/60 backdrop-blur-xl rounded-2xl elevate p-5 border border-line/50 hover:border-iris/30 transition-all elevate-hover">
              <div className="text-mint text-2xl mb-3">👥</div>
              <h3 className="font-medium text-chalk mb-2">Client Access</h3>
              <p className="text-sm text-mist mb-4">Manage client permissions, custom views</p>
              <Button className="w-full" size="sm" variant="secondary">Manage</Button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}