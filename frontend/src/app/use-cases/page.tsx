"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Waypoints,
  Target,
  Zap,
  HeartPulse,
  Sparkles,
  ChevronRight,
  Users,
  ShieldCheck,
  TrendingUp,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Award,
  ArrowRight
} from "lucide-react";

interface DetailedCase {
  id: string;
  fieldId: "market" | "tech" | "medical";
  fieldName: string;
  badgeText: string;
  badgeIcon: React.ElementType;
  badgeBg: string;
  badgeTextStyle: string;
  badgeBorder: string;
  title: string;
  titleAccent: string;
  humanDescription: string;
  executiveSummary: string;
  challenge: string;
  howLokiHelps: string[];
  simulatedPersonas: { role: string; description: string }[];
  predictiveMetrics: { label: string; value: string; trend: string }[];
  businessImpact: string[];
  keyTakeaway: string;
}

const DETAILED_FIELD_CASES: DetailedCase[] = [
  // 1. MARKET FIELD
  {
    id: "market",
    fieldId: "market",
    fieldName: "Market Field",
    badgeText: "MARKET NARRATIVE SIMULATION",
    badgeIcon: Target,
    badgeBg: "bg-emerald-500/10",
    badgeTextStyle: "text-emerald-600 dark:text-emerald-400",
    badgeBorder: "border-emerald-500/30",
    title: "Market",
    titleAccent: "Simulation AI",
    humanDescription:
      "Test how customers, competitors, investors, and public narratives may react to a launch, pricing move, or market entry before the real market answers for you.",
    executiveSummary:
      "When enterprise B2B companies alter billing models or seat tiers, miscalculating procurement resistance can trigger sudden churn among high-value accounts. Swarmlens simulates 200 synthetic buyer personas to pinpoint exact price-sensitivity limits.",
    challenge:
      "A fast-growing B2B SaaS platform planned to eliminate unlimited seat plans in favor of a hybrid usage-plus-seat model. Management feared losing legacy enterprise accounts (ARR $100k+) who might view this as an unannounced 30% price hike.",
    howLokiHelps: [
      "Simulates procurement directors, CFOs, and end-user team leads across 200 autonomous agent rounds.",
      "Identifies exact price thresholds where accounts switch from compliance to contract cancellation risk.",
      "Evaluates grandfathering discount structures and custom multi-year commitment incentives."
    ],
    simulatedPersonas: [
      { role: "Enterprise Procurement Director", description: "Strict budget guardian focused on vendor consolidation and annual contract caps." },
      { role: "VP of Engineering / CTO", description: "Evaluates software ROI, technical migration effort, and alternative market tools." },
      { role: "Mid-Market Finance Controller", description: "Highly sensitive to unpredictable usage-based invoice spikes." }
    ],
    predictiveMetrics: [
      { label: "Account Churn Risk", value: "14.2%", trend: "Mitigated down to 2.1% via grandfathering" },
      { label: "Net ARR Retention", value: "118%", trend: "+12% expansion over baseline" },
      { label: "Procurement Pushback", value: "3 Rounds", trend: "Negotiation length predicted accurately" }
    ],
    businessImpact: [
      "Prevented $1.4M in potential contract cancellations prior to public announcement.",
      "Optimized enterprise grandfathering tier, increasing initial rollout ARR by 22%.",
      "Provided sales reps with pre-tested negotiation scripts tailored to procurement objections."
    ],
    keyTakeaway:
      "Swarmlens enables GTM executives to test pricing shifts in a risk-free sandbox, discovering customer tolerance boundaries before sending contract updates."
  },

  // 2. TECH FIELD
  {
    id: "tech",
    fieldId: "tech",
    fieldName: "Tech Field",
    badgeText: "TECH ECOSYSTEM SIMULATION",
    badgeIcon: Zap,
    badgeBg: "bg-blue-500/10",
    badgeTextStyle: "text-blue-600 dark:text-blue-400",
    badgeBorder: "border-blue-500/30",
    title: "Tech",
    titleAccent: "Ecosystem AI",
    humanDescription:
      "Predict how developers, open-source contributors, and enterprise architects respond to API deprecations, schema changes, and license shifts before breaking production code.",
    executiveSummary:
      "Sunsetting legacy API endpoints risks alienating third-party developers, breaking critical enterprise integrations, and sparking public developer backlash. Swarmlens models developer community behavior to structure friction-free migration paths.",
    challenge:
      "A developer-first API provider needed to sunset v1 REST endpoints to deploy a high-performance GraphQL & v2 gRPC architecture. Millions of daily API calls relied on legacy payloads, making a sudden forced migration dangerous.",
    howLokiHelps: [
      "Simulates lead architects, SDK maintainers, and junior developers integrating the API into live production apps.",
      "Maps out exact breaking schema changes (e.g. auth header shifts, webhook payload format changes) that cause developer frustration.",
      "Tests automated SDK migration CLI tools and deprecation warning timelines across 180 simulated days."
    ],
    simulatedPersonas: [
      { role: "Senior Integration Architect", description: "Manages complex enterprise middleware and demands long deprecation windows." },
      { role: "Open-Source SDK Maintainer", description: "Vocal community member sensitive to breaking library dependencies." },
      { role: "Startup Technical Founder", description: "Values speed and low maintenance overhead; quick to switch to competitor APIs." }
    ],
    predictiveMetrics: [
      { label: "Developer Friction Index", value: "68 / 100", trend: "Reduced to 18 / 100 with auto-migrator CLI" },
      { label: "Migration Rate (120 Days)", value: "94.5%", trend: "Achieved full compliance before v1 shutdown" },
      { label: "Ecosystem Deflection", value: "< 1.2%", trend: "Competitor migration rate kept near zero" }
    ],
    businessImpact: [
      "Discovered critical Webhook payload formatting bug 2 months prior to public rollout.",
      "Built automated CLI code-mod tool recommended by simulated developer personas.",
      "Maintained 99.8% developer satisfaction score throughout the 6-month deprecation lifecycle."
    ],
    keyTakeaway:
      "Swarmlens transforms high-risk API breaking changes into smooth developer upgrades by validating documentation, tooling, and deprecation timelines beforehand."
  },

  // 3. MEDICAL FIELD
  {
    id: "medical",
    fieldId: "medical",
    fieldName: "Medical Field",
    badgeText: "CLINICAL DECISION SIMULATION",
    badgeIcon: HeartPulse,
    badgeBg: "bg-rose-500/10",
    badgeTextStyle: "text-rose-600 dark:text-rose-400",
    badgeBorder: "border-rose-500/30",
    title: "Clinical",
    titleAccent: "Governance AI",
    humanDescription:
      "Simulate how physicians, hospital boards, CMOs, and health regulators evaluate new clinical AI tools, pricing, and patient safety policies before hospital rollout.",
    executiveSummary:
      "Deploying AI diagnostic software into hospital intensive care units (ICUs) requires overcoming physician alert fatigue, hospital legal board liability concerns, and strict regulatory governance. Swarmlens simulates clinical decision-making teams to ensure safe adoption.",
    challenge:
      "A HealthTech enterprise developed an AI clinical decision support system designed to predict patient sepsis 6 hours early in ICUs. Hospital Chief Medical Officers (CMOs) hesitated to approve deployment due to clinical liability concerns and physician pushback against false-alarm notifications.",
    howLokiHelps: [
      "Simulates ICU attending physicians, head nurses, hospital legal counsel, and Chief Medical Officers.",
      "Evaluates physician reaction to real-time notification frequencies, isolating alert fatigue threshold parameters.",
      "Forecasts legal risk perception and clinical trust build-up across simulated 50-round hospital shift cycles."
    ],
    simulatedPersonas: [
      { role: "Chief Medical Officer (CMO)", description: "Responsible for overall clinical quality, hospital reputation, and liability reduction." },
      { role: "ICU Attending Physician", description: "Time-constrained practitioner demanding ultra-high precision diagnostic alerts." },
      { role: "Hospital Legal & Risk Counsel", description: "Focused on FDA regulatory compliance, patient data privacy, and medical malpractice exposure." }
    ],
    predictiveMetrics: [
      { label: "Clinical Adoption Rate", value: "89%", trend: "+34% increase after notification threshold tuning" },
      { label: "False Alert Friction", value: "Low", trend: "Optimized confidence threshold to 92%" },
      { label: "Hospital Board Approval", value: "4 of 4", trend: "Regional hospital systems approved deployment" }
    ],
    businessImpact: [
      "Tuned AI diagnostic confidence thresholds, eliminating 70% of non-critical alert interruptions for ICU nurses.",
      "Generated comprehensive risk compliance report that satisfied hospital legal board oversight.",
      "Accelerated sales approval timeline in 4 major healthcare networks from 14 months to 90 days."
    ],
    keyTakeaway:
      "Swarmlens bridges the gap between AI innovation and clinical adoption, helping HealthTech companies navigate complex healthcare governance with validated multi-agent simulations."
  }
];

