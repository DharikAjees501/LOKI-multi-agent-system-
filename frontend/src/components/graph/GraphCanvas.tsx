"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { GraphNode, GraphEdge, Agent, ChannelId } from "@/types";
import {
  ZoomIn,
  ZoomOut,
  Expand,
  Minimize2,
  MessageSquare,
  Move,
  RotateCcw,
  X,
  Search,
} from "lucide-react";

import { forceCollide } from "d3-force";

// Dynamically import ForceGraph2D to prevent Next.js SSR canvas issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelectNode?: (node: GraphNode) => void;
  onInterrogateAgent?: (agent: Agent) => void;
  title?: string;
  subtitle?: string;
  scenarioId?: string;
}

const TIER_NAMES: Record<number, string> = {
  0: "T0 · System",
  1: "T1 · Boardroom",
  2: "T2 · Regulators",
  3: "T3 · Media & Rivals",
  4: "T4 · Public Market",
};

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes,
  edges,
  onSelectNode,
  onInterrogateAgent,
  title = "AGENT OPERATIONAL SWARM",
  subtitle = "200 active personas · 5-Tier Orbital Directional View",
}) => {
  const fgRef = useRef<any>(null);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [filterMode, setFilterMode] = useState<"SPOTLIGHT" | "SUBGRAPH">("SPOTLIGHT");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerDimensions, setContainerDimensions] = useState({ width: 1200, height: 650 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Measure container dimensions for responsive canvas sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth || 1200,
          height: containerRef.current.clientHeight || 650,
        });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [isFullscreen]);

  useEffect(() => {
    if (nodes.length > 0 && !selectedNode) {
      setSelectedNode(nodes[0]);
    }
  }, [nodes]);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  const isSwarmGraph = useMemo(() => {
    return nodes.some((n) => n.type === "AGENT" || n.agentTier !== undefined);
  }, [nodes]);

  const filterOptions = useMemo(() => {
    return isSwarmGraph
      ? ["ALL", "T0 System", "T1 Boardroom", "T2 Regulators", "T3 Media", "T4 Public"]
      : ["ALL", ...Array.from(new Set(nodes.map((n) => n.entityCategory).filter(Boolean)))];
  }, [isSwarmGraph, nodes]);

  // Helper to test if a node matches the active tier/category filter
  const isNodeMatchingFilter = useCallback(
    (n: GraphNode) => {
      if (selectedFilter === "ALL") return true;
      if (isSwarmGraph) {
        if (selectedFilter.startsWith("T0")) return n.agentTier === 0;
        if (selectedFilter.startsWith("T1")) return n.agentTier === 1;
        if (selectedFilter.startsWith("T2")) return n.agentTier === 2;
        if (selectedFilter.startsWith("T3")) return n.agentTier === 3;
        if (selectedFilter.startsWith("T4")) return n.agentTier === 4;
      } else {
        return n.entityCategory === selectedFilter;
      }
      return true;
    },
    [selectedFilter, isSwarmGraph]
  );

  // Breathable force graph data construction with Spotlight & Subgraph modes
  const forceGraphData = useMemo(() => {
    // Search filtering
    const searchFiltered = nodes.filter((n) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        n.label.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        (n.entityCategory && n.entityCategory.toLowerCase().includes(q))
      );
    });

    // In SUBGRAPH mode, isolate to nodes matching filter; in SPOTLIGHT mode, keep all nodes
    const activeNodes =
      filterMode === "SUBGRAPH" && selectedFilter !== "ALL"
        ? searchFiltered.filter(isNodeMatchingFilter)
        : searchFiltered;

    const activeNodeIds = new Set(activeNodes.map((n) => n.id));

    // Target spotlight node IDs for edge highlighting
    const spotlightTargetIds = new Set(
      searchFiltered.filter(isNodeMatchingFilter).map((n) => n.id)
    );

    const validNodes = activeNodes.map((n) => {
      const isHub = Boolean(n.is_hub);
      const isMatching = isNodeMatchingFilter(n);
      const isDimmed = filterMode === "SPOTLIGHT" && selectedFilter !== "ALL" && !isMatching;

      return {
        ...n,
        is_hub: isHub,
        isDimmed,
        val: isHub ? 14 : 7,
        // Free physics from fixed locks so D3 simulation settles organically
        fx: undefined,
        fy: undefined,
      };
    });

    const validLinks = edges
      .filter((e) => {
        const sId = typeof e.source === "object" && e.source ? (e.source as any).id : e.source;
        const tId = typeof e.target === "object" && e.target ? (e.target as any).id : e.target;
        return activeNodeIds.has(sId) && activeNodeIds.has(tId);
      })
      .map((e) => {
        const sId = typeof e.source === "object" && e.source ? (e.source as any).id : e.source;
        const tId = typeof e.target === "object" && e.target ? (e.target as any).id : e.target;
        const isCrossTier = Boolean((e as any).isCrossTier || (e as any).is_cross_tier);
        const connectsSpotlight =
          selectedFilter !== "ALL" &&
          (spotlightTargetIds.has(sId) || spotlightTargetIds.has(tId));
        const isDimmed =
          filterMode === "SPOTLIGHT" &&
          selectedFilter !== "ALL" &&
          !connectsSpotlight;

        return {
          id: e.id,
          source: sId,
          target: tId,
          relationship: e.relationship || "CONNECTS",
          strength: e.strength || 3,
          isCrossTier,
          is_cross_tier: isCrossTier,
          isHighlighted: connectsSpotlight,
          isDimmed,
        };
      });

    return {
      nodes: validNodes,
      links: validLinks,
    };
  }, [nodes, edges, searchQuery, selectedFilter, filterMode, isNodeMatchingFilter]);

  // D3 Force Physics Calibration (Zero Overlap & Breathable Layout)
  useEffect(() => {
    if (!fgRef.current) return;
    // Strong repulsion so nodes spread out cleanly across canvas
    fgRef.current.d3Force("charge")?.strength(-380).distanceMax(600);
    // Longer link distances so edges are clearly visible between nodes
    fgRef.current.d3Force("link")?.distance((link: any) =>
      link.isCrossTier || link.is_cross_tier ? 160 : 65
    );
    // Strict collision radius so two nodes NEVER overlap
    fgRef.current.d3Force(
      "collide",
      forceCollide((node: any) => (node.is_hub ? 22 : 13)).iterations(3)
    );
    // Reheat simulation so physics arranges nodes organically
    fgRef.current.d3ReheatSimulation();
    const timer = setTimeout(() => {
      fgRef.current?.zoomToFit(500, filterMode === "SUBGRAPH" ? 80 : 60);
    }, 450);
    return () => clearTimeout(timer);
  }, [forceGraphData, filterMode]);

  // Color mapping based on live simulation stance & alerts
  const getNodeColor = useCallback((node: any) => {
    const stance = node.stanceAxis !== undefined ? node.stanceAxis : (node.stance !== undefined ? node.stance : 0.0);
    if (stance < -0.4 || node.state === "ALERT") return "#EF4444"; // Strong Opposition (Crimson)
    if (stance < 0.0) return "#F59E0B";  // Skeptical / Friction (Amber)
    if (stance > 0.3) return "#10B981";  // Aligned Champion (Emerald)
    return "#0284C7";                    // Neutral / Pragmatic (Vibrant Blue)
  }, []);

  const getAgentForNode = useCallback((node: GraphNode): Agent => {
    const numId = Number(node.id.replace("agent-", "")) || 1;
    const tier = (node.agentTier !== undefined ? node.agentTier : 1) as Agent["tier"];
    const tierName = (
      tier === 0
        ? "TIER 0 · ORCHESTRATION & SYSTEM"
        : tier === 1
        ? "TIER 1 · BOARDROOM & EXECUTIVE LEADERSHIP"
        : tier === 2
        ? "TIER 2 · INSTITUTIONAL & REGULATORY WATCHDOGS"
        : tier === 3
        ? "TIER 3 · MEDIA, AMPLIFIERS & PUBLIC CRITICS"
        : "TIER 4 · BROAD MARKET & CONSUMER POPULATION"
    ) as Agent["tierName"];

    return {
      id: node.id,
      numberId: numId,
      name: node.label,
      role: node.label,
      tier,
      tierName,
      riskThreshold: 35,
      bias: "Strategic Alignment & Governance",
      currentState: node.state || "ACTIVE",
      currentChannel: (tier <= 1 ? "BOARDROOM" : tier <= 3 ? "MEDIA" : "PUBLIC") as ChannelId,
      currentPosition: `Stance: ${node.stanceAxis || -0.25}`,
      sentiment: (node.stanceAxis && node.stanceAxis <= -0.5) ? "CRITICAL" : (node.stanceAxis && node.stanceAxis < 0.0) ? "NEGATIVE" : "NEUTRAL",
      confidence: 88,
      metrics: {
        postsCount: 14,
        influenceScore: 82,
        agreementRate: 64,
      },
    };
  }, []);

  // Center camera & zoom on node click
  const handleNodeClick = useCallback(
    (node: any) => {
      setSelectedNode(node);
      if (onSelectNode) onSelectNode(node);

      if (fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 600);
        fgRef.current.zoom(2.0, 600);
      }
    },
    [onSelectNode]
  );

  const handleResetCamera = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(500, filterMode === "SUBGRAPH" ? 80 : 60);
    }
  }, [filterMode]);

  // Custom Canvas Rendering: Dynamic Node Sizing, Spotlight Halo & Clean Pill Badges
  const drawNodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isHub = Boolean(node.is_hub);
      // Dynamic Node Sizing: Cluster Hubs = 14px radius, Regular Agents = 7px radius
      const size = isHub ? 14 : 7;
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNodeId === node.id;
      const isDimmed = Boolean(node.isDimmed);
      const stance = node.stanceAxis !== undefined ? node.stanceAxis : (node.stance !== undefined ? node.stance : 0.0);
      const isAlert = node.state === "ALERT" || stance <= -0.35;

      let baseColor = getNodeColor(node);
      if (isDimmed) {
        baseColor = "#CBD5E1"; // 15% opacity non-selected dimmed appearance
      }

      // 1. Outer Halo Ring for Hubs, Selected, Hovered, or ALERT Node
      if (!isDimmed && (isSelected || isHovered || isAlert || isHub)) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + (isHub ? 7 : 5), 0, 2 * Math.PI, false);
        ctx.fillStyle = isAlert
          ? "rgba(239, 68, 68, 0.28)"
          : isSelected || isHovered
          ? "rgba(2, 132, 199, 0.32)"
          : "rgba(14, 165, 233, 0.18)";
        ctx.fill();
      }

      // 2. Core Node Circle (Crisp & Perfectly Sized)
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
      ctx.fillStyle = isDimmed ? "rgba(203, 213, 225, 0.4)" : baseColor;
      ctx.fill();

      // Sharp stroke border
      ctx.strokeStyle = isDimmed
        ? "rgba(148, 163, 184, 0.35)"
        : isSelected
        ? "#0284C7"
        : isHub
        ? "#0F172A"
        : "#FFFFFF";
      ctx.lineWidth = (isHub ? 2.2 : isSelected ? 2.0 : 1.2) / globalScale;
      ctx.stroke();

      // 3. Crisp Agent Number Badge inside Hub Nodes (A01, A03, etc.)
      if (!isDimmed && isHub) {
        const numMatches = String(node.id).match(/\d+/g);
        const cleanNum = numMatches ? numMatches[numMatches.length - 1] : "1";
        const badgeStr = `A${String(cleanNum).padStart(2, "0")}`;
        const badgeFontSize = 8.5 / globalScale;
        ctx.font = `bold ${badgeFontSize}px "IBM Plex Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(badgeStr, node.x, node.y);
      }

      // 4. Clean Label Rendering:
      // Only draw text labels inside/below a node when:
      // - node.is_hub === true, OR
      // - globalScale > 1.4, OR
      // - node.id === hoveredNode?.id || node.id === selectedNode?.id.
      if (isHovered || isSelected) {
        // Crisp Pill Badge with white background and dark border for hovered/selected nodes
        const labelText = node.label || node.id;
        const fontSize = Math.max(10.5, 12 / globalScale);
        ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;
        const textWidth = ctx.measureText(labelText).width;
        const padX = 8;
        const padY = 4;
        const pillW = textWidth + padX * 2;
        const pillH = fontSize + padY * 2;
        const pillX = node.x - pillW / 2;
        const pillY = node.y + size + 5;
        const cornerR = 6;

        ctx.beginPath();
        if (typeof (ctx as any).roundRect === "function") {
          (ctx as any).roundRect(pillX, pillY, pillW, pillH, cornerR);
        } else {
          ctx.rect(pillX, pillY, pillW, pillH);
        }
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.strokeStyle = "#0F172A";
        ctx.lineWidth = 1.4 / globalScale;
        ctx.stroke();

        ctx.fillStyle = "#0F172A";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, node.x, pillY + pillH / 2);
      } else if (!isDimmed && (isHub || globalScale > 1.4)) {
        // Subtle role label below Hubs or when zoomed in
        const rawRole = (node.role || node.label.replace(/^A\d+\s+/, "") || node.label);
        const shortRole = rawRole.length > 22 ? rawRole.slice(0, 20) + "…" : rawRole;
        const fontSize = (isHub ? 9.5 : 8.5) / globalScale;
        ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHub ? "#0F172A" : "#475569";
        ctx.fillText(shortRole, node.x, node.y + size + 3);
      }
    },
    [getNodeColor, selectedNode, hoveredNodeId]
  );

  return (
    <div
      ref={containerRef}
      className={`select-none overflow-hidden flex flex-col transition-all duration-300 ${
        isFullscreen
          ? "fixed inset-0 z-50 w-screen h-screen bg-white"
          : "relative w-full h-[650px] min-h-[580px] rounded-card border border-line shadow-sm bg-white"
      }`}
    >
      {/* Header Controls Overlay */}
      <div className="absolute top-4 left-4 right-4 z-30 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        {/* Title Badge */}
        {title ? (
          <div className="bg-white/95 backdrop-blur-md border border-line rounded-2xl p-3 flex items-center gap-4 shadow-md text-ink">
            <div>
              <h3 className="font-display text-sm font-bold tracking-tight text-ink flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                {title}
              </h3>
              {subtitle ? (
                <p className="text-[11px] font-mono text-muted flex items-center gap-2">
                  <span>{subtitle}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-accent font-semibold bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                    <Move className="h-3 w-3" /> Hover Agent for Details
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Filter Pills, Mode Switcher & Search */}
        <div className="hidden lg:flex items-center gap-2 bg-white/95 backdrop-blur-md border border-line rounded-2xl p-1.5 shadow-md">
          {/* Spotlight vs Subgraph Mode Switcher */}
          <div className="flex items-center gap-0.5 bg-raised/80 p-0.5 rounded-xl border border-line">
            <button
              onClick={() => {
                setFilterMode("SPOTLIGHT");
                setTimeout(() => fgRef.current?.zoomToFit(500, 60), 50);
              }}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                filterMode === "SPOTLIGHT"
                  ? "bg-accent text-white shadow-xs"
                  : "text-muted hover:text-ink hover:bg-line/40"
              }`}
              title="Neo4j Bloom Spotlight: Highlight focused tier with stance halos while keeping macro network visible"
            >
              Spotlight
            </button>
            <button
              onClick={() => {
                setFilterMode("SUBGRAPH");
                setTimeout(() => fgRef.current?.zoomToFit(500, 80), 50);
              }}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                filterMode === "SUBGRAPH"
                  ? "bg-accent text-white shadow-xs"
                  : "text-muted hover:text-ink hover:bg-line/40"
              }`}
              title="Connected Subgraph: Isolate the tier into a tight, fully connected network"
            >
              Subgraph
            </button>
          </div>

          <div className="h-4 w-[1px] bg-line" />

          <div className="relative flex items-center pl-2 pr-1">
            <Search className="h-3.5 w-3.5 text-muted mr-1.5" />
            <input
              type="text"
              placeholder="Search agent / node..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-ink placeholder:text-muted focus:outline-none w-36 font-mono"
            />
          </div>

          <div className="h-4 w-[1px] bg-line" />

          <div className="flex items-center gap-1 overflow-x-auto max-w-lg">
            {filterOptions.map((opt) => (
              <button
                key={String(opt)}
                onClick={() => {
                  setSelectedFilter(String(opt));
                  setTimeout(() => {
                    fgRef.current?.d3ReheatSimulation();
                    fgRef.current?.zoomToFit(500, filterMode === "SUBGRAPH" ? 80 : 60);
                  }, 50);
                }}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-semibold transition-all ${
                  selectedFilter === opt
                    ? "bg-accent text-white shadow-xs"
                    : "bg-raised text-muted hover:text-ink hover:bg-line"
                }`}
              >
                {String(opt)}
              </button>
            ))}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-line rounded-xl p-1 shadow-md">
          <button
            onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.3, 300)}
            className="h-8 w-8 rounded-lg bg-raised flex items-center justify-center text-ink hover:bg-line transition-all"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.3, 300)}
            className="h-8 w-8 rounded-lg bg-raised flex items-center justify-center text-ink hover:bg-line transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={handleResetCamera}
            className="h-8 w-8 rounded-lg bg-raised flex items-center justify-center text-ink hover:bg-line transition-all"
            title="Reset Camera & Fit View"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="h-8 w-8 rounded-lg bg-accent text-white flex items-center justify-center hover:opacity-90 transition-all shadow-md"
            title={isFullscreen ? "Exit Fullscreen" : "Expand Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Hardware-Accelerated 60 FPS Viewport (100% Solid Pure White Background) */}
      <div className="w-full h-full flex-1 relative bg-white overflow-hidden">
        <ForceGraph2D
          ref={fgRef}
          width={containerDimensions.width}
          height={containerDimensions.height}
          graphData={forceGraphData}
          nodeId="id"
          nodeLabel={() => ""} // Disabled native HTML tooltip to prevent double labels
          nodeCanvasObject={drawNodeCanvasObject}
          nodePointerAreaPaint={(node: any, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, (node.is_hub ? 14 : 7) + 6, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
          // Curved edges (0.18) so parallel / bidirectional lines curve gracefully
          linkCurvature={0.18}
          // Dynamic edge width
          linkWidth={(link: any) =>
            link.isHighlighted || (selectedNode && (link.source?.id === selectedNode.id || link.target?.id === selectedNode.id))
              ? 2.2
              : 1.1
          }
          // Highly visible high-contrast graph edge lines with spotlight dimming
          linkColor={(link: any) => {
            const isSel = selectedNode && (link.source?.id === selectedNode.id || link.target?.id === selectedNode.id);
            if (isSel) return "#0284C7";
            if (link.isHighlighted) return "#0EA5E9";
            if (link.isDimmed) return "rgba(226, 232, 240, 0.4)";
            return link.isCrossTier || link.is_cross_tier ? "#64748B" : "#94A3B8";
          }}
          // Directional arrowhead markers (6.5px length) pointing Source -> Target agent
          linkDirectionalArrowLength={6.5}
          linkDirectionalArrowRelPos={0.88}
          linkDirectionalArrowColor={(link: any) => {
            const isSel = selectedNode && (link.source?.id === selectedNode.id || link.target?.id === selectedNode.id);
            if (isSel) return "#0284C7";
            if (link.isHighlighted) return "#0EA5E9";
            if (link.isDimmed) return "rgba(226, 232, 240, 0.3)";
            return link.isCrossTier || link.is_cross_tier ? "#64748B" : "#94A3B8";
          }}
          // MiroFish style animated directional particles
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.004}
          linkDirectionalParticleWidth={(link: any) => (link.isHighlighted ? 2.8 : 1.8)}
          linkDirectionalParticleColor={(link: any) => (link.isHighlighted ? "#0284C7" : "rgba(37, 99, 235, 0.65)")}
          onNodeClick={handleNodeClick}
          onNodeHover={(node: any) => setHoveredNodeId(node ? node.id : null)}
          cooldownTicks={140}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      </div>

      {/* Selected Node Detail & Interrogation Drawer */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 z-30 bg-white/95 backdrop-blur-md border border-line rounded-2xl p-4 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-ink pointer-events-auto animate-in slide-in-from-bottom duration-200">
          <div className="flex items-start md:items-center gap-4">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center font-mono font-bold text-white text-sm shrink-0 shadow-md"
              style={{ backgroundColor: getNodeColor(selectedNode) }}
            >
              {selectedNode.agentTier !== undefined
                ? `A${String(selectedNode.id.replace("agent-", "")).padStart(2, "0")}`
                : selectedNode.entityCategory?.charAt(0) || selectedNode.label.charAt(0)}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-display text-sm font-bold text-ink">{selectedNode.label}</h4>
                {selectedNode.agentTier !== undefined ? (
                  <span
                    className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase"
                    style={{
                      backgroundColor: `${getNodeColor(selectedNode)}20`,
                      color: getNodeColor(selectedNode),
                      border: `1px solid ${getNodeColor(selectedNode)}40`,
                    }}
                  >
                    {TIER_NAMES[selectedNode.agentTier] || `Tier ${selectedNode.agentTier}`}
                  </span>
                ) : selectedNode.entityCategory ? (
                  <span
                    className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase"
                    style={{
                      backgroundColor: `${getNodeColor(selectedNode)}20`,
                      color: getNodeColor(selectedNode),
                      border: `1px solid ${getNodeColor(selectedNode)}40`,
                    }}
                  >
                    {selectedNode.entityCategory}
                  </span>
                ) : null}
              </div>

              <p className="text-xs text-muted font-mono">
                {selectedNode.agentTier !== undefined
                  ? `Agent ID: ${selectedNode.id} · State: ${selectedNode.state || "ACTIVE"}`
                  : `Entity ID: ${selectedNode.id}`}
                {" · "}
                <span className="text-accent font-semibold">
                  {(() => {
                    const connected = edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id);
                    if (connected.length === 0) return "Independent Node";
                    return `Connects ${connected.length} Nodes`;
                  })()}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onInterrogateAgent && (
              <button
                onClick={() => {
                  const agent = getAgentForNode(selectedNode);
                  onInterrogateAgent(agent);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 transition-all shadow-md shadow-accent/20"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Interrogate Agent 1-on-1</span>
              </button>
            )}

            <button
              onClick={() => setSelectedNode(null)}
              className="h-8 w-8 rounded-xl bg-raised border border-line flex items-center justify-center text-muted hover:text-ink hover:bg-line transition-all"
              title="Close Drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
