import React, { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { DependencyEdge, DependencyNode } from "../../types/orbit";
import { IconButton } from "../ui/primitives";

interface DependencyGraphProps {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  height?: number;
}

export function DependencyGraph({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  height = 380,
}: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [themeRevision, setThemeRevision] = useState(0);

  // Re-sync Cytoscape styles whenever data-theme toggles between Obsidian Black and Gallery White
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeRevision((rev) => rev + 1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue("--orbit-text-primary").trim() || "#FAFAFA";
    const surfaceElevated = styles.getPropertyValue("--orbit-surface-elevated").trim() || "#141417";
    const borderColor = styles.getPropertyValue("--orbit-border").trim() || "#27272B";
    const primary = styles.getPropertyValue("--orbit-primary").trim() || "#FAFAFA";
    const series2 = styles.getPropertyValue("--orbit-series-2").trim() || "#7DA0C4";
    const success = styles.getPropertyValue("--orbit-success").trim() || "#5EA885";
    const warning = styles.getPropertyValue("--orbit-warning").trim() || "#CFA052";
    const secondary = styles.getPropertyValue("--orbit-text-secondary").trim() || "#A1A1AA";
    const muted = styles.getPropertyValue("--orbit-text-muted").trim() || "#71717A";

    const elements: cytoscape.ElementDefinition[] = [
      ...nodes.map((n) => ({
        data: { id: n.id, label: n.label, kind: n.kind },
      })),
      ...edges.map((e, idx) => ({
        data: {
          id: `edge_${idx}_${e.source}_${e.target}`,
          source: e.source,
          target: e.target,
          relation: e.relation,
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            color: textColor,
            "font-size": "12px",
            "font-family": "DM Sans, sans-serif",
            "text-valign": "bottom",
            "text-margin-y": 6,
            "text-max-width": "120px",
            "text-wrap": "wrap",
            "background-color": surfaceElevated,
            "border-width": 1.5,
            "border-color": borderColor,
            width: 34,
            height: 34,
          },
        },
        {
          selector: 'node[kind = "stock"]',
          style: {
            shape: "round-rectangle",
            width: 56,
            height: 34,
            "border-color": primary,
            "border-width": 2,
          },
        },
        {
          selector: 'node[kind = "flow"]',
          style: {
            shape: "diamond",
            width: 38,
            height: 38,
            "border-color": series2,
          },
        },
        {
          selector: 'node[kind = "parameter"]',
          style: {
            shape: "round-hexagon",
            width: 32,
            height: 32,
            "border-color": muted,
          },
        },
        {
          selector: 'node[kind = "auxiliary"]',
          style: {
            shape: "ellipse",
            width: 34,
            height: 34,
            "border-color": secondary,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": primary,
            "border-width": 2.5,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": borderColor,
            "target-arrow-color": muted,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 0.85,
          },
        },
        {
          selector: 'edge[relation = "inflow"]',
          style: {
            width: 2,
            "line-color": success,
            "target-arrow-color": success,
          },
        },
        {
          selector: 'edge[relation = "outflow"]',
          style: {
            width: 2,
            "line-color": warning,
            "target-arrow-color": warning,
          },
        },
        {
          selector: 'edge[relation = "depends"]',
          style: {
            "line-style": "dashed",
            "line-dash-pattern": [4, 4],
            "line-color": muted,
            "target-arrow-color": muted,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        padding: 32,
        nodeRepulsion: () => 5400,
        idealEdgeLength: () => 98,
      },
      minZoom: 0.35,
      maxZoom: 2.2,
    });

    cy.on("tap", "node", (evt) => {
      onSelectNode?.(evt.target.id());
    });

    cyRef.current = cy;

    // Attach ResizeObserver to keep canvas and viewport synchronized when sidebars or panels toggle
    const container = containerRef.current;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (!cyRef.current || cyRef.current.destroyed()) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (cyRef.current && !cyRef.current.destroyed()) {
          cyRef.current.resize();
          cyRef.current.fit(undefined, 28);
        }
      }, 50);
    });

    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [nodes, edges, onSelectNode, themeRevision]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().unselect();
    if (selectedNodeId) {
      cy.getElementById(selectedNodeId).select();
    }
  }, [selectedNodeId]);

  const zoom = (factor: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({
      level: cy.zoom() * factor,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    });
  };

  return (
    <div className="rounded-[var(--orbit-radius-lg)] border border-[var(--orbit-border-subtle)] bg-[var(--orbit-surface-inset)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-[var(--orbit-border-subtle)] text-sm text-[var(--orbit-text-secondary)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-[var(--orbit-text-primary)]">Stock (Rect)</span>
          <span aria-hidden="true">&middot;</span>
          <span className="font-medium text-[var(--orbit-series-2)]">Flow (Diamond)</span>
          <span aria-hidden="true">&middot;</span>
          <span>Auxiliary (Circle)</span>
          <span aria-hidden="true">&middot;</span>
          <span>Parameter (Hex)</span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Zoom in graph" onClick={() => zoom(1.2)}>
            <ZoomIn className="w-4 h-4" />
          </IconButton>
          <IconButton label="Zoom out graph" onClick={() => zoom(0.82)}>
            <ZoomOut className="w-4 h-4" />
          </IconButton>
          <IconButton label="Fit graph to view" onClick={() => cyRef.current?.fit(undefined, 28)}>
            <Maximize2 className="w-4 h-4" />
          </IconButton>
        </div>
      </div>
      <div
        ref={containerRef}
        style={{ height: `${height}px` }}
        className="w-full cursor-grab active:cursor-grabbing"
        aria-label="Interactive stock-and-flow dependency graph"
      />
    </div>
  );
}
