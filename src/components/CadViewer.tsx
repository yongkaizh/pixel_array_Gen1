import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LayoutConfig, RowConfig } from '../types';
import { Grid, HelpCircle, Eye, EyeOff, ZoomIn, ZoomOut, Maximize, Move, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Map, Download } from 'lucide-react';
import { getRowCategory } from '../utils';

const PALETTE = [
  { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#059669', text: '#047857' }, // Emerald
  { fill: 'rgba(59, 130, 246, 0.15)', stroke: '#2563eb', text: '#1d4ed8' }, // Blue
  { fill: 'rgba(245, 158, 11, 0.15)', stroke: '#d97706', text: '#b45309' }, // Amber
  { fill: 'rgba(236, 72, 153, 0.15)', stroke: '#db2777', text: '#be185d' }, // Pink
  { fill: 'rgba(168, 85, 247, 0.15)', stroke: '#9333ea', text: '#7e22ce' }, // Purple
  { fill: 'rgba(20, 184, 166, 0.15)', stroke: '#0d9488', text: '#0f766e' }, // Teal
  { fill: 'rgba(249, 115, 22, 0.15)', stroke: '#ea580c', text: '#c2410c' }, // Orange
  { fill: 'rgba(6, 182, 212, 0.15)', stroke: '#0891b2', text: '#0e7490' }, // Cyan
  { fill: 'rgba(99, 102, 241, 0.15)', stroke: '#4f46e5', text: '#4338ca' }, // Indigo
  { fill: 'rgba(239, 68, 68, 0.15)', stroke: '#dc2626', text: '#b91c1c' }, // Red
  { fill: 'rgba(132, 204, 22, 0.15)', stroke: '#65a30d', text: '#4d7c0f' }, // Lime
  { fill: 'rgba(234, 179, 8, 0.15)', stroke: '#ca8a04', text: '#a16207' }, // Yellow
  { fill: 'rgba(244, 63, 94, 0.15)', stroke: '#e11d48', text: '#be123c' }, // Rose
  { fill: 'rgba(14, 165, 233, 0.15)', stroke: '#0284c7', text: '#0369a1' }, // Sky
  { fill: 'rgba(148, 163, 184, 0.15)', stroke: '#475569', text: '#334155' }  // Slate (fallback/dummy)
];

// Generate a color map for all unique purposes
const usePurposeColors = (rows: RowConfig[], cell_map: Record<string, any>) => {
  return useMemo(() => {
    const map: Record<string, typeof PALETTE[0]> = {};
    const rowPurposes = rows.map(r => r.purpose.toLowerCase());
    const cellMapPurposes = Object.keys(cell_map).map(k => k.toLowerCase());
    
    const uniquePurposes = Array.from(new Set([...rowPurposes, ...cellMapPurposes]));
    
    uniquePurposes.forEach((purpose, idx) => {
      // Use Slate for dummy
      if (purpose.includes('dummy')) {
        map[purpose] = PALETTE[14];
      } else if (purpose.includes('active') || purpose === 'c1') {
        map[purpose] = PALETTE[0];
      } else {
        // Assign from palette, avoiding 0 and 14 if possible
        const colorIdx = (idx % 13) + 1; 
        map[purpose] = PALETTE[colorIdx];
      }
    });
    
    return map;
  }, [rows, cell_map]);
};

interface CadViewerProps {
  config: LayoutConfig;
}

export const CadViewer = React.memo(function CadViewer({ config }: CadViewerProps) {
  const [viewMode, setViewMode] = useState<'physical' | 'schematic'>('schematic');
  const [showSubgrid, setShowSubgrid] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [hoveredRowIdx, setHoveredRowIdx] = useState<number | null>(null);
  const [hoveredSegIdx, setHoveredSegIdx] = useState<number | null>(null);
  const [lockedRowIdx, setLockedRowIdx] = useState<number | null>(null);
  const [lockedSegIdx, setLockedSegIdx] = useState<number | null>(null);
  const [hoveredCoord, setHoveredCoord] = useState<{ x: number; y: number } | null>(null);
  
  // Viewport zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    rows,
    x_pitch,
    y_pitch,
    total_cols,
    rov_purpose,
    cell_map
  } = config;

  const purposeColors = usePurposeColors(rows, cell_map);

  // Generate dynamic legend items based on the actual config rows & cell specifications
  const legendItems = useMemo(() => {
    const map: Record<string, {
      label: string;
      bgStyle: string;
      borderStyle: string;
      cellNames: Set<string>;
    }> = {};

    // First populate from cell_map to get exact mappings from the excel sheet
    Object.keys(cell_map).forEach(key => {
      const p = key.toLowerCase();
      map[p] = {
        label: (cell_map[key].name || p).toUpperCase(),
        bgStyle: purposeColors[p]?.fill || 'rgba(148, 163, 184, 0.15)',
        borderStyle: purposeColors[p]?.stroke || '#475569',
        cellNames: new Set()
      };
      if (cell_map[key].cell) {
        map[p].cellNames.add(cell_map[key].cell);
      }
    });

    // Then ensure any unmapped rows are still present
    rows.forEach(row => {
      const p = row.purpose.toLowerCase();
      if (!map[p]) {
        map[p] = {
          label: (row.purpose).toUpperCase(),
          bgStyle: purposeColors[p]?.fill || 'rgba(148, 163, 184, 0.15)',
          borderStyle: purposeColors[p]?.stroke || '#475569',
          cellNames: new Set()
        };
      }
    });

    return Object.entries(map).map(([key, value]) => ({
      key,
      label: value.label,
      bgStyle: value.bgStyle,
      borderStyle: value.borderStyle,
      cellList: Array.from(value.cellNames)
    }));
  }, [rows, cell_map, purposeColors]);

  // Calculate layout coordinates
  const layout = useMemo(() => {
    const isSchematic = viewMode === 'schematic';
    const width = isSchematic ? 1400 : (total_cols * x_pitch);
    
    // 1. First pass: compute Y coordinates building upwards from Y=0
    // Reverse the rows array so the bottom-most row in the Excel template 
    // appears at the bottom of the canvas (Y=0 in Cartesian layout).
    const reversedRows = [...rows].reverse();
    let currentY = 0;
    
    const uniqueRowCounts = Array.from(new Set(reversedRows.map(r => r.rows))).sort((a, b) => a - b);
    const numCategories = uniqueRowCounts.length;
    
    const getSchematicHeight = (rowsCount: number) => {
      const rank = uniqueRowCounts.indexOf(rowsCount) + 1; // 1-based index
      let multiplier = rank;
      if (rank === numCategories && numCategories > 1) {
        multiplier = 2 * rank;
      }
      return 45 * multiplier; // 45px base height unit
    };
    
    const rowBlocksRaw = reversedRows.map((rowBlock, idx) => {
      const startY = currentY;
      const height = isSchematic ? getSchematicHeight(rowBlock.rows) : (rowBlock.rows * y_pitch);
      const endY = currentY + height;
      currentY = endY;

      return {
        ...rowBlock,
        startY,
        endY,
        height,
        originalIdx: rows.length - 1 - idx
      };
    });

    const totalHeight = currentY;

    // 2. Centering offsets - calculate true geometric center of active core C1/primary cell
    // X-axis: find left-padding columns before C1/primary segment
    let left_cols = 0;
    let active_cols = total_cols;
    const activeRowForX = rows.find(r => getRowCategory(r.purpose, r.name || '', rov_purpose) === 'active');
    if (activeRowForX && activeRowForX.segments && activeRowForX.segments.length > 0) {
      const activeSegIdx = activeRowForX.segments.findIndex(s => s.purpose.toLowerCase() === rov_purpose.toLowerCase() || getRowCategory(s.purpose, '', rov_purpose) === 'active');
      if (activeSegIdx !== -1) {
        for (let i = 0; i < activeSegIdx; i++) {
          left_cols += activeRowForX.segments[i].cols;
        }
        active_cols = activeRowForX.segments[activeSegIdx].cols;
      }
    }
    const cx = isSchematic ? width / 2 : (left_cols + active_cols / 2.0) * x_pitch;

    // Y-axis: find bottom rows below active core block
    let bottom_rows = 0;
    let active_rows = 0;
    let passedActive = false;
    const reversedRowsForY = [...rows].reverse();
    reversedRowsForY.forEach(r => {
      const isAct = getRowCategory(r.purpose, r.name || '', rov_purpose) === 'active';
      if (isAct) {
        active_rows += r.rows;
        passedActive = true;
      } else {
        if (!passedActive) {
          bottom_rows += r.rows;
        }
      }
    });
    const cy = isSchematic ? totalHeight / 2 : (bottom_rows + active_rows / 2.0) * y_pitch;

    // 3. Shift coordinates relative to the global center (shifted so global center is at 0, 0)
    const shiftedRowBlocks = rowBlocksRaw.map(block => {
      // In Cadence, Y=0 is bottom and increases upwards.
      // So distance from center is simply (block.startY + height/2) - cy
      
      const cadCenterY = block.startY + block.height / 2;
      const shiftedCenterY = cadCenterY - cy;
      
      const minY = shiftedCenterY - block.height / 2;
      const maxY = shiftedCenterY + block.height / 2;

      return {
        ...block,
        minX: -cx,
        maxX: width - cx,
        minY: minY,
        maxY: maxY,
        shiftedCenterY: shiftedCenterY
      };
    });

    return {
      width,
      totalHeight,
      centerX: cx,
      centerY: cy,
      blocks: shiftedRowBlocks,
      bounds: {
        minX: -cx,
        maxX: width - cx,
        minY: -cy,
        maxY: totalHeight - cy
      }
    };
  }, [rows, x_pitch, y_pitch, total_cols, rov_purpose, viewMode]);

  useEffect(() => {
    const el = containerRef.current;
    const preventScroll = (e: WheelEvent) => {
      e.preventDefault();
    };
    if (el) {
      el.addEventListener('wheel', preventScroll, { passive: false });
    }
    return () => {
      if (el) {
        el.removeEventListener('wheel', preventScroll);
      }
    };
  }, []);

  // Track dynamic dimensions of the SVG container
  const [dimensions, setDimensions] = useState({ width: 600, height: 450 });
  const [panSpeed, setPanSpeed] = useState<'slow' | 'fast'>('fast');
  const panIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: width || 600, height: height || 450 });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      if (panIntervalRef.current) clearInterval(panIntervalRef.current);
    };
  }, []);

  // Auto-reset view when pixel layout config changes (e.g. uploading a new Excel file)
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [rows, x_pitch, y_pitch, total_cols]);

  // Register keyboard controls for panning & zooming
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT' || 
        activeEl.hasAttribute('contenteditable')
      )) {
        return; // Don't interrupt form entries
      }

      const step = e.shiftKey ? 120 : 30; // Shift key multiplier for fast/slow panning

      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          e.preventDefault();
          setPan(p => ({ ...p, y: p.y + step }));
          break;
        case 'arrowdown':
        case 's':
          e.preventDefault();
          setPan(p => ({ ...p, y: p.y - step }));
          break;
        case 'arrowleft':
        case 'a':
          e.preventDefault();
          setPan(p => ({ ...p, x: p.x + step }));
          break;
        case 'arrowright':
        case 'd':
          e.preventDefault();
          setPan(p => ({ ...p, x: p.x - step }));
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomAboutFocalPoint(dimensions.width / 2, dimensions.height / 2, 1.25);
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomAboutFocalPoint(dimensions.width / 2, dimensions.height / 2, 1 / 1.25);
          break;
        case 'f':
        case 'r':
          e.preventDefault();
          handleReset();
          break;
        case 'g':
          e.preventDefault();
          setShowSubgrid(g => !g);
          break;
        case 'c':
          e.preventDefault();
          setShowCoordinates(c => !c);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dimensions]);

  // Center-point focal calculation similar to Cadence Virtuoso
  const zoomAboutFocalPoint = (fx: number, fy: number, ratio: number) => {
    setZoom(z => {
      const newZoom = Math.max(0.05, Math.min(z * ratio, 100));
      const actualRatio = newZoom / z;
      
      setPan(p => {
        // Distance of focal point from screen's center
        const dx = fx - dimensions.width / 2;
        const dy = fy - dimensions.height / 2;
        return {
          x: dx - (dx - p.x) * actualRatio,
          y: dy - (dy - p.y) * actualRatio
        };
      });
      
      return newZoom;
    });
  };

  // Handle zooming & panning
  const PAN_STEP = 50;
  const handlePanUp = () => setPan(p => ({ ...p, y: p.y + PAN_STEP }));
  const handlePanDown = () => setPan(p => ({ ...p, y: p.y - PAN_STEP }));
  const handlePanLeft = () => setPan(p => ({ ...p, x: p.x + PAN_STEP }));
  const handlePanRight = () => setPan(p => ({ ...p, x: p.x - PAN_STEP }));

  // Dynamic continuous panning
  const startContinuousPan = (dirX: number, dirY: number) => {
    if (panIntervalRef.current) clearInterval(panIntervalRef.current);
    
    const speedMultiplier = panSpeed === 'slow' ? 4 : 20;
    const dx = dirX * speedMultiplier;
    const dy = dirY * speedMultiplier;

    // Direct single step
    setPan(p => ({ x: p.x + dx, y: p.y + dy }));

    // Start interval
    panIntervalRef.current = setInterval(() => {
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    }, 40);
  };

  const stopContinuousPan = () => {
    if (panIntervalRef.current) {
      clearInterval(panIntervalRef.current);
      panIntervalRef.current = null;
    }
  };

  const handleZoomIn = () => {
    // Zoom centered about the viewport's center focal point
    zoomAboutFocalPoint(dimensions.width / 2, dimensions.height / 2, 1.5);
  };
  
  const handleZoomOut = () => {
    // Zoom centered about the viewport's center focal point
    zoomAboutFocalPoint(dimensions.width / 2, dimensions.height / 2, 1 / 1.5);
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomSensitivity = 0.002;
    const zoomDelta = Math.exp(-e.deltaY * zoomSensitivity);
    
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    zoomAboutFocalPoint(mouseX, mouseY, zoomDelta);
  };

  // Mouse drag pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Avoid interfering with HUD click overlays
    const target = e.target as HTMLElement;
    if (target.closest('.hud-overlay') || target.closest('button')) {
      return;
    }
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }

    // Capture physical layout coordinates from SVG workspace bounding rect
    if (svgRef.current && containerRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      // Relative cursor position in SVG box
      const rx = e.clientX - rect.left;
      const ry = e.clientY - rect.top;

      // Convert SVG pixel coordinate to layout coordinate
      const scale = (Math.min(dimensions.width, dimensions.height) * 0.7) / Math.max(layout.width, layout.totalHeight) * zoom;
      const centerX = dimensions.width / 2 + pan.x;
      const centerY = dimensions.height / 2 + pan.y;

      const physicalX = (rx - centerX) / scale;
      const physicalY = -(ry - centerY) / scale; // Invert SVG Y-axis to standard Cartesian layout
      
      setHoveredCoord({ x: physicalX, y: physicalY });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Purpose color lookup based on purpose and name pattern matching
  const getPurposeColor = (purpose: string, name: string) => {
    const p = purpose.toLowerCase();
    return purposeColors[p] || PALETTE[14];
  };

  // Dimensions of the display viewport
  const scaleRatio = (Math.min(dimensions.width, dimensions.height) * 0.7) / Math.max(layout.width, layout.totalHeight);
  const baseScale = scaleRatio * zoom;
  const isSchematic = viewMode === 'schematic';

  const appendLayoutSpecTable = (svgNode: SVGSVGElement) => {
    // 1. Calculate dimensions and scales
    const N = layout.blocks.length;
    const scaledMinX = layout.bounds.minX * baseScale;
    const scaledMaxX = layout.bounds.maxX * baseScale;
    const scaledMinY = layout.bounds.minY * baseScale;
    const scaledMaxY = layout.bounds.maxY * baseScale;

    const padding = Math.max(layout.width, layout.totalHeight) * baseScale * 0.05;
    const vbh = (scaledMaxY - scaledMinY) + padding * 2;

    const tableX = scaledMaxX + padding;
    const tableWidth = 680;
    // We want the table to have a minimum row height of 35px, so total height is at least N * 35
    const rowHeight = Math.max(35, (vbh - padding * 2) / N);
    const tableHeight = rowHeight * N;
    const tableYStart = -scaledMaxY;

    // We can wrap everything in an svg group <g id="layout-table-group">
    const tableGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    tableGroup.setAttribute("id", "layout-table-group");

    // Table outer border / background
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", String(tableX));
    bgRect.setAttribute("y", String(tableYStart - 70));
    bgRect.setAttribute("width", String(tableWidth));
    bgRect.setAttribute("height", String(tableHeight + 90));
    bgRect.setAttribute("fill", "#ffffff");
    bgRect.setAttribute("stroke", "#141414");
    bgRect.setAttribute("stroke-width", "3");
    tableGroup.appendChild(bgRect);

    // Header Title
    const titleText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    titleText.setAttribute("x", String(tableX + 20));
    titleText.setAttribute("y", String(tableYStart - 45));
    titleText.setAttribute("font-family", "sans-serif");
    titleText.setAttribute("font-weight", "900");
    titleText.setAttribute("font-size", "15");
    titleText.setAttribute("fill", "#141414");
    titleText.textContent = "SILICON PIXEL ARRAY SPECIFICATIONS & MAP FILE";
    tableGroup.appendChild(titleText);

    // Subheader metadata
    const subTitleText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    subTitleText.setAttribute("x", String(tableX + 20));
    subTitleText.setAttribute("y", String(tableYStart - 25));
    subTitleText.setAttribute("font-family", "monospace");
    subTitleText.setAttribute("font-size", "9.5");
    subTitleText.setAttribute("font-weight", "bold");
    subTitleText.setAttribute("fill", "#666666");
    const total_rows_count = rows.reduce((acc, r) => acc + r.rows, 0);
    subTitleText.textContent = `TOP CELL: ${config.top_cell.toUpperCase()}  |  TOP LIB: ${config.top_lib.toUpperCase()}  |  GRID: ${total_cols} cols x ${total_rows_count} rows  |  PITCH: ${x_pitch} x ${y_pitch} μm`;
    tableGroup.appendChild(subTitleText);

    // Table column headers background
    const headersBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    headersBg.setAttribute("x", String(tableX));
    headersBg.setAttribute("y", String(tableYStart - 10));
    headersBg.setAttribute("width", String(tableWidth));
    headersBg.setAttribute("height", "25");
    headersBg.setAttribute("fill", "#f3f4f6");
    headersBg.setAttribute("stroke", "#141414");
    headersBg.setAttribute("stroke-width", "1.5");
    tableGroup.appendChild(headersBg);

    // Table Column Headers Text
    const headers = [
      { text: "BLOCK NAME", x: 20 },
      { text: "PURPOSE", x: 150 },
      { text: "ROWS", x: 230 },
      { text: "HEIGHT/Y SPAN", x: 290 },
      { text: "CELL LAYOUT / SEGMENTS", x: 410 },
      { text: "ROT", x: 630 }
    ];

    headers.forEach(h => {
      const headerText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      headerText.setAttribute("x", String(tableX + h.x));
      headerText.setAttribute("y", String(tableYStart + 6));
      headerText.setAttribute("font-family", "sans-serif");
      headerText.setAttribute("font-weight", "800");
      headerText.setAttribute("font-size", "9");
      headerText.setAttribute("fill", "#141414");
      if (h.text === "ROT") {
        headerText.setAttribute("text-anchor", "middle");
      }
      headerText.textContent = h.text;
      tableGroup.appendChild(headerText);
    });

    // Draw rows from top to bottom (reverse order of layout.blocks)
    for (let i = 0; i < N; i++) {
      const bIdx = N - 1 - i;
      const block = layout.blocks[bIdx];
      const rowY = tableYStart + 15 + i * rowHeight;
      const rowCenterY = rowY + rowHeight / 2;

      const isRov = block.purpose.toLowerCase() === rov_purpose.toLowerCase();
      const isActive = getRowCategory(block.purpose, block.name || '', rov_purpose) === 'active';
      const colorInfo = getPurposeColor(block.purpose, block.name || '');

      // Row background rect
      const rowBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rowBg.setAttribute("x", String(tableX));
      rowBg.setAttribute("y", String(rowY));
      rowBg.setAttribute("width", String(tableWidth));
      rowBg.setAttribute("height", String(rowHeight));
      
      let fillCol = "#ffffff";
      if (isActive) {
        fillCol = "#f0fdf4"; // Very light green
      } else if (isRov) {
        fillCol = "#fffbeb"; // Very light amber
      } else if (i % 2 === 0) {
        fillCol = "#fafafa"; // Light grey
      }
      rowBg.setAttribute("fill", fillCol);
      rowBg.setAttribute("stroke", "#e5e7eb");
      rowBg.setAttribute("stroke-width", "1");
      tableGroup.appendChild(rowBg);

      // Color indicator box
      const colorBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      colorBox.setAttribute("x", String(tableX + 15));
      colorBox.setAttribute("y", String(rowCenterY - 6));
      colorBox.setAttribute("width", "10");
      colorBox.setAttribute("height", "10");
      colorBox.setAttribute("fill", colorInfo.fill);
      colorBox.setAttribute("stroke", colorInfo.stroke);
      colorBox.setAttribute("stroke-width", "1.5");
      tableGroup.appendChild(colorBox);

      // Block Name
      const nameText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      nameText.setAttribute("x", String(tableX + 32));
      nameText.setAttribute("y", String(rowCenterY + 3.5));
      nameText.setAttribute("font-family", "sans-serif");
      nameText.setAttribute("font-weight", "bold");
      nameText.setAttribute("font-size", "10");
      nameText.setAttribute("fill", "#141414");
      nameText.textContent = (block.name || block.purpose).toUpperCase();
      tableGroup.appendChild(nameText);

      // Purpose
      const purposeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      purposeText.setAttribute("x", String(tableX + 150));
      purposeText.setAttribute("y", String(rowCenterY + 3));
      purposeText.setAttribute("font-family", "monospace");
      purposeText.setAttribute("font-size", "9.5");
      purposeText.setAttribute("fill", "#4b5563");
      purposeText.textContent = block.purpose;
      tableGroup.appendChild(purposeText);

      // Rows count
      const rowsText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      rowsText.setAttribute("x", String(tableX + 230));
      rowsText.setAttribute("y", String(rowCenterY + 3.5));
      rowsText.setAttribute("font-family", "sans-serif");
      rowsText.setAttribute("font-weight", "bold");
      rowsText.setAttribute("font-size", "10");
      rowsText.setAttribute("fill", isRov ? "#b45309" : isActive ? "#047857" : "#111827");
      rowsText.textContent = `${block.rows} r`;
      tableGroup.appendChild(rowsText);

      // Height / Y Span
      const heightText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      heightText.setAttribute("x", String(tableX + 290));
      heightText.setAttribute("y", String(rowCenterY + 3));
      heightText.setAttribute("font-family", "monospace");
      heightText.setAttribute("font-size", "9");
      heightText.setAttribute("fill", "#374151");
      const blockHeight = block.rows * y_pitch;
      heightText.textContent = isSchematic 
        ? `${blockHeight.toFixed(1)} μm (sch)` 
        : `${blockHeight.toFixed(1)} μm [${block.minY.toFixed(1)}, ${block.maxY.toFixed(1)}]`;
      tableGroup.appendChild(heightText);

      // Cell layout / Segments description
      const cellText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      cellText.setAttribute("x", String(tableX + 410));
      cellText.setAttribute("y", String(rowCenterY + 3));
      cellText.setAttribute("font-family", "monospace");
      cellText.setAttribute("font-size", "8.5");
      cellText.setAttribute("fill", isActive ? "#047857" : "#111827");
      
      const cellInfo = cell_map[block.purpose.toLowerCase()];
      const hasSegments = block.segments && block.segments.length > 0;
      if (hasSegments) {
        cellText.textContent = block.segments!.map(s => `${s.purpose}:${s.cols}`).join(' | ');
        cellText.setAttribute("font-weight", "bold");
      } else {
        cellText.textContent = cellInfo?.cell || "Unknown";
      }
      tableGroup.appendChild(cellText);

      // Rotation
      const rotText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      rotText.setAttribute("x", String(tableX + 630));
      rotText.setAttribute("y", String(rowCenterY + 3));
      rotText.setAttribute("font-family", "monospace");
      rotText.setAttribute("font-size", "9.5");
      rotText.setAttribute("text-anchor", "middle");
      rotText.setAttribute("fill", "#4b5563");
      rotText.textContent = cellInfo?.rot || "R0";
      tableGroup.appendChild(rotText);

      // Connector dashed lines linking table rows back to physical block centers!
      const connectorLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      connectorLine.setAttribute("x1", String(scaledMaxX));
      // Invert Y coordinate back to SVG coordinate space
      connectorLine.setAttribute("y1", String(-block.shiftedCenterY * baseScale));
      connectorLine.setAttribute("x2", String(tableX));
      connectorLine.setAttribute("y2", String(rowCenterY));
      connectorLine.setAttribute("stroke", colorInfo.stroke);
      connectorLine.setAttribute("stroke-width", "1");
      connectorLine.setAttribute("stroke-dasharray", "3,3");
      connectorLine.setAttribute("opacity", "0.65");
      tableGroup.appendChild(connectorLine);
    }

    // Add a solid line separating the table entries at the bottom
    const bottomLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    bottomLine.setAttribute("x1", String(tableX));
    bottomLine.setAttribute("y1", String(tableYStart + 15 + tableHeight));
    bottomLine.setAttribute("x2", String(tableX + tableWidth));
    bottomLine.setAttribute("y2", String(tableYStart + 15 + tableHeight));
    bottomLine.setAttribute("stroke", "#141414");
    bottomLine.setAttribute("stroke-width", "2");
    tableGroup.appendChild(bottomLine);

    // Let's also add a nice metadata watermark at the bottom right of the table
    const watermarkText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    watermarkText.setAttribute("x", String(tableX + tableWidth - 15));
    watermarkText.setAttribute("y", String(tableYStart + tableHeight + 15));
    watermarkText.setAttribute("font-family", "sans-serif");
    watermarkText.setAttribute("font-size", "8");
    watermarkText.setAttribute("fill", "#9ca3af");
    watermarkText.setAttribute("text-anchor", "end");
    watermarkText.textContent = `CADENCE SKILL ARRAY BUILDER • COMPILER ENGINE v1.2`;
    tableGroup.appendChild(watermarkText);

    // Append the newly created table group to the main SVG
    const firstGroup = svgNode.querySelector('g');
    if (firstGroup) {
      firstGroup.appendChild(tableGroup);
    }
  };

  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const svgNode = svgRef.current.cloneNode(true) as SVGSVGElement;
    
    // Find the pan/zoom group and strip its viewport translation
    const panZoomGroup = svgNode.querySelector('g');
    if (panZoomGroup) {
      panZoomGroup.removeAttribute('transform');
    }

    // Set a correct viewBox that encapsulates BOTH the actual layout bounds and the specs table
    const scaledMinX = layout.bounds.minX * baseScale;
    const scaledMaxX = layout.bounds.maxX * baseScale;
    const scaledMinY = layout.bounds.minY * baseScale;
    const scaledMaxY = layout.bounds.maxY * baseScale;

    // Account for the scale(1, -1) which inverts Y axis visual placement
    const padding = Math.max(layout.width, layout.totalHeight) * baseScale * 0.05;
    
    // Layout visual bounds:
    const layoutMinX = scaledMinX - padding;
    const layoutMaxX = scaledMaxX + padding;
    const layoutMinY = -scaledMaxY - padding;
    const layoutMaxY = -scaledMinY + padding;

    // Table specifications
    const N = layout.blocks.length;
    const tableWidth = 680;
    
    // Calculate table height same as inside appendLayoutSpecTable
    const layoutVbh = (scaledMaxY - scaledMinY) + padding * 2;
    const rowHeight = Math.max(35, (layoutVbh - padding * 2) / N);
    const tableHeight = rowHeight * N;
    const tableYStart = -scaledMaxY;

    // Table visual bounds:
    const tableMinX = layoutMaxX; // starts immediately after layoutMaxX
    const tableMaxX = tableMinX + tableWidth;
    const tableMinY = tableYStart - 70;
    const tableMaxY = tableYStart + tableHeight + 20;

    // Unified bounds:
    const finalMinX = Math.min(layoutMinX, tableMinX);
    const finalMaxX = Math.max(layoutMaxX, tableMaxX);
    const finalMinY = Math.min(layoutMinY, tableMinY);
    const finalMaxY = Math.max(layoutMaxY, tableMaxY);

    // Apply safety margin around the unified bounds
    const margin = 20;
    const vbx = finalMinX - margin;
    const vby = finalMinY - margin;
    const vbw = (finalMaxX - finalMinX) + margin * 2;
    const vbh = (finalMaxY - finalMinY) + margin * 2;

    // Append detailed layout spec map table
    appendLayoutSpecTable(svgNode);

    svgNode.setAttribute('viewBox', `${vbx} ${vby} ${vbw} ${vbh}`);
    svgNode.removeAttribute('width');
    svgNode.removeAttribute('height');
    svgNode.style.width = '100%';
    svgNode.style.height = '100%';

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgNode);
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${config.top_cell || 'layout'}_${viewMode}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPNG = () => {
    if (!svgRef.current) return;
    const svgNode = svgRef.current.cloneNode(true) as SVGSVGElement;
    
    const panZoomGroup = svgNode.querySelector('g');
    if (panZoomGroup) {
      panZoomGroup.removeAttribute('transform');
    }

    // Set a correct viewBox that encapsulates BOTH the actual layout bounds and the specs table
    const scaledMinX = layout.bounds.minX * baseScale;
    const scaledMaxX = layout.bounds.maxX * baseScale;
    const scaledMinY = layout.bounds.minY * baseScale;
    const scaledMaxY = layout.bounds.maxY * baseScale;

    // Account for the scale(1, -1) which inverts Y axis visual placement
    const padding = Math.max(layout.width, layout.totalHeight) * baseScale * 0.05;
    
    // Layout visual bounds:
    const layoutMinX = scaledMinX - padding;
    const layoutMaxX = scaledMaxX + padding;
    const layoutMinY = -scaledMaxY - padding;
    const layoutMaxY = -scaledMinY + padding;

    // Table specifications
    const N = layout.blocks.length;
    const tableWidth = 680;
    
    // Calculate table height same as inside appendLayoutSpecTable
    const layoutVbh = (scaledMaxY - scaledMinY) + padding * 2;
    const rowHeight = Math.max(35, (layoutVbh - padding * 2) / N);
    const tableHeight = rowHeight * N;
    const tableYStart = -scaledMaxY;

    // Table visual bounds:
    const tableMinX = layoutMaxX; // starts immediately after layoutMaxX
    const tableMaxX = tableMinX + tableWidth;
    const tableMinY = tableYStart - 70;
    const tableMaxY = tableYStart + tableHeight + 20;

    // Unified bounds:
    const finalMinX = Math.min(layoutMinX, tableMinX);
    const finalMaxX = Math.max(layoutMaxX, tableMaxX);
    const finalMinY = Math.min(layoutMinY, tableMinY);
    const finalMaxY = Math.max(layoutMaxY, tableMaxY);

    // Apply safety margin around the unified bounds
    const margin = 20;
    const vbx = finalMinX - margin;
    const vby = finalMinY - margin;
    const vbw = (finalMaxX - finalMinX) + margin * 2;
    const vbh = (finalMaxY - finalMinY) + margin * 2;

    // Append detailed layout spec map table
    appendLayoutSpecTable(svgNode);

    svgNode.setAttribute('viewBox', `${vbx} ${vby} ${vbw} ${vbh}`);
    svgNode.removeAttribute('width');
    svgNode.removeAttribute('height');
    
    // Set specific width/height for canvas rendering
    const targetWidth = 4000;
    const scale = targetWidth / vbw;
    const targetHeight = vbh * scale;
    
    svgNode.setAttribute('width', `${targetWidth}`);
    svgNode.setAttribute('height', `${targetHeight}`);

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgNode);
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    const img = new Image();
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `${config.top_cell || 'layout'}_${viewMode}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="flex flex-col h-[520px] md:h-[580px] w-full bg-glass-panel rounded-lg border border-glass-border text-glass-text overflow-hidden relative">
      {/* Header Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between px-6 py-4 border-b border-glass-border bg-glass-panel gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-neon-rose" />
            <h3 className="font-sans font-black uppercase italic text-sm tracking-tight whitespace-nowrap">
              CAD Layout Viewport: {config.top_cell} <span className="text-xs text-glass-text/80 font-mono italic normal-case font-normal">({config.top_lib})</span>
            </h3>
          </div>
          <div className="h-4 w-px bg-black/10 hidden sm:block" />
          <button
            onClick={() => {
              setViewMode(v => v === 'physical' ? 'schematic' : 'physical');
              handleReset();
            }}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-lg transition-all cursor-pointer border border-glass-border shadow-lg active:scale-95 active:shadow-none ${viewMode === 'schematic' ? 'bg-indigo-600 text-white border-indigo-900 shadow-indigo-900' : 'bg-glass-panel text-glass-text hover:bg-glass-bg'}`}
            title="Toggle Map / Exact Physical Ratio View"
          >
            <Map className="w-3.5 h-3.5" />
            {viewMode === 'schematic' ? 'Map View' : 'Exact Ratio'}
          </button>
          
          <button
            onClick={handleDownloadSVG}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-lg transition-all cursor-pointer border border-glass-border shadow-lg active:scale-95 active:shadow-none bg-glass-panel text-glass-text hover:bg-glass-bg"
            title="Download SVG Layout"
          >
            <Download className="w-3.5 h-3.5" />
            SVG
          </button>
          <button
            onClick={handleDownloadPNG}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-lg transition-all cursor-pointer border border-glass-border shadow-lg active:scale-95 active:shadow-none bg-glass-panel text-glass-text hover:bg-glass-bg"
            title="Download High-Res PNG Layout"
          >
            <Download className="w-3.5 h-3.5" />
            PNG
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1 bg-glass-bg p-1 border border-glass-border rounded-lg self-start xl:self-auto">
          <button
            onClick={() => setShowSubgrid(!showSubgrid)}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${showSubgrid ? 'bg-slate-200 text-slate-800' : 'text-glass-text/80 hover:text-glass-text'}`}
            title="Toggle Subgrid Columns"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCoordinates(!showCoordinates)}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${showCoordinates ? 'bg-slate-200 text-slate-800' : 'text-glass-text/80 hover:text-glass-text'}`}
            title="Toggle Coordinate Labels"
          >
            {showCoordinates ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <div className="w-px h-4 bg-black/10 mx-1" />
          <button
            onClick={handlePanUp}
            className="p-1.5 rounded-lg text-glass-text hover:bg-glass-panel border border-transparent hover:border-slate-300 cursor-pointer transition"
            title="Pan Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={handlePanDown}
            className="p-1.5 rounded-lg text-glass-text hover:bg-glass-panel border border-transparent hover:border-slate-300 cursor-pointer transition"
            title="Pan Down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            onClick={handlePanLeft}
            className="p-1.5 rounded-lg text-glass-text hover:bg-glass-panel border border-transparent hover:border-slate-300 cursor-pointer transition"
            title="Pan Left"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handlePanRight}
            className="p-1.5 rounded-lg text-glass-text hover:bg-glass-panel border border-transparent hover:border-slate-300 cursor-pointer transition"
            title="Pan Right"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-black/10 mx-1" />
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-glass-text hover:bg-glass-panel border border-transparent hover:border-slate-300 cursor-pointer transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-glass-text hover:bg-glass-panel border border-transparent hover:border-slate-300 cursor-pointer transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg text-glass-text hover:bg-glass-panel border border-transparent hover:border-slate-300 cursor-pointer transition"
            title="Fit to Screen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Renders CAD Workspace */}
      <div 
        id="cad-canvas-container"
        ref={containerRef}
        onClick={() => {
          setLockedRowIdx(null);
          setLockedSegIdx(null);
        }}
        className={`cad-viewer-canvas flex-1 relative overflow-hidden bg-glass-panel cursor-crosshair select-none ${isDragging ? 'cursor-grabbing' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Absolute Background Guide Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-50" />
        
        {/* Live Coordinate Ruler overlay */}
        {showCoordinates && hoveredCoord && !isSchematic && (
          <div className="absolute top-3 left-4 bg-glass-panel border border-glass-border px-3 py-1.5 font-mono text-xs text-glass-text z-10 flex gap-4 pointer-events-none">
            <div>X: <span className="font-bold">{hoveredCoord.x.toFixed(2)} μm</span></div>
            <div>Y: <span className="font-bold">{hoveredCoord.y.toFixed(2)} μm</span></div>
            <div>ZOOM: <span className="text-glass-text/80">{Math.round(zoom * 100)}%</span></div>
          </div>
        )}

        {isSchematic && (
          <div className="absolute top-3 left-4 bg-indigo-600 border border-indigo-400 px-3 py-1.5 font-mono text-xs text-white font-bold uppercase tracking-widest z-10 flex gap-2 items-center pointer-events-none shadow-lg">
            <Map className="w-3.5 h-3.5" /> Map View Active
          </div>
        )}

        {/* CAD Layout Render */}
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ transform: 'scale(1)', transformOrigin: 'center' }}
        >
          {/* Origin Centered Group with Translation Pan & Zoom */}
          <g transform={`translate(${dimensions.width/2 + pan.x}, ${dimensions.height/2 + pan.y})`}>
            
            {/* Draw grid rulers */}
            {showCoordinates && !isSchematic && (
              <>
                {/* Horizontal Coordinate axis */}
                <line x1={-dimensions.width} y1={0} x2={dimensions.width} y2={0} stroke="#e5e5e5" strokeWidth="1" strokeDasharray="2,4" />
                {/* Vertical Coordinate axis */}
                <line x1={0} y1={-dimensions.height} x2={0} y2={dimensions.height} stroke="#e5e5e5" strokeWidth="1" strokeDasharray="2,4" />
              </>
            )}

            {/* Core silicon layout bounding box */}
            <g transform="scale(1, -1)"> {/* Invert Y-axis so Cartesian coordinates are standard */}
              {layout.blocks.map((block, bIdx) => {
                const colorInfo = getPurposeColor(block.purpose, block.name || '');
                const isHovered = hoveredRowIdx === bIdx;

                // Scale layout units to screen coordinates
                const x = block.minX * baseScale;
                const y = block.minY * baseScale;
                const w = layout.width * baseScale;
                const h = block.height * baseScale;

                const hasSegments = block.segments && block.segments.length > 0;

                return (
                  <g 
                    key={bIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (lockedRowIdx === bIdx && lockedSegIdx === null) {
                        setLockedRowIdx(null);
                      } else {
                        setLockedRowIdx(bIdx);
                        setLockedSegIdx(null);
                      }
                    }}
                    onMouseEnter={() => { setHoveredRowIdx(bIdx); setHoveredSegIdx(null); }}
                    onMouseLeave={() => { setHoveredRowIdx(null); setHoveredSegIdx(null); }}
                    className="cursor-pointer transition-all duration-150"
                  >
                    {/* Main row block rectangle or multiple segment rectangles */}
                    {!hasSegments ? (
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        fill={isHovered ? colorInfo.fill.replace('0.15', '0.30') : colorInfo.fill}
                        stroke={isHovered ? '#ffffff' : colorInfo.stroke}
                        strokeWidth={isHovered ? 2 : Math.min(1.5, Math.max(0.2, h / 3))}
                        className="transition-all duration-100"
                      />
                    ) : (
                      (() => {
                        let currX = block.minX;
                        return block.segments!.map((seg, sIdx) => {
                          const segLayoutW = isSchematic ? (seg.cols / total_cols) * layout.width : seg.cols * x_pitch;
                          const segColor = getPurposeColor(seg.purpose, seg.purpose);
                          const rx = currX * baseScale;
                          const rw = segLayoutW * baseScale;
                          currX += segLayoutW;
                          const isSegHovered = isHovered && hoveredSegIdx === sIdx;
                          return (
                            <rect
                              key={sIdx}
                              x={rx}
                              y={y}
                              width={rw}
                              height={h}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (lockedRowIdx === bIdx && lockedSegIdx === sIdx) {
                                  setLockedRowIdx(null);
                                  setLockedSegIdx(null);
                                } else {
                                  setLockedRowIdx(bIdx);
                                  setLockedSegIdx(sIdx);
                                }
                              }}
                              onMouseEnter={() => setHoveredSegIdx(sIdx)}
                              onMouseLeave={() => setHoveredSegIdx(null)}
                              fill={isSegHovered || (isHovered && hoveredSegIdx === null) ? segColor.fill.replace('0.15', '0.30') : segColor.fill}
                              stroke={isSegHovered || (isHovered && hoveredSegIdx === null) ? '#ffffff' : segColor.stroke}
                              strokeWidth={isSegHovered || (isHovered && hoveredSegIdx === null) ? 2 : Math.min(1.5, Math.max(0.2, h / 3))}
                              className="transition-all duration-100"
                            />
                          );
                        });
                      })()
                    )}

                    {/* Column Divider Lines (Subgrid of pixels inside rows) */}
                    {showSubgrid && w > 30 && (
                      <g opacity={isHovered ? 0.45 : 0.25}>
                        {!hasSegments ? (
                          Array.from({ length: Math.min(total_cols - 1, isSchematic ? 20 : 50) }).map((_, cIdx) => {
                            const step = total_cols <= (isSchematic ? 20 : 50) ? 1 : total_cols / (isSchematic ? 20 : 50);
                            const logicalCol = (cIdx + 1) * step;
                            const colLayoutX = isSchematic ? (logicalCol / total_cols) * layout.width : logicalCol * x_pitch;
                            const colX = x + (colLayoutX * baseScale);
                            return (
                              <line
                                key={cIdx}
                                x1={colX}
                                y1={y}
                                x2={colX}
                                y2={y + h}
                                stroke={colorInfo.stroke}
                                strokeWidth="0.8"
                                strokeDasharray="2,2"
                              />
                            );
                          })
                        ) : (
                          (() => {
                            let currX = block.minX;
                            const lines: React.ReactNode[] = [];
                            block.segments!.forEach((seg, sIdx) => {
                              const segLayoutW = isSchematic ? (seg.cols / total_cols) * layout.width : seg.cols * x_pitch;
                              const segColor = getPurposeColor(seg.purpose, seg.purpose);
                              
                              // Inner segment column lines
                              const maxSegLines = isSchematic ? Math.min(seg.cols, 5) : Math.min(seg.cols, 20);
                              const step = seg.cols <= maxSegLines ? 1 : seg.cols / maxSegLines;
                              for (let cIdx = 1; cIdx < maxSegLines; cIdx++) {
                                const logicalCol = cIdx * step;
                                const colLayoutX = isSchematic ? (logicalCol / total_cols) * layout.width : logicalCol * x_pitch;
                                const colX = (currX + colLayoutX) * baseScale;
                                lines.push(
                                  <line
                                    key={`divider-${sIdx}-${cIdx}`}
                                    x1={colX}
                                    y1={y}
                                    x2={colX}
                                    y2={y + h}
                                    stroke={segColor.stroke}
                                    strokeWidth="0.8"
                                    strokeDasharray="2,2"
                                  />
                                );
                              }
                              currX += segLayoutW;

                              // Vertical segment boundary line separator
                              if (sIdx < block.segments!.length - 1) {
                                const borderX = currX * baseScale;
                                lines.push(
                                  <line
                                    key={`border-${sIdx}`}
                                    x1={borderX}
                                    y1={y}
                                    x2={borderX}
                                    y2={y + h}
                                    stroke="#ffffff"
                                    strokeWidth="1.2"
                                    opacity="0.8"
                                  />
                                );
                              }
                            });
                            return lines;
                          })()
                        )}
                        {/* Horizontal subgrid for row count */}
                        {rowBlockSubgrid(rowBlockHeightRenders(block, y, h, baseScale, isSchematic), x, w, colorInfo.stroke)}
                      </g>
                    )}

                    {/* Central row block purpose label */}
                    {(h > 8 || isSchematic) && (
                      <g transform={`translate(${x + w/2}, ${y + h/2}) scale(1, -1)`}>
                        <text
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          fill={colorInfo.text}
                          className="font-mono font-bold pointer-events-none select-none opacity-90"
                        >
                          {(() => {
                            const cellInfo = cell_map[block.purpose.toLowerCase()];
                            const rowLabel = block.name || block.purpose;
                            const cellName = cellInfo?.cell || 'Unknown';
                            
                            const maxLayoutFontSize = isSchematic ? 60 : 30;
                            const titleFontSize = Math.min(h * 0.45, maxLayoutFontSize * baseScale);
                            const subFontSize = titleFontSize * 0.7;
                            
                            if (hasSegments) {
                              const segmentDesc = block.segments!.map(s => `${s.purpose}:${s.cols}`).join(' | ');
                              if (h > 15 || isSchematic) {
                                return (
                                  <>
                                    <tspan x="0" dy={-titleFontSize * 0.2} style={{ fontSize: titleFontSize, fontFamily: 'sans-serif', fontWeight: 900, letterSpacing: '-0.02em' }}>{rowLabel.toUpperCase()}</tspan>
                                    <tspan x="0" dy={titleFontSize * 1.1} style={{ fontSize: subFontSize, opacity: 0.8, fontWeight: 400 }}>[{segmentDesc}] &bull; {block.rows}r</tspan>
                                  </>
                                );
                              } else {
                                return <tspan x="0" dy={titleFontSize * 0.3} style={{ fontSize: titleFontSize, fontFamily: 'sans-serif', fontWeight: 900 }}>{rowLabel.toUpperCase()}</tspan>;
                              }
                            }

                            if (h > 15 || isSchematic) {
                              return (
                                <>
                                  <tspan x="0" dy={-titleFontSize * 0.2} style={{ fontSize: titleFontSize, fontFamily: 'sans-serif', fontWeight: 900, letterSpacing: '-0.02em' }}>{rowLabel.toUpperCase()}</tspan>
                                  <tspan x="0" dy={titleFontSize * 1.1} style={{ fontSize: subFontSize, opacity: 0.8, fontWeight: 400 }}>[{cellName}] &bull; {block.rows}r</tspan>
                                </>
                              );
                            } else {
                               return <tspan x="0" dy={titleFontSize * 0.3} style={{ fontSize: titleFontSize, fontFamily: 'sans-serif', fontWeight: 900 }}>{rowLabel.toUpperCase()}</tspan>;
                            }
                          })()}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Glowing origin (0, 0) aligning center Box */}
              {!isSchematic && (
                <>
                  <circle cx={0} cy={0} r={4} fill="#f43f5e" className="animate-ping pointer-events-none" />
                  <circle cx={0} cy={0} r={3} fill="#f43f5e" className="pointer-events-none" />
                  <line x1={-15} y1={0} x2={15} y2={0} stroke="#f43f5e" strokeWidth="1" className="pointer-events-none" />
                  <line x1={0} y1={-15} x2={0} y2={15} stroke="#f43f5e" strokeWidth="1" className="pointer-events-none" />
                </>
              )}
            </g>
          </g>
        </svg>

        {/* Floating Tooltip details on hover */}
        {(lockedRowIdx !== null || hoveredRowIdx !== null) && (
          <div 
            className={`absolute top-3 right-4 bg-glass-panel/95 backdrop-blur-xs border border-glass-border p-4 w-auto min-w-[300px] max-w-[420px] shadow-lg animate-fade-in z-20 text-glass-text ${lockedRowIdx !== null ? 'pointer-events-auto select-text ring-1 ring-neon-cyan' : 'pointer-events-none'}`}
          >
            {(() => {
              const activeBIdx = lockedRowIdx !== null ? lockedRowIdx : hoveredRowIdx;
              const b = layout.blocks[activeBIdx!];
              let purposeToShow = b.purpose.toLowerCase();
              let nameToShow = b.name || b.purpose;
              let isSegment = false;
              let segCols = total_cols;
              
              const activeSIdx = lockedRowIdx !== null ? lockedSegIdx : hoveredSegIdx;
              if (b.segments && activeSIdx !== null && b.segments[activeSIdx]) {
                const seg = b.segments[activeSIdx];
                purposeToShow = seg.purpose.toLowerCase();
                nameToShow = `${seg.purpose} (Segment)`;
                isSegment = true;
                segCols = seg.cols;
              }
              
              const cell = cell_map[purposeToShow] || { lib: 'unknown_lib', cell: 'cell_unknown', rot: 'R0' };
              const isRov = purposeToShow === rov_purpose.toLowerCase();

              return (
                <div className="space-y-2.5 font-sans">
                  <div className="flex items-center justify-between border-b border-glass-border/10 pb-2">
                    <span className="font-black text-xs uppercase italic tracking-tight flex items-center gap-1.5">
                      <span className={`w-2 h-2 ${isRov ? 'bg-neon-emerald' : 'bg-emerald-500'}`} />
                      {nameToShow.toUpperCase()} {isSegment ? '' : 'Block'}
                      {lockedRowIdx !== null && <span className="ml-2 text-[9px] bg-neon-cyan/20 text-neon-cyan px-1.5 py-0.5 rounded-full normal-case">Locked (Click to copy)</span>}
                    </span>
                    <span className="text-xs font-mono text-slate-800 bg-slate-200 uppercase tracking-widest px-1.5 py-0.5 font-bold">
                      {isSegment ? `${segCols} Cols` : `${b.rows} Rows`}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs font-mono">
                    {b.name && b.name.toLowerCase() !== purposeToShow && !isSegment && (
                      <div className="flex justify-between gap-4">
                        <span className="opacity-60 shrink-0">Purpose:</span>
                        <span className="text-neon-emerald font-bold text-right break-all">{b.purpose.toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex justify-between gap-4">
                      <span className="opacity-60 shrink-0">Library:</span>
                      <span className="font-bold text-right break-all">{cell.lib}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="opacity-60 shrink-0">Cell:</span>
                      <span className="text-emerald-700 font-bold text-right break-all">{cell.cell}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="opacity-60 shrink-0">Rotation:</span>
                      <span className="font-bold text-right">{cell.rot}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="opacity-60 shrink-0">Grid:</span>
                      <span className="font-bold text-right">
                        {segCols} Cols × {b.rows} Rows
                      </span>
                    </div>
                    {b.address && (
                      <div className="mt-2.5 pt-2 border-t border-glass-border/30">
                        <span className="bg-indigo-600/10 text-indigo-700 border border-indigo-200 px-2.5 py-1.5 rounded-md text-xs font-mono font-black flex items-center gap-2 uppercase tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse shadow-[0_0_8px_rgba(79,70,229,0.8)]"></span>
                          Address: {b.address}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Control instructions / Legend */}
      <div className="bg-glass-bg px-6 py-3 border-t-2 border-[#141414] text-sm font-mono text-glass-text flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1 hidden sm:flex">
          <div className="flex items-center gap-1.5 text-xs">
            <Move className="w-3.5 h-3.5 shrink-0" />
            <span className="uppercase tracking-wide text-glass-text/90">MOUSE: DRAG TO PAN // SCROLL TO ZOOM</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10.5px]">
            <span className="bg-slate-200 text-slate-800 px-1.5 py-0.5 text-[8.5px] rounded-lg font-bold">KEYBOARD CONTROLS</span>
            <span className="uppercase tracking-wide font-bold text-glass-text">WASD / ARROWS TO PAN &bull; +/- TO ZOOM &bull; F TO FIT &bull; G TO GRID</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 uppercase tracking-wide text-xs font-bold">
          {legendItems.map((cat) => (
            <span 
              key={cat.key} 
              className="flex items-center gap-1.5" 
              title={cat.cellList.length > 0 ? `Mapped cells: ${cat.cellList.join(', ')}` : undefined}
            >
              <span 
                className="w-2.5 h-2.5 border border-glass-border rounded-lg inline-block" 
                style={{ backgroundColor: cat.bgStyle, borderColor: cat.borderStyle }}
              />
              <span>
                {cat.label}
                {cat.cellList.length > 0 && (
                  <span className="text-sm text-glass-text/90 font-mono normal-case font-normal ml-1.5">
                    {cat.cellList[0]}
                  </span>
                )}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

// Helper to calculate coordinate positions for subgrids
function rowBlockSubgrid(rows: number[], x: number, w: number, color: string) {
  return rows.map((yVal, idx) => (
    <line
      key={idx}
      x1={x}
      y1={yVal}
      x2={x + w}
      y2={yVal}
      stroke={color}
      strokeWidth="0.8"
      strokeDasharray="2,2"
    />
  ));
}

function rowBlockHeightRenders(block: any, y: number, h: number, baseScale: number, isSchematic: boolean) {
  const renderedYCoords = [];
  const displayRows = isSchematic ? Math.min(block.rows, 4) : block.rows;
  if (displayRows > 1) {
    const unitHeight = h / displayRows;
    for (let r = 1; r < displayRows; r++) {
      renderedYCoords.push(y + r * unitHeight);
    }
  }
  return renderedYCoords;
}
