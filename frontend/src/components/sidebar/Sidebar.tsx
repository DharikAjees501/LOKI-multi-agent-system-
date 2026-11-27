"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Waypoints,
  Rss,
  ShieldAlert,
  Users,
  FolderGit2,
  FileSpreadsheet,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface SidebarProps {
  currentRound: number;
  totalRounds: number;
  simulationStatus: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onOpenUpload: () => void;
}

// Persistent sidebar state & scroll position across route transitions
let globalSidebarCollapsed = false;
let globalSidebarScrollTop = 0;

export const Sidebar: React.FC<SidebarProps> = ({
  currentRound,
  totalRounds,
  simulationStatus,
  onPlay,
  onPause,
  onStep,
  onReset,
  onOpenUpload,
}) => {
  const pathname = usePathname();
  const asideRef = useRef<HTMLElement>(null);

  const [isCollapsed, setIsCollapsedState] = useState<boolean>(globalSidebarCollapsed);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("swarmlens_sidebar_collapsed");
      if (saved !== null) {
        const isSavedCollapsed = saved === "true";
        setIsCollapsedState(isSavedCollapsed);
        globalSidebarCollapsed = isSavedCollapsed;
      }
    }
  }, []);

  useEffect(() => {
    // Restore sidebar scroll position after route transition
    if (asideRef.current) {
      asideRef.current.scrollTop = globalSidebarScrollTop;
    }
  }, [pathname]);

  const handleSidebarScroll = () => {
    if (asideRef.current) {
      globalSidebarScrollTop = asideRef.current.scrollTop;
    }
  };

  const handleToggleCollapse = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsCollapsedState((prev) => {
      const nextVal = !prev;
      globalSidebarCollapsed = nextVal;
      if (typeof window !== "undefined") {
        localStorage.setItem("swarmlens_sidebar_collapsed", String(nextVal));
      }
      return nextVal;
    });
  };

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Simulation Workspace", href: "/simulation", icon: Waypoints },
    { name: "Live Swarm Feed", href: "/feed", icon: Rss },
    { name: "Risk Synthesis", href: "/risk", icon: ShieldAlert, alert: true },
    { name: "Agents", href: "/agents", icon: Users, badge: "200" },
    { name: "Scenarios", href: "/scenarios", icon: FolderGit2 },
    { name: "Reports", href: "/reports", icon: FileSpreadsheet },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside
      ref={asideRef}
      onScroll={handleSidebarScroll}
      suppressHydrationWarning
      className={`bg-surface/90 backdrop-blur-xl border-r border-line flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto select-none transition-all duration-200 z-30 shadow-sm ${
        isCollapsed ? "w-20" : "w-72"
      }`}
    >
      {/* Top Brand Logo & Toggle Header */}
      <div
        suppressHydrationWarning
        className={`h-16 px-4 border-b border-line flex items-center shrink-0 ${
          isCollapsed ? "justify-center px-2" : "justify-between"
        }`}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-teal-500/5 border border-emerald-500/30 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
              <Waypoints className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-base font-bold tracking-tight text-ink flex items-center gap-2 truncate">
                LOKI
              </h1>
              <p className="text-[9px] font-mono tracking-widest text-emerald-600 dark:text-emerald-400 uppercase font-semibold truncate">
                L.O.K.I. INTELLIGENCE
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleToggleCollapse}
          className="h-9 w-9 rounded-xl bg-raised border border-line flex items-center justify-center text-muted hover:text-ink transition-all shrink-0 shadow-xs hover:bg-line/50"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <PanelLeftClose className="h-4 w-4 text-muted" />
          )}
        </button>
      </div>

      {/* Navigation Items List */}
      <div className="px-3 py-3 flex-1 space-y-1 overflow-x-hidden">
        {!isCollapsed && (
          <p className="px-3 pb-2 pt-1 text-[10px] font-mono uppercase text-muted/70 tracking-widest font-semibold">
            PLATFORM MODULES
          </p>
        )}
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <div key={item.href} className="relative">
              <Link
                href={item.href}
                scroll={false}
                title={isCollapsed ? item.name : undefined}
                className={`group relative flex items-center ${
                  isCollapsed ? "justify-center py-2.5 px-0" : "justify-between px-3 py-2.5"
                } rounded-xl text-xs font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 text-white font-semibold shadow-md shadow-emerald-600/20 border border-emerald-400/30"
                    : "text-ink/70 hover:text-ink hover:bg-raised/80 border border-transparent"
                }`}
              >
                <div className="relative z-10 flex items-center gap-3 min-w-0 justify-center">
                  <Icon
                    className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                      isActive ? "text-white" : "text-muted group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </div>

                {!isCollapsed && (
                  <div className="relative z-10 flex items-center gap-1.5">
                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full transition-colors ${
                          isActive
                            ? "bg-white/20 text-white font-semibold"
                            : "bg-raised text-muted border border-line shadow-2xs group-hover:border-emerald-500/30 group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.alert && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    )}
                  </div>
                )}
              </Link>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
