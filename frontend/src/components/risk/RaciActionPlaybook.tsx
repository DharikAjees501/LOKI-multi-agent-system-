"use client";

import React, { useState } from "react";
import {
  Briefcase,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileCheck2,
  Filter,
  Layers,
  Send,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Zap,
} from "lucide-react";

export interface RaciItem {
  id: string;
  riskTitle: string;
  simulatedTrigger: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  responsible: string; // R
  accountable: string; // A
  consulted: string; // C
  informed: string; // I
  actionItem: string;
  targetTimeline: string;
  department: "LEGAL" | "FINANCE" | "PR" | "PRODUCT" | "INVESTORS";
  status: "PENDING" | "IN_PROGRESS" | "APPROVED";
}

const DEFAULT_RACI_DATA: RaciItem[] = [
  {
    id: "raci-1",
    riskTitle: "EU Regulatory Data Residency Compliance",
    simulatedTrigger: "Round 02: EU Regulatory Agent flagged §4.2 compliance vulnerability",
    priority: "CRITICAL",
    responsible: "Lead Privacy Counsel",
    accountable: "Chief Legal Officer",
    consulted: "Data Security Architect",
    informed: "Board Risk Committee & CEO",
    actionItem: "Draft EU Data Sovereignty addendum & execute localized data hosting migration roadmap before Q3 launch.",
    targetTimeline: "Day 1 – 7",
    department: "LEGAL",
    status: "IN_PROGRESS",
  },
  {
    id: "raci-2",
    riskTitle: "Enterprise Public Backlash & Press Crisis",
    simulatedTrigger: "Round 03: Tech Journalism & Public Opinion personas panic over tier pricing shift",
    priority: "HIGH",
    responsible: "VP Corporate Comms",
    accountable: "Chief Marketing Officer",
    consulted: "Product Strategy Lead",
    informed: "All Executive Staff & PR Agency",
    actionItem: "Release pre-approved Q&A media kit emphasizing legacy customer grandfathering and value additions.",
    targetTimeline: "Immediate (Day 1–3)",
    department: "PR",
    status: "APPROVED",
  },
  {
    id: "raci-3",
    riskTitle: "Institutional Investor Capital Burn Pushback",
    simulatedTrigger: "Round 04: Institutional Investor personas demand break-even sensitivity models",
    priority: "HIGH",
    responsible: "Head of FP&A",
    accountable: "Chief Financial Officer",
    consulted: "VP Business Operations",
    informed: "CEO & Managing Directors",
    actionItem: "Prepare 3-tier financial stress test model showing break-even under low-adoption conditions.",
    targetTimeline: "Day 7 – 14",
    department: "FINANCE",
    status: "PENDING",
  },
  {
    id: "raci-4",
    riskTitle: "Competitor Price Aggression & Feature Cloning",
    simulatedTrigger: "Round 04: Aggressive Incumbent Competitor lowers enterprise tier pricing by 20%",
    priority: "MEDIUM",
    responsible: "Director of Product Strategy",
    accountable: "Chief Product Officer",
    consulted: "Sales Engineering Lead",
    informed: "Field Sales & Customer Success",
    actionItem: "Publish competitive battlecard for sales teams demonstrating 3x ROI and proprietary swarm engine features.",
    targetTimeline: "Day 14 – 21",
    department: "PRODUCT",
    status: "PENDING",
  },
  {
    id: "raci-5",
    riskTitle: "Board of Directors Governance Approval",
    simulatedTrigger: "Round 05: Proxy Advisors & Board Directors demand formal voting resolution",
    priority: "MEDIUM",
    responsible: "Corporate Secretary",
    accountable: "Chief Executive Officer",
    consulted: "General Counsel",
    informed: "Key Institutional Shareholders",
    actionItem: "Distribute formal board resolution binder including LOKI 50-agent simulation audit report.",
    targetTimeline: "Pre-Board Meeting (Day 30)",
    department: "INVESTORS",
    status: "PENDING",
  },
];

