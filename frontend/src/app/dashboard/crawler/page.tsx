import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";

export default function CrawlerPage() {
  return (
    <div className="space-y-6">
      <Panel title="Website Crawler" sub="Discover URLs and analyze pages — JavaScript rendering, content extraction">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button>Start Crawl</Button>
            <Button variant="secondary">Schedule Crawl</Button>
          </div>
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-1 border-b border-line">
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">URL</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Pages</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-mist">Credits Used</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-mist">Last Run</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">northwindlabs.com</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-mint/15 text-mint border-mint/30">completed</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">41,230</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">41.23</td>
                  <td className="px-4 py-3 text-sm text-mist">2 hours ago</td>
                </tr>
                <tr className="border-b border-line/50 hover:bg-surface-1">
                  <td className="px-4 py-3 font-medium text-chalk truncate max-w-xs">shop.northwindlabs.com</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-widest bg-gold/15 text-gold border-gold/30">running</span></td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">12,450</td>
                  <td className="px-4 py-3 text-center font-mono text-chalk">12.45</td>
                  <td className="px-4 py-3 text-sm text-mist">5 min ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}