export default function UseCasesPage() {
  const [activeField, setActiveField] = useState<"market" | "tech" | "medical">("market");
  const activeCase = DETAILED_FIELD_CASES.find((c) => c.fieldId === activeField) || DETAILED_FIELD_CASES[0];

  return (
    <div className="min-h-screen bg-base text-ink font-body selection:bg-emerald-500/20 selection:text-ink">
      {/* Top Navbar Header - Light Theme */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-line shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-2xl bg-white border border-emerald-500/30 flex items-center justify-center overflow-hidden shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform p-0.5">
              <img
                src="/logo.jpg"
                alt="LOKI Logo"
                className="h-full w-full object-cover rounded-xl"
              />
            </div>
            <div>
              <span className="font-display text-xl font-extrabold tracking-tight text-ink block">
                LOKI
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-widest block -mt-1">
                L.O.K.I. INTELLIGENCE PLATFORM
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-8 text-xs font-semibold text-ink/80">
            <Link href="/" className="hover:text-emerald-600 transition-colors">
              Home
            </Link>
            <Link href="/use-cases" className="text-emerald-600 font-bold flex items-center gap-1.5">
              <span>Use Cases</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* 3 Field Selection Buttons - Light Theme */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {DETAILED_FIELD_CASES.map((item) => {
            const Icon = item.badgeIcon;
            const isSelected = activeField === item.fieldId;
            return (
              <button
                key={item.id}
                onClick={() => setActiveField(item.fieldId)}
                className={`p-5 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group ${
                  isSelected
                    ? "bg-surface border-emerald-500 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20"
                    : "bg-surface/70 hover:bg-surface border-line/80 hover:border-line"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono tracking-wider uppercase font-semibold border ${item.badgeBorder} ${item.badgeBg} ${item.badgeTextStyle}`}>
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.fieldName}</span>
                  </div>
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-bold text-ink tracking-tight">
                    {item.title} <span className={item.badgeTextStyle}>{item.titleAccent}</span>
                  </h3>
                  <p className="text-xs text-muted mt-1 line-clamp-2">
                    {item.humanDescription}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Field Hero & In-Depth Case Breakdown - Light Theme */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCase.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            {/* Top Headline Banner Card */}
            <div className="rounded-3xl border border-line/80 bg-surface/90 backdrop-blur-md p-8 sm:p-10 shadow-xs space-y-6">
              {/* Capsule Badge (Matching Screenshot Capsule Format) */}
              <div className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border text-xs font-mono tracking-wider uppercase font-bold ${activeCase.badgeBorder} ${activeCase.badgeBg} ${activeCase.badgeTextStyle}`}>
                <activeCase.badgeIcon className="h-4 w-4" />
                <span>{activeCase.badgeText}</span>
              </div>

              {/* Bold Human Headline */}
              <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-ink leading-tight">
                {activeCase.title}{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600">
                  {activeCase.titleAccent}
                </span>
              </h1>

              {/* Natural Human Description Paragraph */}
              <p className="text-base sm:text-lg text-muted font-normal max-w-3xl leading-relaxed">
                {activeCase.humanDescription}
              </p>

              {/* Executive Summary Box */}
              <div className="p-4 rounded-2xl bg-raised/60 border border-line/70 text-xs text-ink/90 leading-relaxed">
                <strong className="font-bold text-ink block mb-1">Executive Summary:</strong>
                {activeCase.executiveSummary}
              </div>
            </div>

            {/* Grid Breakdown: The Challenge vs Swarmlens Solution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* The Industry Challenge Card */}
              <div className="rounded-3xl border border-rose-500/25 bg-rose-500/[0.03] p-6 space-y-4">
                <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-bold text-sm">
                  <div className="h-8 w-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <h3>The Industry Challenge</h3>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {activeCase.challenge}
                </p>
              </div>

              {/* How Swarmlens Helps Card */}
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.03] p-6 space-y-4">
                <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <h3>How LOKI Solves It</h3>
                </div>
                <ul className="space-y-2.5">
                  {activeCase.howLokiHelps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-ink/90">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Simulated Personas Card */}
            <div className="rounded-3xl border border-line/80 bg-surface/90 backdrop-blur-md p-6 sm:p-8 space-y-5 shadow-xs">
              <div className="flex items-center gap-2.5 text-ink font-bold text-base">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3>Simulated Stakeholder Personas</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {activeCase.simulatedPersonas.map((persona, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-raised/60 border border-line/60 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400 font-bold">
                      PERSONA 0{idx + 1}
                    </span>
                    <h4 className="text-xs font-bold text-ink">{persona.role}</h4>
                    <p className="text-[11px] text-muted leading-relaxed">{persona.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Predictive Metrics & Business Impact Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Metrics Column */}
              <div className="md:col-span-1 rounded-3xl border border-line/80 bg-surface/90 p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 text-ink font-bold text-sm">
                  <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3>Predictive Metrics</h3>
                </div>
                <div className="space-y-3">
                  {activeCase.predictiveMetrics.map((metric, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-raised/50 border border-line/60 font-mono">
                      <span className="text-[9px] text-muted uppercase font-bold block">{metric.label}</span>
                      <span className="text-base font-black text-ink block mt-0.5">{metric.value}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                        {metric.trend}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Measured Impact Column */}
              <div className="md:col-span-2 rounded-3xl border border-line/80 bg-surface/90 p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 text-ink font-bold text-sm">
                  <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3>Measured Business Impact & Results</h3>
                </div>
                <div className="space-y-3">
                  {activeCase.businessImpact.map((impact, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3.5 rounded-2xl bg-raised/40 border border-line/60">
                      <div className="h-6 w-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-xs font-mono font-bold mt-0.5">
                        ✓
                      </div>
                      <p className="text-xs text-ink/90 leading-relaxed">{impact}</p>
                    </div>
                  ))}
                </div>

                {/* Key Executive Takeaway */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border border-emerald-500/30 text-xs text-ink">
                  <strong className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1 uppercase text-[10px] font-mono tracking-wider">
                    Key Executive Takeaway:
                  </strong>
                  {activeCase.keyTakeaway}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
