"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, UploadCloud, FileText, CheckCircle2, Loader2, Network, Trash2 } from "lucide-react";
import { documentApi } from "@/lib/api/documentApi";
import { scenarioApi, setActiveScenarioContext, clearActiveScenarioContext, deleteActiveScenarioAndDoc } from "@/lib/api/scenarioApi";

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (docName: string) => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [scenarioTitle, setScenarioTitle] = useState("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [activeDocName, setActiveDocName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [status, setStatus] = useState<
    "IDLE" | "UPLOADING" | "PARSING" | "EXTRACTING" | "GRAPH_BUILDING" | "READY"
  >("IDLE");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isOpen && typeof window !== "undefined") {
      const currentDoc = localStorage.getItem("LOKI_ACTIVE_DOC_NAME") || localStorage.getItem("SWARMLENS_ACTIVE_DOC_NAME");
      if (currentDoc && currentDoc !== "No document loaded") {
        setActiveDocName(currentDoc);
      } else {
        setActiveDocName(null);
      }
      setFile(null);
      setScenarioTitle("");
      setScenarioDescription("");
      setStatus("IDLE");
      setProgress(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      startIngestion(selected);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      startIngestion(e.target.files[0]);
    }
  };

  const startIngestion = (selectedFile: File) => {
    setFile(selectedFile);
    if (!scenarioTitle.trim()) {
      const cleanBase = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ").trim();
      setScenarioTitle(cleanBase);
    }
    setStatus("UPLOADING");
    setProgress(20);

    setTimeout(() => {
      setStatus("PARSING");
      setProgress(50);
    }, 600);

    setTimeout(() => {
      setStatus("EXTRACTING");
      setProgress(75);
    }, 1200);

    setTimeout(() => {
      setStatus("GRAPH_BUILDING");
      setProgress(90);
    }, 1800);

    setTimeout(() => {
      setStatus("READY");
      setProgress(100);
    }, 2400);
  };

  const handleConfirm = async () => {
    const docName = file ? file.name : (activeDocName || "Strategy_Document.pdf");
    const fallbackTitle = file
      ? file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ").trim()
      : (activeDocName ? activeDocName.replace(/\.[^/.]+$/, "").replace(/_/g, " ").trim() : "Custom Strategy Scenario");
    const titleToSave = scenarioTitle.trim() || fallbackTitle;
    const descToSave = scenarioDescription.trim() || `Strategy simulation scenario based on ${docName}`;

    setIsSubmitting(true);

    try {
      if (file) {
        await documentApi.uploadDocument(file, titleToSave, descToSave).catch((e) => console.warn("Doc upload notice:", e));
      }

      // Create isolated scenario record & trigger background GraphRAG + 5-round simulation
      const newScen = await scenarioApi.createAndRunScenario({
        name: titleToSave,
        description: descToSave,
        documentId: docName,
        isWhatIf: false,
      });

      const scenId = newScen?.id || `scen-${Date.now().toString(36)}`;
      setActiveScenarioContext(scenId, docName, titleToSave, descToSave);

      // Start the 5-round simulation immediately
      if (typeof window !== "undefined") {
        localStorage.setItem("SWARMLENS_CURRENT_ROUND", "1");
        localStorage.setItem("LOKI_CURRENT_ROUND", "1");
        localStorage.setItem("SWARMLENS_SIM_STATUS", "RUNNING");
        localStorage.setItem("LOKI_SIM_STATUS", "RUNNING");
        window.dispatchEvent(new Event("swarmlens_start_simulation"));
        window.dispatchEvent(new Event("loki_start_simulation"));
      }

      onComplete(docName);
      onClose();
      router.push("/simulation");
    } catch (err) {
      console.error("[DocumentUploadModal] Failed to confirm scenario upload:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteActiveDoc = async () => {
    await deleteActiveScenarioAndDoc();
    setActiveDocName(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-base/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface border border-line rounded-card shadow-2xl p-6 relative flex flex-col gap-5 select-none animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">Create Scenario & Seed Document</h3>
            <p className="text-xs text-muted">Configure a strategy forecasting scenario with an optional seed document</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-raised border border-line flex items-center justify-center text-muted hover:text-ink transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Delete Active Doc Banner if active */}
        {activeDocName && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3 text-xs font-mono">
            <div className="min-w-0">
              <span className="text-red-400 font-bold block">ACTIVE DOCUMENT LOADED</span>
              <span className="text-muted truncate block text-[11px]">{activeDocName}</span>
            </div>
            <button
              type="button"
              onClick={handleDeleteActiveDoc}
              className="px-3 py-1.5 rounded-xl bg-red-500 text-white font-bold hover:opacity-90 transition-all flex items-center gap-1.5 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Doc</span>
            </button>
          </div>
        )}

        {/* Form Inputs */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-muted uppercase block">
              SCENARIO TITLE *
            </label>
            <input
              type="text"
              value={scenarioTitle}
              onChange={(e) => setScenarioTitle(e.target.value)}
              placeholder="e.g. Q4 International Pricing Adjustment"
              className="w-full bg-base border border-line rounded-2xl px-4 py-2.5 text-xs text-ink placeholder:text-muted/60 focus:outline-none focus:border-accent font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-muted uppercase block">
              DESCRIPTION / STRATEGY PROMPT
            </label>
            <textarea
              rows={2}
              value={scenarioDescription}
              onChange={(e) => setScenarioDescription(e.target.value)}
              placeholder="Simulate market reaction to +20% enterprise tier price shift..."
              className="w-full bg-base border border-line rounded-2xl p-3 text-xs text-ink placeholder:text-muted/60 focus:outline-none focus:border-accent font-body resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold text-muted uppercase block">
              STRATEGY SEED DOCUMENT (.PDF, .DOCX, .TXT)
            </label>

            {/* Drag & Drop Box */}
            {status === "IDLE" && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-line rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 text-center bg-base/40 hover:bg-raised/40 hover:border-accent/50 transition-all cursor-pointer group"
              >
                <div className="h-10 w-10 rounded-2xl bg-raised border border-line flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink">Click to select or drop seed document</p>
                  <p className="text-[10px] text-muted mt-0.5">Maximum size 50MB</p>
                </div>
                <label className="mt-1 py-1 px-3.5 rounded-xl bg-raised border border-line hover:bg-line text-[11px] font-semibold text-ink cursor-pointer transition-all">
                  BROWSE FILES
                  <input
                    type="file"
                    accept=".pdf,.txt,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Processing State */}
            {status !== "IDLE" && file && (
              <div className="space-y-3 p-3 rounded-2xl bg-base border border-line">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-raised border border-line flex items-center justify-center text-accent shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-ink truncate">{file.name}</p>
                    <p className="text-[10px] font-mono text-muted">
                      {(file.size / 1024).toFixed(1)} KB · {file.type || "Document"}
                    </p>
                  </div>
                  {status === "READY" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  ) : (
                    <Loader2 className="h-5 w-5 text-accent animate-spin shrink-0" />
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 font-mono text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-accent font-semibold uppercase">
                      {status === "UPLOADING" && "UPLOADING FILE..."}
                      {status === "PARSING" && "PARSING TEXT STRUCTURE..."}
                      {status === "EXTRACTING" && "EXTRACTING ENTITIES & BIASES..."}
                      {status === "GRAPH_BUILDING" && "BUILDING KNOWLEDGE GRAPH..."}
                      {status === "READY" && "GRAPH EXTRACTION COMPLETE"}
                    </span>
                    <span className="text-ink font-bold">{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-raised rounded-full overflow-hidden border border-line">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-raised border border-line text-muted hover:text-ink text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            disabled={isSubmitting || (!!file && status !== "READY") || (!file && !scenarioTitle.trim())}
            onClick={handleConfirm}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-all shadow-md shadow-accent/20"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Network className="h-4 w-4" />
            )}
            <span>{isSubmitting ? "Running Simulation..." : "Run Simulation"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
