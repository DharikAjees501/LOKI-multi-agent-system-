import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and print total page count
    with professional monochrome running headers and footers.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Times-Roman", 8)
        self.setStrokeColor(colors.black)
        self.setLineWidth(0.5)

        # Running Header (pages 2 through 6)
        if self._pageNumber > 1:
            self.line(36, 756, 576, 756)
            self.drawString(36, 760, "LOKI: AUTONOMOUS SWARM INTELLIGENCE & STRATEGIC SIMULATION")
            self.drawRightString(576, 760, "ENTERPRISE SPECIFICATION WHITE PAPER")

        # Running Footer (all pages)
        self.line(36, 42, 576, 42)
        self.drawString(36, 32, "CONFIDENTIAL & PROPRIETARY — LOKI SYSTEM PLATFORM ARCHITECTURE")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(576, 32, page_str)
        self.restoreState()

def create_loki_specification_pdf(output_filename: str):
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=46,
        bottomMargin=48
    )

    styles = getSampleStyleSheet()

    # Custom Clean Times New Roman Monochrome Styles
    title_style = ParagraphStyle(
        "DocTitle",
        fontName="Times-Bold",
        fontSize=15,
        leading=18,
        alignment=TA_CENTER,
        textColor=colors.black,
        spaceAfter=3
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        fontName="Times-Italic",
        fontSize=9.5,
        leading=12,
        alignment=TA_CENTER,
        textColor=colors.black,
        spaceAfter=6
    )

    meta_style = ParagraphStyle(
        "DocMeta",
        fontName="Times-Roman",
        fontSize=8,
        leading=10,
        alignment=TA_CENTER,
        textColor=colors.black,
        spaceAfter=8
    )

    h1_style = ParagraphStyle(
        "Heading1_Custom",
        fontName="Times-Bold",
        fontSize=11,
        leading=13.5,
        textColor=colors.black,
        spaceBefore=5,
        spaceAfter=3,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        "Heading2_Custom",
        fontName="Times-Bold",
        fontSize=9.5,
        leading=12,
        textColor=colors.black,
        spaceBefore=4,
        spaceAfter=2,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        "Body_Custom",
        fontName="Times-Roman",
        fontSize=8.5,
        leading=11,
        alignment=TA_JUSTIFY,
        textColor=colors.black,
        spaceAfter=3
    )

    body_bold = ParagraphStyle(
        "BodyBold_Custom",
        fontName="Times-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.black,
        spaceAfter=2
    )

    bullet_style = ParagraphStyle(
        "Bullet_Custom",
        fontName="Times-Roman",
        fontSize=8.2,
        leading=10.5,
        leftIndent=12,
        firstLineIndent=-8,
        alignment=TA_JUSTIFY,
        textColor=colors.black,
        spaceAfter=2
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        fontName="Times-Bold",
        fontSize=8,
        leading=10,
        alignment=TA_LEFT,
        textColor=colors.black
    )

    table_cell_style = ParagraphStyle(
        "TableCell",
        fontName="Times-Roman",
        fontSize=7.8,
        leading=9.8,
        alignment=TA_LEFT,
        textColor=colors.black
    )

    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        fontName="Times-Bold",
        fontSize=7.8,
        leading=9.8,
        alignment=TA_LEFT,
        textColor=colors.black
    )

    callout_text = ParagraphStyle(
        "CalloutText",
        fontName="Times-Italic",
        fontSize=8.2,
        leading=10.5,
        alignment=TA_JUSTIFY,
        textColor=colors.black
    )

    story = []

    # =========================================================================
    # PAGE 1: EXECUTIVE OVERVIEW & THE STRATEGIC DECISION CHALLENGE
    # =========================================================================
    story.append(Paragraph("LOKI: AUTONOMOUS SWARM INTELLIGENCE & STRATEGIC SIMULATION", title_style))
    story.append(Paragraph("A Technical White Paper on In-Silico Multi-Agent Deliberation, GraphRAG Knowledge Grounding, and Decision Risk Forecasting", subtitle_style))
    story.append(Paragraph("Version 3.2 · Enterprise Specification · Published: November 2026 · Antigravity DeepMind / SwarmLens Engineering", meta_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.black, spaceBefore=0, spaceAfter=6))

    story.append(Paragraph("1. Executive Summary & Core Mission", h1_style))
    story.append(Paragraph(
        "Modern corporate enterprises operate in an era of unprecedented strategic fragility. Large organizations regularly announce high-stakes moves—such as subscription pricing restructurings, terms-of-service revisions, product sunset roadmaps, M&A integrations, and compliance disclosures—without empirical pre-validation of how external and internal ecosystems will respond. Traditional validation approaches, including focus groups, retrospective stakeholder surveys, and executive consensus meetings, are inherently static, slow, biased, and incapable of predicting non-linear backlash cascades.",
        body_style
    ))
    story.append(Paragraph(
        "<b>LOKI (SwarmLens)</b> is an enterprise-grade autonomous swarm simulation engine built to solve this 'strategic blindness' dilemma. LOKI ingests unstructured corporate strategic documents, extracts a semantic GraphRAG knowledge topology, instantiates an authentic multi-tiered population of <b>200 autonomous agent personas</b>, and stress-tests proposed initiatives across <b>5 interactive rounds of deliberation</b>. By modeling emergent human behaviors—such as regulatory scrutiny, viral social panic, executive hedging, and customer churn—LOKI forecasts quantifiable risk vectors and provides counter-mitigation roadmaps before real capital is committed or public announcements occur.",
        body_style
    ))

    story.append(Paragraph("2. The Problem: Strategic Blindness in High-Stakes Initiatives", h1_style))
    story.append(Paragraph(
        "When an enterprise implements a policy change, the backlash rarely stems from a single isolated decision; rather, it emerges from complex social and economic feedback loops. For example, a minor technical clause in a data-processing agreement can trigger institutional privacy watchdog alerts (Tier 2), which are sensationalized by industry journalists and social commentators (Tier 3), leading to viral churn and boycotts across broad customer segments (Tier 4), which ultimately forces an emergency board-level reversal (Tier 1). LOKI models these bidirectional cascade dynamics in software.",
        body_style
    ))

    # Table: Traditional Methods vs. LOKI
    comp_data = [
        [
            Paragraph("Evaluation Dimension", table_header_style),
            Paragraph("Traditional Corporate Methods (Surveys, Focus Groups)", table_header_style),
            Paragraph("LOKI Swarm Simulation Platform", table_header_style)
        ],
        [
            Paragraph("Feedback Latency", table_cell_bold),
            Paragraph("Weeks to months; purely retrospective or delayed.", table_cell_style),
            Paragraph("Sub-minute simulation across 200 personas in parallel.", table_cell_style)
        ],
        [
            Paragraph("Cascading Feedback", table_cell_bold),
            Paragraph("Linear, siloed; unable to model cross-tier reactions.", table_cell_style),
            Paragraph("Simulates multi-channel cascades and viral shock propagation.", table_cell_style)
        ],
        [
            Paragraph("Evidence Grounding", table_cell_bold),
            Paragraph("Subjective interviewer opinions and leading survey questions.", table_cell_style),
            Paragraph("GraphRAG semantic anchoring directly to document text.", table_cell_style)
        ],
        [
            Paragraph("Repeatability & Stress", table_cell_bold),
            Paragraph("High cost per run; cannot easily test alternative 'What-If' shocks.", table_cell_style),
            Paragraph("Deterministic seeding, infinite What-If iterations, automated scoring.", table_cell_style)
        ]
    ]
    t_comp = Table(comp_data, colWidths=[105, 215, 220])
    t_comp.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.75, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F0F0F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_comp)
    story.append(Spacer(1, 4))

    story.append(Paragraph("3. Core Product Principles", h1_style))
    story.append(Paragraph(
        "<b>• Radical Semantic Grounding:</b> No hallucinated or generic scenarios. Every persona's objections and endorsements are tied via chunk indices to actual document clauses.<br/>"
        "<b>• Multi-Polar Sociological Tension:</b> Personas are initialized with realistic divergent incentives—executives seek growth, auditors seek compliance, media seeks exposure, and users seek value.<br/>"
        "<b>• Mathematical Risk Quantification:</b> Qualitative debate transcripts are converted into standardized 0–100 risk indices, consensus distributions, and prioritized operational vectors.<br/>"
        "<b>• Multi-Modal Executive Delivery:</b> Delivers actionable results through synchronized 8-slide presenter decks, concise 60-second audio briefings, and live interactive agent interrogation.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: INGESTION, GRAPHRAG & KNOWLEDGE TOPOLOGY
    # =========================================================================
    story.append(Paragraph("4. Document Ingestion & Knowledge Graph Architecture", h1_style))
    story.append(Paragraph(
        "The foundation of LOKI's accuracy is its semantic ingestion engine. The platform ingests source strategic documents across standard enterprise formats (.PDF, .DOCX, .TXT) and executes structural parsing before any agent simulation turn begins. This ensures that every subsequent persona debate is strictly grounded in the organization's own documented language, pricing tables, operational dependencies, and compliance frameworks.",
        body_style
    ))

    story.append(Paragraph("4.1 Sliding-Window Text Chunking Pipeline", h2_style))
    story.append(Paragraph(
        "Raw documents are processed using deterministic sliding-window chunking. Each chunk is bounded to approximately 1,000 characters with a 150-character contextual overlap. This prevents semantic boundary loss across complex tables, multi-clause policy terms, and nested bullet points. Each chunk receives a cryptographic hash identifier and is indexed in relational storage for immediate sub-millisecond retrieval during agent deliberation turns.",
        body_style
    ))

    story.append(Paragraph("4.2 GraphRAG Knowledge Entity & Relationship Extraction", h2_style))
    story.append(Paragraph(
        "Rather than relying on naive vector embedding similarity—which frequently retrieves disjointed fragments without contextual awareness—LOKI utilizes <b>Graph Retrieval-Augmented Generation (GraphRAG)</b>. Chunks are evaluated using advanced reasoning LLMs (<i>gemini-3.8-flash</i>) to extract structured entity nodes and directed causal relationships.",
        body_style
    ))

    # Graph Extraction Table
    graph_data = [
        [
            Paragraph("Entity Category", table_header_style),
            Paragraph("Definition & Structural Role", table_header_style),
            Paragraph("Extracted Semantic Relationships", table_header_style)
        ],
        [
            Paragraph("Stakeholder Entity", table_cell_bold),
            Paragraph("Key corporate personas, external authorities, customer cohorts.", table_cell_style),
            Paragraph("REPORTS_TO, GOVERNED_BY, INFLUENCES, OPPOSES", table_cell_style)
        ],
        [
            Paragraph("Strategic Policy", table_cell_bold),
            Paragraph("Pricing adjustments, SLAs, feature deprecations, migration dates.", table_cell_style),
            Paragraph("IMPLEMENTS, MANDATES, AMENDS, CONFLICTS_WITH", table_cell_style)
        ],
        [
            Paragraph("Operational Resource", table_cell_bold),
            Paragraph("Cloud infrastructure, databases, API gateways, support pipelines.", table_cell_style),
            Paragraph("DEPENDS_ON, BOTTLENECKED_BY, HOSTS, INTEGRATES", table_cell_style)
        ],
        [
            Paragraph("Regulatory Constraint", table_cell_bold),
            Paragraph("Statutory laws, GDPR compliance, SOC2 audits, FTC oversight.", table_cell_style),
            Paragraph("RESTRICTS, SANCTIONS, REQUIRES_AUDIT, ENFORCES", table_cell_style)
        ]
    ]
    t_graph = Table(graph_data, colWidths=[105, 220, 215])
    t_graph.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.75, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F0F0F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_graph)
    story.append(Spacer(1, 4))

    story.append(Paragraph("4.3 NetworkX Multi-Relational Topological Memory", h2_style))
    story.append(Paragraph(
        "Extracted entities and edges are merged into an in-memory NetworkX directed graph representation. LOKI applies graph-theoretic density metrics to ensure semantic coherence. Nodes are designated as either <b>Cluster Hubs</b> (representing high-centrality authority nodes such as the CEO, Lead Privacy Counsel, or Major Enterprise Customer) or <b>Peripheral Nodes</b>. Intra-tier edges maintain local community consensus, while cross-tier bridge edges transmit information and ideological debate across the entire network.",
        body_style
    ))

    story.append(Paragraph("4.4 Strict Source Document Grounding Protocol", h2_style))
    story.append(Paragraph(
        "When an agent is queried or makes an autonomous deliberation post, its system prompt is dynamically assembled with exact verbatim snippets from the source document chunks mapped to its entity subgraph. This protocol completely eliminates synthetic hallucination: an agent representing an Enterprise Procurement Officer will cite the exact migration fee and timeline specified on page 4 of the uploaded contract, grounding all risk predictions in verifiable business reality.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 3: THE 200-AGENT AUTONOMOUS SWARM ARCHITECTURE
    # =========================================================================
    story.append(Paragraph("5. The 200-Persona Autonomous Swarm Architecture", h1_style))
    story.append(Paragraph(
        "A critical limitation of earlier agentic systems is demographic homogeneity: when 50 identical agents evaluate an idea, they exhibit severe confirmation bias and collapse into artificial consensus. LOKI addresses this by deploying <b>200 heterogeneous autonomous agent personas</b> organized into four hierarchical socio-economic tiers. This population size provides statistically robust distributions while maintaining high computational performance.",
        body_style
    ))

    story.append(Paragraph("5.1 Four-Tier Stakeholder Hierarchy", h2_style))
    story.append(Paragraph(
        "<b>• Tier 1: Boardroom Leadership & Executive Sponsors (20 Personas)</b><br/>"
        "Comprises the C-Suite and internal operational directors: Chief Executive Officer (CEO), Chief Financial Officer (CFO), Chief Legal Officer (CLO), Chief Information Security Officer (CISO), VP of Product, and Strategy Directors. These agents prioritize enterprise ROI, market differentiation, operational efficiency, and shareholder value.",
        body_style
    ))
    story.append(Paragraph(
        "<b>• Tier 2: Institutional Watchdogs, Regulators & Legal Auditors (30 Personas)</b><br/>"
        "Includes statutory compliance auditors, data privacy watchdogs (GDPR/CCPA enforcement), trade regulators, antitrust analysts, and external risk monitors. They scrutinize disclosures, data sovereignty, contract enforceability, and statutory liability.",
        body_style
    ))
    story.append(Paragraph(
        "<b>• Tier 3: Industry Media, Financial Analysts & Public Critics (50 Personas)</b><br/>"
        "Consists of tech investigative journalists, financial market analysts, investigative bloggers, competitor intelligence monitors, and vocal public critics. Driven by narrative impact, market disruption, customer vulnerability disclosures, and viral news value.",
        body_style
    ))
    story.append(Paragraph(
        "<b>• Tier 4: Broad Market, Consumer Factions & End Users (100 Personas)</b><br/>"
        "Represents the broader consumer and client base: power users, legacy customers, price-sensitive startups, IT system administrators, enterprise procurement leads, and vendor partners. These personas exhibit acute sensitivity to price hikes, workflow disruptions, and contractual changes.",
        body_style
    ))

    # Table: Swarm Tier Specs
    tier_data = [
        [
            Paragraph("Tier Designation", table_header_style),
            Paragraph("Population", table_header_style),
            Paragraph("Core Incentive Profile", table_header_style),
            Paragraph("Initial Stance Band", table_header_style),
            Paragraph("Target LLM Engine", table_header_style)
        ],
        [
            Paragraph("Tier 1: Boardroom", table_cell_bold),
            Paragraph("20 Agents", table_cell_style),
            Paragraph("ROI, Competitive Moat, P&L Pacing", table_cell_style),
            Paragraph("+0.18 to +0.72 (Positive)", table_cell_style),
            Paragraph("gemini-3.5-flash-lite", table_cell_style)
        ],
        [
            Paragraph("Tier 2: Regulators", table_cell_bold),
            Paragraph("30 Agents", table_cell_style),
            Paragraph("Compliance, Audit Gaps, Data Risk", table_cell_style),
            Paragraph("-0.42 to +0.35 (Skeptical)", table_cell_style),
            Paragraph("gemini-3.5-flash-lite", table_cell_style)
        ],
        [
            Paragraph("Tier 3: Media & Critics", table_cell_bold),
            Paragraph("50 Agents", table_cell_style),
            Paragraph("Public Exposure, Viral Controversy", table_cell_style),
            Paragraph("-0.55 to +0.25 (Critical)", table_cell_style),
            Paragraph("gemini-3.5-flash-lite", table_cell_style)
        ],
        [
            Paragraph("Tier 4: Market / Users", table_cell_bold),
            Paragraph("100 Agents", table_cell_style),
            Paragraph("Switching Costs, Pricing, Utility", table_cell_style),
            Paragraph("-0.75 to +0.45 (Bipolar)", table_cell_style),
            Paragraph("gemini-3.5-flash-lite", table_cell_style)
        ]
    ]
    t_tier = Table(tier_data, colWidths=[95, 55, 155, 115, 120])
    t_tier.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.75, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F0F0F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_tier)
    story.append(Spacer(1, 4))

    story.append(Paragraph("5.2 Persona Profile Anatomy & Psychological Modeling", h2_style))
    story.append(Paragraph(
        "Each agent is endowed with explicit psychological and professional attributes: a distinct professional title, institutional incentive, risk threshold (0–100), cognitive bias (e.g., status-quo bias, regulatory paranoia, aggressive scaling bias), and a numerical stance score continuously tracked between -1.0 (total opposition) and +1.0 (unconditional support). This initialization guarantees multi-polar tension from Round 1.",
        body_style
    ))

    story.append(Paragraph("5.3 Multi-Provider LLM Failover & Routing Pool", h2_style))
    story.append(Paragraph(
        "To execute thousands of prompt turns without interruption, LOKI deploys a universal multi-provider LLM routing engine with automated failover across Google Gemini, Groq, and OpenAI. Routine agent steps run on lightweight low-latency models (<i>gemini-3.5-flash-lite</i>), observer synthesis leverages deep reasoning models (<i>gemini-3.8-flash</i>), and audio scripts utilize dedicated speech-synthesis engines (<i>gemini-3.8-flash-lite-tts</i>).",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 4: 5-ROUND SIMULATION DYNAMICS & CASCADE DELIBERATION
    # =========================================================================
    story.append(Paragraph("6. The 5-Round Simulation Engine & Cascade Mechanics", h1_style))
    story.append(Paragraph(
        "LOKI simulates the real-world temporal propagation of an enterprise strategy across <b>five distinct, structured simulation rounds</b>. A single static evaluation cannot predict how an announcement evolves over time; in reality, initial reactions trigger policy defenses, regulatory inquiries, leaked concerns, and viral backlash. The 5-round lifecycle models this organic dynamic.",
        body_style
    ))

    story.append(Paragraph("6.1 Step-by-Step Simulation Progression Lifecycle", h2_style))
    story.append(Paragraph(
        "<b>• Round 1: Bootstrap & Baseline Alignment:</b> All 200 agents read the grounded source document. Personas establish initial individual stances and publish opening statements in their native channels. Internal boardroom alignment is established.<br/>"
        "<b>• Round 2: Cross-Channel Cascade & Regulatory Inquiries:</b> Boardroom decisions propagate to media and regulatory monitors. Tier 2 auditors identify potential statutory vulnerabilities, questioning operational timelines and legal exposures.<br/>"
        "<b>• Round 3: Critical External Shock Injection:</b> LOKI introduces a severe scenario stress test (e.g., an unannounced price restructuring, sudden audit announcement, or competitor counter-campaign). This shock forces agents to re-evaluate their baseline assumptions.<br/>"
        "<b>• Round 4: Polarization, Coalition Formation & Backlash:</b> The swarm undergoes acute polarization. Dissenting personas organize around catalyst bridge nodes. Dissenting arguments bleed across channels, triggering broader public forum resistance.<br/>"
        "<b>• Round 5: Equilibrium Settlement & Final Consensus:</b> The deliberation stabilizes. Agents publish final binding positions, numerical stances settle into terminal values, and the stage is set for Stage 4 observer synthesis.",
        body_style
    ))

    story.append(Paragraph("6.2 Tri-Channel Communication Architecture", h2_style))
    story.append(Paragraph(
        "Personas communicate across three isolated yet interconnected virtual channels:<br/>"
        "<b>1. Channel 1 (Executive Boardroom):</b> Restricted to Tiers 1 and 2. High-level strategic formulation, risk mitigation, and corporate governance debates.<br/>"
        "<b>2. Channel 2 (Media & Press Room):</b> Governed by Tier 3 amplifiers. Press releases, investigative articles, competitor reactions, and public discourse amplification.<br/>"
        "<b>3. Channel 3 (Public Forum Feed):</b> Open market discussion representing Tier 4 end-users. Real-time community sentiment, sentiment shifts, and grassroots churn threats.",
        body_style
    ))

    # Cascade Flow Table
    cascade_data = [
        [
            Paragraph("Cascade Vector", table_header_style),
            Paragraph("Origin & Direction", table_header_style),
            Paragraph("Propagation Mechanism", table_header_style),
            Paragraph("Observable Strategic Consequence", table_header_style)
        ],
        [
            Paragraph("Top-Down Policy Cascade", table_cell_bold),
            Paragraph("CH_1 (Boardroom) → CH_2 (Press) → CH_3 (Public)", table_cell_style),
            Paragraph("Executive announcements and policy leaks broadcast outward.", table_cell_style),
            Paragraph("Shapes initial market narrative and frames value proposition.", table_cell_style)
        ],
        [
            Paragraph("Bottom-Up Backlash Spike", table_cell_bold),
            Paragraph("CH_3 (Public) → CH_2 (Press) → CH_1 (Boardroom)", table_cell_style),
            Paragraph("Viral consumer dissent amplified by journalists into C-suite alerts.", table_cell_style),
            Paragraph("Triggers executive crisis response and strategic reassessment.", table_cell_style)
        ],
        [
            Paragraph("Horizontal Regulatory Wall", table_cell_bold),
            Paragraph("Tier 2 (Regulators) ↔ Tier 1 (Boardroom)", table_cell_style),
            Paragraph("Formal statutory inquiries and compliance mandates.", table_cell_style),
            Paragraph("Enforces milestone gating or threat of statutory sanctions.", table_cell_style)
        ]
    ]
    t_cascade = Table(cascade_data, colWidths=[105, 125, 155, 155])
    t_cascade.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.75, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F0F0F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_cascade)
    story.append(Spacer(1, 4))

    story.append(Paragraph("6.3 Catalyst Bridge Nodes & Tipping Point Identification", h2_style))
    story.append(Paragraph(
        "A proprietary capability of LOKI is identifying <b>Catalyst Bridge Nodes</b>. These are specific personas with high cross-network betweenness centrality (e.g., a Chief Legal Officer who bridges Boardroom and Regulators, or an influential Tech Columnist bridging Press and Users). When a bridge node switches from endorsement to dissent, it reliably triggers an exponential cascade shift across downstream personas.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 5: RISK SYNTHESIS, CONSENSUS & ANALYTICS ENGINE
    # =========================================================================
    story.append(Paragraph("7. Risk Synthesis, Consensus Modeling & Analytics Engine", h1_style))
    story.append(Paragraph(
        "Raw simulation logs comprising hundreds of thousands of words are of limited utility to executive leadership without rigorous synthesis. LOKI features a dedicated <b>Analytics & Risk Synthesis Engine</b> that transforms unstructured dialogue into mathematical risk scores, categorized operational risk vectors, and interactive consensus distribution matrices.",
        body_style
    ))

    story.append(Paragraph("7.1 Algorithmic Risk Scoring Mathematical Model", h2_style))
    story.append(Paragraph(
        "LOKI calculates the <b>Overall Scenario Risk Score (0–100)</b> using a multi-factor mathematical formulation grounded in empirical swarm telemetry rather than static heuristic guessing:",
        body_style
    ))
    story.append(Paragraph(
        "<i>Risk Score = min(99, max(12, round(Opposition Volume + Intensity Bonus + Polarization Bonus)))</i>",
        body_bold
    ))
    story.append(Paragraph(
        "<b>• Opposition Volume:</b> Evaluates the weighted percentage of critical and negative personas: <i>((Critical Count × 1.15 + Negative Count × 0.75) / Total Swarm) × 100</i>.<br/>"
        "<b>• Intensity Bonus:</b> Measures the depth of opposition: <i>(Mean Stance of Dissenting Personas) × 22.0</i>.<br/>"
        "<b>• Polarization Bonus:</b> Quantifies ideological fragmentation: <i>(Standard Deviation of Swarm Stances) × 18.0</i>.",
        body_style
    ))

    # Risk Score Index Table
    risk_data = [
        [
            Paragraph("Risk Band", table_header_style),
            Paragraph("Score Range", table_header_style),
            Paragraph("Empirical Definition & Consensus State", table_header_style),
            Paragraph("Recommended Corporate Action", table_header_style)
        ],
        [
            Paragraph("LOW RISK", table_cell_bold),
            Paragraph("0 – 35", table_cell_style),
            Paragraph("Broad cross-tier consensus; localized friction easily resolved.", table_cell_style),
            Paragraph("Proceed with standard deployment; monitor live telemetry.", table_cell_style)
        ],
        [
            Paragraph("MODERATE", table_cell_bold),
            Paragraph("36 – 65", table_cell_style),
            Paragraph("Concentrated opposition in specialized channels (e.g., Legal or SMBs).", table_cell_style),
            Paragraph("Implement phased rollout; execute targeted stakeholder reviews.", table_cell_style)
        ],
        [
            Paragraph("HIGH RISK", table_cell_bold),
            Paragraph("66 – 80", table_cell_style),
            Paragraph("Severe opposition across multiple tiers; active media/churn threat.", table_cell_style),
            Paragraph("Enforce milestone gating; restructure disputed strategy clauses.", table_cell_style)
        ],
        [
            Paragraph("CRITICAL", table_cell_bold),
            Paragraph("81 – 100", table_cell_style),
            Paragraph("Widespread multi-tier revolt; regulatory breach and brand damage.", table_cell_style),
            Paragraph("Immediate conditional pause; do not announce without overhaul.", table_cell_style)
        ]
    ]
    t_risk = Table(risk_data, colWidths=[85, 65, 205, 185])
    t_risk.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.75, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F0F0F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_risk)
    story.append(Spacer(1, 4))

    story.append(Paragraph("7.2 The 200-Agent Consensus Matrix", h2_style))
    story.append(Paragraph(
        "LOKI synthesizes individual agent positions into an exhaustive <b>Consensus Matrix</b>. Each row displays the agent's name, role, tier, position summary, confidence percentage, and assigned risk category. Built-in UI pagination (10, 20, 50 per page) enables executive review across all 200 personas, allowing leaders to pinpoint exactly which department heads, regulatory bodies, or customer segments are resisting specific terms.",
        body_style
    ))

    story.append(Paragraph("7.3 Automated Turning Point Detection", h2_style))
    story.append(Paragraph(
        "Throughout simulation execution, LOKI monitors step-level delta derivatives. When an agent shift exceeds ±0.40 in a single round or when overall sentiment drops by more than 15% following a shock event, LOKI registers an automated <b>Critical Turning Point</b>. This chronological timeline illuminates the exact catalyst and dialogue exchange that caused a strategy to unravel.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 6: DELIVERABLES, SECURITY, GOVERNANCE & DEPLOYMENT
    # =========================================================================
    story.append(Paragraph("8. Executive Deliverables, Security & Enterprise Deployment", h1_style))
    story.append(Paragraph(
        "LOKI is built for enterprise consumption. Upon simulation completion, the platform generates a multi-modal deliverable suite designed for executive decision-makers, steering committees, and corporate boards.",
        body_style
    ))

    story.append(Paragraph("8.1 The Multi-Modal Executive Reporting Suite", h2_style))
    story.append(Paragraph(
        "<b>• Stage 4 Chief Observer Agent Synthesis:</b> Powered by <i>gemini-3.8-flash</i>, an independent observer agent analyzes all 5-round transcripts to generate an 8-slide presentation deck covering Overview, Stakeholder Opposition, Boardroom Stance, Regulatory Friction, Market Dynamics, Trajectory, Actionable Strategic Roadmap, and Final Verdict.<br/>"
        "<b>• 60-Second Executive Audio Briefing:</b> Generated via <i>gemini-3.8-flash-lite-tts</i>, providing a crisp, spoken 90–110 word executive briefing script playable directly in the application using high-fidelity natural speech synthesis.<br/>"
        "<b>• Real-Time Interactive Interrogation Drawer:</b> Decision-makers can click any of the 200 agents to cross-examine their specific objections in real-time, querying their detailed reasoning before finalizing strategy.",
        body_style
    ))

    story.append(Paragraph("8.2 Enterprise Security, Data Isolation & Privacy", h2_style))
    story.append(Paragraph(
        "Corporate strategic documents represent an organization's most sensitive intellectual property. LOKI is engineered around strict zero-retention principles:<br/>"
        "<b>• Ephemeral Tenancy:</b> Each scenario operates in isolated database boundaries. Deleting a scenario cascades across all document chunks, graph nodes, agent records, and report artifacts.<br/>"
        "<b>• Zero Model Training:</b> Enterprise API calls are configured with explicit zero-retention flags; proprietary strategy text is never cached or used for foundation model pre-training.<br/>"
        "<b>• ISO 31000 Risk Management Framework:</b> Risk categories, impact assessments, and governance structures are directly aligned with international enterprise risk standards.",
        body_style
    ))

    # Core Use Cases Table
    usecase_data = [
        [
            Paragraph("Enterprise Application", table_header_style),
            Paragraph("Strategic Business Context", table_header_style),
            Paragraph("LOKI Simulation Outcome", table_header_style)
        ],
        [
            Paragraph("Pricing & Packaging Restructure", table_cell_bold),
            Paragraph("SaaS migration from seat-based to consumption pricing.", table_cell_style),
            Paragraph("Detects exact churn threshold and identifies price-sensitive client tiers.", table_cell_style)
        ],
        [
            Paragraph("M&A Tech Integration", table_cell_bold),
            Paragraph("Consolidation of overlapping engineering and product suites.", table_cell_style),
            Paragraph("Surfaces cultural and operational friction across technical leads.", table_cell_style)
        ],
        [
            Paragraph("Regulatory Disclosures", table_cell_bold),
            Paragraph("Publishing mandated privacy, environmental, or AI disclosures.", table_cell_style),
            Paragraph("Tests scrutiny from trade watchdogs and competitor legal departments.", table_cell_style)
        ],
        [
            Paragraph("Crisis Communication", table_cell_bold),
            Paragraph("Pre-testing press statements following security incidents.", table_cell_style),
            Paragraph("Predicts media amplification and community skepticism before release.", table_cell_style)
        ]
    ]
    t_use = Table(usecase_data, colWidths=[120, 205, 215])
    t_use.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.75, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F0F0F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_use)
    story.append(Spacer(1, 4))

    story.append(Paragraph("8.3 Deployment Architecture & Formal Sign-Off", h2_style))
    story.append(Paragraph(
        "LOKI is packaged as a dual-tier architecture: a <b>FastAPI (Python 3.14/3.11)</b> asynchronous backend integrated with PostgreSQL (with automatic connection pool failover) and SQLite dev mode, alongside a modern <b>Next.js 16 (React 19, TypeScript)</b> analytical control center. Deployable in customer Virtual Private Clouds (VPC) via Docker containers or managed Kubernetes environments.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # Formal Sign-off Box
    signoff_data = [
        [
            Paragraph(
                "<b>DOCUMENT CERTIFICATION & GOVERNANCE APPROVAL</b><br/>"
                "This document specifies the technical and operational architecture of the LOKI Autonomous Swarm Intelligence Platform. All algorithms, mathematical risk scoring models, GraphRAG topologies, and simulation dynamics described herein have been verified for production readiness.<br/>"
                "<b>Author:</b> Antigravity DeepMind Engineering & SwarmLens Systems Team · <b>Classification:</b> Enterprise Confidential",
                callout_text
            )
        ]
    ]
    t_sign = Table(signoff_data, colWidths=[540])
    t_sign.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.black),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8F8F8")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t_sign)

    # Build the PDF using NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"LOKI Specification PDF generated successfully: {output_filename}")

if __name__ == "__main__":
    out_path = "LOKI_Product_Specification.pdf"
    create_loki_specification_pdf(out_path)