export const RaciActionPlaybook: React.FC<{ activeDoc: string | null }> = ({ activeDoc }) => {
  const [items, setItems] = useState<RaciItem[]>(DEFAULT_RACI_DATA);
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>("raci-1");
  const [showNotification, setShowNotification] = useState<string | null>(null);

  const toggleStatus = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextStatus =
            item.status === "PENDING"
              ? "IN_PROGRESS"
              : item.status === "IN_PROGRESS"
              ? "APPROVED"
              : "PENDING";
          return { ...item, status: nextStatus };
        }
        return item;
      })
    );
  };

  const handleExport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Risk Title,Trigger,Priority,Responsible(R),Accountable(A),Consulted(C),Informed(I),Action Item,Timeline,Department,Status"]
        .concat(
          items.map(
            (i) =>
              `"${i.riskTitle}","${i.simulatedTrigger}","${i.priority}","${i.responsible}","${i.accountable}","${i.consulted}","${i.informed}","${i.actionItem}","${i.targetTimeline}","${i.department}","${i.status}"`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LOKI_RACI_Playbook_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerNotify("RACI Action Playbook exported to CSV!");
  };

  const triggerNotify = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => setShowNotification(null), 3500);
  };

  const filteredItems =
    selectedDept === "ALL"
      ? items
      : items.filter((i) => i.department === selectedDept);

  return (
    <div className="rounded-3xl border border-line/80 bg-surface/90 p-6 space-y-6 shadow-xl relative overflow-hidden select-none">
      {/* Toast Notification */}
      {showNotification && (
        <div className="absolute top-4 right-4 z-50 px-4 py-2.5 rounded-2xl bg-accent text-white text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles className="h-4 w-4" />
          <span>{showNotification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line/60 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-accent font-semibold">
            <Zap className="h-3.5 w-3.5" /> EXECUTIVE DECISION FRAMEWORK
          </div>
          <h2 className="font-display text-lg font-extrabold text-ink mt-0.5">
            Strategic Action Playbook & RACI Matrix
          </h2>
          <p className="text-xs text-muted font-body mt-0.5">
            Automated operational task assignment derived from 200-agent simulation risk vectors ({activeDoc || "Active Strategy"}).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => triggerNotify("Tasks pushed to Jira / Asana workspace!")}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-raised border border-line text-ink text-xs font-mono font-semibold hover:bg-line transition-all"
          >
            <Send className="h-3.5 w-3.5 text-accent" />
            <span>Push to Jira / Asana</span>
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all shadow-md shadow-accent/20"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export RACI CSV</span>
          </button>
        </div>
      </div>

      {/* RACI Legend Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-base/80 border border-line/60 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold flex items-center justify-center shrink-0">
            R
          </span>
          <div>
            <p className="font-bold text-ink">Responsible</p>
            <p className="text-[10px] text-muted">Executes the action item</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-lg bg-accent/20 border border-accent/40 text-accent font-bold flex items-center justify-center shrink-0">
            A
          </span>
          <div>
            <p className="font-bold text-ink">Accountable</p>
            <p className="text-[10px] text-muted">Final decision owner</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center shrink-0">
            C
          </span>
          <div>
            <p className="font-bold text-ink">Consulted</p>
            <p className="text-[10px] text-muted">Provides 2-way input</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-lg bg-accent2/20 border border-accent2/40 text-accent2 font-bold flex items-center justify-center shrink-0">
            I
          </span>
          <div>
            <p className="font-bold text-ink">Informed</p>
            <p className="text-[10px] text-muted">Receives 1-way updates</p>
          </div>
        </div>
      </div>

      {/* Department Filter Tabs */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted flex items-center gap-1.5 shrink-0">
            <Filter className="h-3.5 w-3.5" /> Filter Dept:
          </span>
          {["ALL", "LEGAL", "FINANCE", "PR", "PRODUCT", "INVESTORS"].map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all shrink-0 ${
                selectedDept === dept
                  ? "bg-accent text-white shadow-md shadow-accent/20"
                  : "bg-base text-muted hover:text-ink hover:bg-raised"
              }`}
            >
              {dept === "ALL" ? "All Departments" : dept}
            </button>
          ))}
        </div>

        <div className="text-xs font-mono text-muted shrink-0">
          Showing <span className="text-accent font-bold">{filteredItems.length}</span> Action Items
        </div>
      </div>

      {/* RACI Interactive Table */}
      <div className="overflow-x-auto rounded-2xl border border-line/60 bg-base/40">
        <table className="w-full text-left text-xs font-mono">
          <thead className="border-b border-line/60 bg-surface text-muted uppercase text-[10px]">
            <tr>
              <th className="p-3.5 font-semibold">Status</th>
              <th className="p-3.5 font-semibold">Priority</th>
              <th className="p-3.5 font-semibold">Risk Vector & Action</th>
              <th className="p-3.5 font-semibold">R (Responsible)</th>
              <th className="p-3.5 font-semibold">A (Accountable)</th>
              <th className="p-3.5 font-semibold">Timeline</th>
              <th className="p-3.5 font-semibold text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {filteredItems.map((item, fIdx) => {
              const isExpanded = expandedId === item.id;
              return (
                <React.Fragment key={item.id ? `raci-${item.id}-${fIdx}` : `raci-item-${fIdx}`}>
                  <tr className="hover:bg-raised/50 transition-colors group">
                    {/* Status Toggle */}
                    <td className="p-3.5">
                      <button
                        onClick={() => toggleStatus(item.id)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1.5 ${
                          item.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : item.status === "IN_PROGRESS"
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "bg-raised text-muted border-line hover:text-ink"
                        }`}
                      >
                        <FileCheck2 className="h-3 w-3" />
                        <span>{item.status.replace("_", " ")}</span>
                      </button>
                    </td>

                    {/* Priority Badge */}
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.priority === "CRITICAL"
                            ? "bg-accent2/20 text-accent2 border-accent2/30"
                            : item.priority === "HIGH"
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {item.priority}
                      </span>
                    </td>

                    {/* Risk Title & Brief */}
                    <td className="p-3.5 font-body">
                      <p className="font-bold text-ink text-xs">{item.riskTitle}</p>
                      <p className="text-[11px] text-muted line-clamp-1 mt-0.5">{item.actionItem}</p>
                    </td>

                    {/* R */}
                    <td className="p-3.5 font-semibold text-emerald-400">
                      {item.responsible}
                    </td>

                    {/* A */}
                    <td className="p-3.5 font-semibold text-accent">
                      {item.accountable}
                    </td>

                    {/* Timeline */}
                    <td className="p-3.5 text-muted font-mono flex items-center gap-1.5 mt-2">
                      <Clock className="h-3 w-3 text-accent" />
                      <span>{item.targetTimeline}</span>
                    </td>

                    {/* Expand Toggle */}
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="p-1.5 rounded-lg bg-surface border border-line text-muted hover:text-ink transition-all"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <tr className="bg-base/90 border-b border-line">
                      <td colSpan={7} className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Simulated Trigger */}
                          <div className="md:col-span-6 p-3.5 rounded-2xl bg-surface border border-line space-y-1.5">
                            <p className="text-[10px] font-mono text-accent font-bold uppercase flex items-center gap-1.5">
                              <ShieldAlert className="h-3.5 w-3.5 text-accent2" /> SIMULATION VECTOR TRIGGER
                            </p>
                            <p className="text-xs text-ink/90 font-body leading-relaxed">
                              {item.simulatedTrigger}
                            </p>
                          </div>

                          {/* Full Action Item */}
                          <div className="md:col-span-6 p-3.5 rounded-2xl bg-surface border border-line space-y-1.5">
                            <p className="text-[10px] font-mono text-emerald-400 font-bold uppercase flex items-center gap-1.5">
                              <CheckSquare className="h-3.5 w-3.5" /> MITIGATION ACTION PLAN
                            </p>
                            <p className="text-xs text-ink/90 font-body leading-relaxed">
                              {item.actionItem}
                            </p>
                          </div>
                        </div>

                        {/* Full RACI Assignments Breakdown */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono pt-1">
                          <div className="p-3 rounded-xl bg-surface border border-line">
                            <span className="text-[10px] text-emerald-400 font-bold block uppercase">
                              Responsible (R)
                            </span>
                            <span className="font-bold text-ink mt-0.5 block">{item.responsible}</span>
                          </div>

                          <div className="p-3 rounded-xl bg-surface border border-line">
                            <span className="text-[10px] text-accent font-bold block uppercase">
                              Accountable (A)
                            </span>
                            <span className="font-bold text-ink mt-0.5 block">{item.accountable}</span>
                          </div>

                          <div className="p-3 rounded-xl bg-surface border border-line">
                            <span className="text-[10px] text-amber-400 font-bold block uppercase">
                              Consulted (C)
                            </span>
                            <span className="font-bold text-ink mt-0.5 block">{item.consulted}</span>
                          </div>

                          <div className="p-3 rounded-xl bg-surface border border-line">
                            <span className="text-[10px] text-accent2 font-bold block uppercase">
                              Informed (I)
                            </span>
                            <span className="font-bold text-ink mt-0.5 block">{item.informed}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
