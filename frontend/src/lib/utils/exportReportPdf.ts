/**
 * LOKI Executive Report PDF Exporter
 * Generates an executive A4 printable/downloadable PDF with Times New Roman bold headings,
 * structured sections, and reliable iframe-based printing that avoids browser popup blockers.
 */

export interface ExportReportData {
  title: string;
  scenarioName: string;
  generatedAt?: string;
  decisionVerdict?: string;
  oneLineVerdict?: string;
  overallRiskScore?: number;
  primaryConcern?: string;
  executiveSummary?: string;
  playbook?: Array<{
    priority?: string;
    targetRisk?: string;
    drop?: number | string;
    action?: string;
  }>;
  tradeoff?: {
    advantages?: string[];
    disadvantages?: string[];
    verdict?: string;
    verdict_explanation?: string;
  };
  pushback?: Array<{
    stakeholderGroup?: string;
    corePushback?: string;
    resistanceLevel?: string;
    quote?: string;
  }>;
  keyRisks?: Array<string | any>;
  recommendedActions?: string[];
}

export function generateReportHtml(data: ExportReportData): string {
  const title = data.title || "Executive Forecast Report";
  const scenario = data.scenarioName || "Autonomous Swarm Simulation";
  const dateStr = data.generatedAt || new Date().toLocaleString();
  const verdict = (data.decisionVerdict || "CONDITIONAL_GO").replace(/_/g, " ");
  const oneLine = data.oneLineVerdict || "Deliberation complete across autonomous multi-agent swarm.";
  const riskScore = data.overallRiskScore ?? 35;
  const concern = data.primaryConcern || "Operational scaling & trust verification";
  const execSummary = data.executiveSummary || "Simulation completed across multi-agent consensus nodes.";

  const verdictColor =
    verdict === "GO" ? "#15803d" : verdict === "HOLD" ? "#b91c1c" : "#b45309";
  const verdictBg =
    verdict === "GO" ? "#f0fdf4" : verdict === "HOLD" ? "#fef2f2" : "#fffbeb";
  const verdictBorder =
    verdict === "GO" ? "#86efac" : verdict === "HOLD" ? "#fca5a5" : "#fde68a";

  const advantages = data.tradeoff?.advantages || [];
  const disadvantages = data.tradeoff?.disadvantages || [];
  const netVerdict = data.tradeoff?.verdict || "";
  const netVerdictExpl = data.tradeoff?.verdict_explanation || "";

  const playbook = data.playbook || [];
  const pushback = data.pushback || [];
  const keyRisks = data.keyRisks || [];
  const actions = data.recommendedActions || [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - ${escapeHtml(scenario)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 18mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 0;
      line-height: 1.5;
      font-size: 13px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-bar {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand-title {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #0f172a;
    }
    .brand-sub {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
      letter-spacing: 0.03em;
    }
    .header-meta {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }
    h1 {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 22px;
      font-weight: bold;
      margin: 0 0 6px 0;
      color: #0f172a;
      line-height: 1.25;
    }
    .scenario-meta {
      font-size: 12px;
      color: #475569;
      margin-bottom: 18px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .verdict-box {
      background: ${verdictBg};
      border: 1.5px solid ${verdictBorder};
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 22px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-inside: avoid;
    }
    .verdict-left {
      max-width: 70%;
    }
    .verdict-badge {
      display: inline-block;
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-weight: bold;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${verdictColor};
      margin-bottom: 4px;
    }
    .verdict-headline {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 15px;
      font-weight: bold;
      color: #0f172a;
      margin: 0;
      line-height: 1.35;
    }
    .verdict-right {
      text-align: right;
      border-left: 1px solid ${verdictBorder};
      padding-left: 16px;
    }
    .risk-score-num {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 26px;
      font-weight: bold;
      color: ${verdictColor};
      line-height: 1;
    }
    .risk-score-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: bold;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-top: 2px;
    }
    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    h2 {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 15px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #0f172a;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin: 0 0 10px 0;
    }
    h3 {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 13px;
      font-weight: bold;
      color: #0f172a;
      margin: 0 0 4px 0;
    }
    p {
      margin: 0 0 8px 0;
      text-align: justify;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 8px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      background: #fafafa;
    }
    .card-adv {
      border-left: 3px solid #16a34a;
    }
    .card-dis {
      border-left: 3px solid #dc2626;
    }
    ul {
      margin: 4px 0 0 0;
      padding-left: 18px;
    }
    li {
      margin-bottom: 5px;
      line-height: 1.45;
    }
    .playbook-item {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 8px;
      background: #f8fafc;
      page-break-inside: avoid;
    }
    .playbook-header {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 4px;
      color: #0f172a;
    }
    .pushback-card {
      border: 1px solid #e2e8f0;
      border-left: 3px solid #ea580c;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 8px;
      background: #fffbf5;
      page-break-inside: avoid;
    }
    .footer-bar {
      margin-top: 28px;
      padding-top: 8px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <!-- Top Corporate Header -->
  <div class="header-bar">
    <div>
      <div class="brand-title">LOKI INTELLIGENCE</div>
      <div class="brand-sub">Autonomous Multi-Agent Swarm Simulation & Forecast</div>
    </div>
    <div class="header-meta">
      <div><strong>Date:</strong> ${escapeHtml(dateStr)}</div>
      <div><strong>Confidentiality:</strong> Internal Strategic Use</div>
    </div>
  </div>

  <!-- Document Title & Clean Scenario (Only Scenario, No Source) -->
  <h1>${escapeHtml(title)}</h1>
  <div class="scenario-meta">
    <strong>Scenario:</strong> ${escapeHtml(scenario)}
  </div>

  <!-- Executive Decision Verdict Banner -->
  <div class="verdict-box">
    <div class="verdict-left">
      <div class="verdict-badge">Decision Verdict: ${escapeHtml(verdict)}</div>
      <div class="verdict-headline">${escapeHtml(oneLine)}</div>
      <div style="font-size: 11px; color: #475569; margin-top: 4px;">
        <strong>Primary Strategic Concern:</strong> ${escapeHtml(concern)}
      </div>
    </div>
    <div class="verdict-right">
      <div class="risk-score-num">${riskScore}/100</div>
      <div class="risk-score-label">Overall Risk Score</div>
    </div>
  </div>

  <!-- Executive Summary -->
  <div class="section">
    <h2>1. Executive Summary</h2>
    <p>${escapeHtml(execSummary)}</p>
  </div>

  <!-- Strategic Trade-Off Analysis -->
  ${
    advantages.length > 0 || disadvantages.length > 0 || netVerdict
      ? `
  <div class="section">
    <h2>2. Strategic Trade-Off Analysis</h2>
    <div class="grid-2">
      <div class="card card-adv">
        <h3 style="color: #15803d;">Strategic Advantages (Value Catalysts)</h3>
        <ul>
          ${advantages.map((adv) => `<li>${escapeHtml(adv)}</li>`).join("")}
        </ul>
      </div>
      <div class="card card-dis">
        <h3 style="color: #b91c1c;">Strategic Disadvantages (Operational Vulnerabilities)</h3>
        <ul>
          ${disadvantages.map((dis) => `<li>${escapeHtml(dis)}</li>`).join("")}
        </ul>
      </div>
    </div>
    ${
      netVerdict
        ? `
    <div class="card" style="margin-top: 10px; border-left: 3px solid #0f172a;">
      <h3>Net Executive Verdict: ${escapeHtml(netVerdict)}</h3>
      <p style="margin: 0; font-size: 12px; color: #334155;">${escapeHtml(netVerdictExpl)}</p>
    </div>
    `
        : ""
    }
  </div>
  `
      : ""
  }

  <!-- Key Findings & Market Pushback -->
  ${
    pushback.length > 0
      ? `
  <div class="section">
    <h2>3. Key Findings & Market Pushback</h2>
    ${pushback
      .map(
        (p) => `
      <div class="pushback-card">
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px;">
          <span>${escapeHtml(p.stakeholderGroup || "Stakeholder Faction")}</span>
          <span style="font-size: 11px; color: #c2410c;">Resistance: ${escapeHtml(p.resistanceLevel || "ELEVATED")}</span>
        </div>
        <p style="margin: 0 0 4px 0; font-size: 12px;"><strong>Concern:</strong> ${escapeHtml(p.corePushback || "")}</p>
        ${p.quote ? `<p style="margin: 0; font-size: 11px; font-style: italic; color: #64748b;">"${escapeHtml(p.quote)}"</p>` : ""}
      </div>
    `
      )
      .join("")}
  </div>
  `
      : ""
  }

  <!-- Structured Action Playbook -->
  ${
    playbook.length > 0
      ? `
  <div class="section">
    <h2>4. Recommended Strategic Action Playbook</h2>
    ${playbook
      .map(
        (pb, idx) => `
      <div class="playbook-item">
        <div class="playbook-header">
          <span>Action ${idx + 1} (${escapeHtml(pb.priority || "P1")}) - Target: ${escapeHtml(pb.targetRisk || "Core System")}</span>
          <span style="color: #15803d;">Impact: -${escapeHtml(String(pb.drop || "0"))} pts risk</span>
        </div>
        <p style="margin: 0; font-size: 12px; color: #334155;">${escapeHtml(pb.action || "")}</p>
      </div>
    `
      )
      .join("")}
  </div>
  `
      : ""
  }

  <!-- Key Risk Vectors & Recommended Areas -->
  ${
    keyRisks.length > 0 || actions.length > 0
      ? `
  <div class="section">
    <h2>5. Key Risk Vectors & Investigation Areas</h2>
    ${
      keyRisks.length > 0
        ? `
      <h3 style="margin-top: 6px;">Identified Risk Vectors:</h3>
      <ul>
        ${keyRisks.map((r) => {
          const text = typeof r === "string" ? r : (r?.risk || r?.title || r?.description || "");
          return `<li>${escapeHtml(text)}</li>`;
        }).join("")}
      </ul>
      `
        : ""
    }
    ${
      actions.length > 0
        ? `
      <h3 style="margin-top: 10px;">Recommended Deep-Dive Areas:</h3>
      <ul>
        ${actions.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}
      </ul>
      `
        : ""
    }
  </div>
  `
      : ""
  }

  <!-- Footer -->
  <div class="footer-bar">
    <span>Generated by LOKI Multi-Agent Swarm Intelligence</span>
    <span>Autonomous Consensus Equilibrium · Page 1 of 1</span>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Triggers printing of the formatted report via an invisible iframe.
 * Avoids popup blockers and provides direct "Save as PDF" browser dialog.
 */
export function exportReportToPdf(data: ExportReportData): void {
  const html = generateReportHtml(data);

  let iframe = document.getElementById("__loki_pdf_iframe") as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "__loki_pdf_iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    console.error("[ExportReport] Could not access iframe document for printing");
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Give styles and fonts a moment to layout properly before calling print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error("[ExportReport] Print failed:", err);
    }
  }, 350);
}
