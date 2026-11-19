"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { FolderGit2, Plus, Copy, Trash2, Play, FileText, X, FileUp, Sparkles, AlertCircle } from "lucide-react";
import { Scenario } from "@/types";
import { scenarioApi, setActiveScenarioContext, clearActiveScenarioContext, getActiveScenarioId } from "@/lib/api/scenarioApi";
import { documentApi } from "@/lib/api/documentApi";

export default function ScenariosPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadScenarios();
  }, []);

  const loadScenarios = async () => {
    setLoading(true);
    const data = await scenarioApi.getScenarios();
    setScenarios(data);
    setLoading(false);
  };

  const handleOpenScenario = (scen: Scenario) => {
    setActiveScenarioContext(scen.id, scen.documentName, scen.name, scen.description);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("scenario_changed", { detail: { scenarioId: scen.id } }));
    }
    router.push("/simulation");
  };

  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsCreating(true);
    let docName = selectedFile ? selectedFile.name : "No document loaded";
    let docId = "";

    if (selectedFile) {
      docName = selectedFile.name;
      const uploaded = await documentApi.uploadDocument(selectedFile);
      docId = uploaded.id;
    }

    const created = await scenarioApi.createScenario({
      name: newTitle,
      description: newDesc || "Custom strategy forecasting scenario",
      documentId: docName,
    });

    const activeScenId = created?.id || `scen-${Date.now()}`;
    setActiveScenarioContext(activeScenId, docName, newTitle, newDesc || "Custom strategy forecasting scenario");

    if (created) {
      setScenarios((prev) => [created, ...prev]);
    } else {
      const fallbackScen: Scenario = {
        id: activeScenId,
        name: newTitle,
        description: newDesc || "Custom strategy forecasting scenario",
        documentName: docName,
        createdDate: new Date().toISOString().split("T")[0],
        lastSimulation: "Never",
        status: "READY",
        agentCount: 50,
        overallRiskScore: 50,
      };
      setScenarios((prev) => [fallbackScen, ...prev]);
    }

    setIsCreating(false);
    setIsModalOpen(false);
    setNewTitle("");
    setNewDesc("");
    setSelectedFile(null);
    router.push("/simulation");
  };

  const handleDelete = async (id: string) => {
    const activeId = getActiveScenarioId();
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    await scenarioApi.deleteScenario(id);
    if (id === activeId || !activeId) {
      clearActiveScenarioContext();
    }
  };

  const handleDuplicate = (id: string) => {
    const target = scenarios.find((s) => s.id === id);
    if (!target) return;
    const duplicated: Scenario = {
      ...target,
      id: `scen-${Date.now()}`,
      name: `${target.name} (Copy)`,
      createdDate: new Date().toISOString().split("T")[0],
      status: "DRAFT",
    };
    setScenarios([duplicated, ...scenarios]);
  };

  return (
    <AppShell title="SCENARIOS MANAGEMENT" subtitle="REAL SIMULATION ENVIRONMENT & CONFIGURATIONS">
      {() => (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 select-none">
          {/* Header Action Bar */}
          <div className="rounded-3xl border border-line bg-surface p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Scenario Library</h3>
              <p className="text-xs text-muted mt-0.5">Manage forecasting environments and strategy seed documents</p>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all shadow-md shadow-accent/20 shrink-0"
            >
              <Plus className="h-4 w-4" /> Create Scenario
            </button>
          </div>

          {/* Loading or Empty State */}
          {loading ? (
            <div className="p-12 text-center font-mono text-xs text-muted space-y-2">
              <span className="h-4 w-4 border-2 border-accent border-t-transparent rounded-full animate-spin inline-block" />
              <p>Loading real scenario environments...</p>
            </div>
          ) : scenarios.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line bg-surface p-12 text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto border border-accent/20">
                <FolderGit2 className="h-6 w-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="font-display text-base font-bold text-ink">No Scenarios Found</h4>
                <p className="text-xs text-muted">
                  Create a scenario by uploading a strategy seed document (PDF, DOCX, or TXT) to generate 50 personas and a GraphRAG knowledge engine.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all shadow-md shadow-accent/20"
              >
                <Plus className="h-4 w-4" /> Create First Scenario
              </button>
            </div>
          ) : (
            /* Real Scenarios Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {scenarios.map((scen) => (
                <div
                  key={scen.id}
                  className="rounded-3xl border border-line bg-surface p-6 space-y-4 shadow-sm hover:border-accent/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-display text-base font-bold text-ink">{scen.name}</h4>
                          <span
                            className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase ${
                              scen.status === "READY"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                                : scen.status === "COMPLETED"
                                ? "bg-accent/10 text-accent border border-accent/30"
                                : "bg-raised text-muted"
                            }`}
                          >
                            {scen.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted leading-relaxed font-body">
                          {scen.description}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-base border border-line flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-accent" />
                        <span className="text-ink font-medium truncate max-w-[200px]">{scen.documentName}</span>
                      </div>
                      <span className="text-muted text-[11px] font-semibold">{scen.agentCount} AGENTS</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-mono">
                      <div className="p-2.5 rounded-2xl bg-base border border-line">
                        <span className="text-muted block text-[9px]">CREATED</span>
                        <span className="text-ink font-semibold">{scen.createdDate}</span>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-base border border-line">
                        <span className="text-muted block text-[9px]">LAST SIMULATION</span>
                        <span className="text-ink font-semibold">{scen.lastSimulation}</span>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-base border border-line">
                        <span className="text-muted block text-[9px]">RISK SCORE</span>
                        <span className="text-accent2 font-bold">{scen.overallRiskScore}/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-line flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDuplicate(scen.id)}
                        className="p-2.5 rounded-xl bg-raised border border-line text-muted hover:text-ink transition-all"
                        title="Duplicate Scenario"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(scen.id)}
                        className="p-2.5 rounded-xl bg-raised border border-line text-muted hover:text-red-500 transition-all"
                        title="Delete Scenario"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenScenario(scen)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all shadow-md shadow-accent/20 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" /> Load Scenario
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Scenario Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-lg bg-surface border border-line rounded-3xl p-6 shadow-2xl space-y-6 relative">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-4 right-4 h-8 w-8 rounded-xl bg-raised border border-line flex items-center justify-center text-muted hover:text-ink transition-all"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="space-y-1">
                  <h3 className="font-display text-lg font-bold text-ink">Create New Scenario</h3>
                  <p className="text-xs text-muted">
                    Configure a strategy forecasting scenario with an optional seed document
                  </p>
                </div>

                <form onSubmit={handleCreateScenario} className="space-y-4 text-xs font-mono">
                  <div className="space-y-1">
                    <label className="text-muted block text-[11px] font-bold">SCENARIO TITLE *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Q4 International Pricing Adjustment"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-base border border-line rounded-xl px-4 py-2.5 text-ink focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-muted block text-[11px] font-bold">DESCRIPTION</label>
                    <textarea
                      rows={3}
                      placeholder="Simulate market reaction to +20% enterprise tier price shift..."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="w-full bg-base border border-line rounded-xl p-3 text-ink focus:outline-none focus:border-accent resize-none font-body"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-muted block text-[11px] font-bold">STRATEGY SEED DOCUMENT (.PDF, .DOCX, .TXT)</label>
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-line rounded-2xl bg-base hover:border-accent cursor-pointer transition-colors">
                      <FileUp className="h-6 w-6 text-accent mb-2" />
                      <span className="text-xs font-bold text-ink">
                        {selectedFile ? selectedFile.name : "Click to select or drop seed document"}
                      </span>
                      <span className="text-[10px] text-muted mt-1">Maximum size 15MB</span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-raised border border-line text-ink font-semibold hover:bg-line transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="px-5 py-2.5 rounded-xl bg-accent text-white font-semibold hover:opacity-90 transition-all shadow-md shadow-accent/20 flex items-center gap-2"
                    >
                      {isCreating && <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      <span>{isCreating ? "Generating Scenario..." : "Create Scenario"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
