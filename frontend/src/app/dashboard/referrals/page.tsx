import { Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/ui/empty-state";

export default function ReferralsPage() {
  return (
    <div className="space-y-6">
      <Panel title="AI Referral Analytics" sub="Track traffic referred by AI platforms where measurable (UTM, referrer headers)">
        <div className="space-y-4">
          <EmptyState
            title="No referral data yet"
            sub="Referral sessions arrive from your own site's analytics — OmniGEO does not see them. Once you connect a source that reports AI referrals, they appear here."
          />
        </div>
      </Panel>
    </div>
  );
}
