"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardHeader, Panel, StatusChip } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import api from "@/lib/api-client";

export default function ProjectsBrandsPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newProject, setNewProject] = useState("");

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getProjects();
      if (res.ok) {
        setProjects(res.data?.projects ?? res.data ?? []);
      } else {
        setError(res.error || "Failed to load projects");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.trim()) return;
    try {
      const res = await api.createProject({ name: newProject.trim() });
      if (res.ok) {
        setProjects([...projects, res.data]);
        setNewProject("");
      } else {
        setError(res.error || "Failed to create project");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Projects & Brands"
        sub="Manage projects, brands, domains, and competitor associations"
        aside={<Button size="sm">Add Project</Button>}
      />

      {error && (
        <Panel title="Error" level={3}>
          <p className="text-sm text-coral">{error}</p>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title="Projects" level={2} className="lg:col-span-2">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <p className="font-mono text-xs text-mist-dim">Loading projects…</p>
            </div>
          ) : projects.length === 0 ? (
            <EmptyState title="No projects" sub="Create your first project to start tracking GEO performance." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line font-mono text-[0.58rem] uppercase tracking-widest text-mist-dim">
                    <th className="pb-3 pr-4 font-normal">Project</th>
                    <th className="pb-3 pr-4 font-normal">Domain</th>
                    <th className="pb-3 pr-4 font-normal">Prompts</th>
                    <th className="pb-3 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, i) => (
                    <tr key={i} className="border-b border-line/70">
                      <td className="py-3 pr-4 font-mono text-[0.68rem] text-chalk">{p.name || p.title || "Untitled"}</td>
                      <td className="py-3 pr-4 font-mono text-[0.64rem] text-mist-dim">{p.domain ?? "—"}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-mist">{p.prompt_count ?? 0}</td>
                      <td className="py-3"><StatusChip status="published" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Add Project" level={2}>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <label className="block text-xs font-mono text-mist-dim uppercase tracking-widest">Project name</label>
              <input
                id="new-project-input"
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                placeholder="e.g. My Brand"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-iris"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-mono text-mist-dim uppercase tracking-widest">Domain (optional)</label>
              <input placeholder="example.com" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-iris" />
            </div>
            <Button type="submit" size="sm">Create Project</Button>
          </form>
        </Panel>
      </div>

      <Panel title="Brands" level={2}>
        <EmptyState title="No brands configured" sub="Add brand aliases to track mentions across AI observations." />
      </Panel>
    </div>
  );
}