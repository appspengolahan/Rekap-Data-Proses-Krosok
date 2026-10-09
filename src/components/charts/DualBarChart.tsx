import React, { useState } from 'react';
import { formatNum } from '../../services/dataService';

interface DualBarItem {
  label: string;
  series1: number; // Baku
  series2: number; // Hasil
}

interface DualBarChartProps {
  title?: string;
  data: DualBarItem[];
  label1?: string;
  label2?: string;
  height?: number;
  showDataLabels?: boolean;
}

export const DualBarChart: React.FC<DualBarChartProps> = ({
  title,
  data,
  label1 = 'Baku (Kg)',
  label2 = 'Hasil (Kg)',
  height = 280,
  showDataLabels = true
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
        Tidak ada data perbandingan
      </div>
    );
  }

  const isMaximized = height > 350;
  const padding = {
    top: isMaximized ? 40 : 30,
    right: isMaximized ? 30 : 20,
    bottom: isMaximized ? 45 : 35,
    left: isMaximized ? 65 : 55
  };
  const width = isMaximized ? 850 : 600;

  const maxVal =
    Math.max(
      1,
      ...data.map((d) => Math.max(d.series1, d.series2))
    ) * 1.25; // 25% headroom for data callouts

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const barGroupWidth = chartW / data.length;
  const barWidth = Math.min(isMaximized ? 28 : 22, (barGroupWidth - 10) / 2);

  const getY = (val: number) => {
    return padding.top + chartH - (val / maxVal) * chartH;
  };

  // Helper to format k (e.g. 65.2k)
  const formatK = (val: number) => {
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return Math.round(val).toString();
  };

  // Generate 4 grid lines
  const gridLines = [0, 0.33, 0.66, 1].map((pct) => {
    const val = pct * maxVal;
    const y = getY(val);
    return { val, y };
  });

  return (
    <div className="w-full">
      {/* Title & Legend */}
      {title && (
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h4 className="text-xs font-bold text-slate-800 tracking-tight">{title}</h4>
          <div className="flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-600"></span>
              <span className="text-slate-600">{label1}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-600"></span>
              <span className="text-slate-600">{label2}</span>
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          style={{ maxHeight: height }}
        >
          {/* Grid lines */}
          {gridLines.map((g, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={g.y}
                x2={width - padding.right}
                y2={g.y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={g.y + 3.5}
                textAnchor="end"
                className="text-[10px] fill-slate-400 font-medium"
              >
                {Math.round(g.val).toLocaleString('id-ID')}
              </text>
            </g>
          ))}

          {/* Bars */}
          {data.map((item, idx) => {
            const groupX = padding.left + idx * barGroupWidth;
            const centerX = groupX + barGroupWidth / 2;
            const bar1X = centerX - barWidth - 1;
            const bar2X = centerX + 1;

            const bar1H = Math.max(2, (item.series1 / maxVal) * chartH);
            const bar2H = Math.max(2, (item.series2 / maxVal) * chartH);

            const bar1Y = padding.top + chartH - bar1H;
            const bar2Y = padding.top + chartH - bar2H;

            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Background hover highlight */}
                {isHovered && (
                  <rect
                    x={groupX + 2}
                    y={padding.top}
                    width={barGroupWidth - 4}
                    height={chartH}
                    fill="#f1f5f9"
                    opacity="0.6"
                    rx="6"
                  />
                )}

                {/* Series 1 Callout label above bar (as in Image 3) */}
                {showDataLabels && item.series1 > 0 && (
                  <text
                    x={bar1X + barWidth / 2}
                    y={bar1Y - 4}
                    textAnchor="middle"
                    className="text-[8.5px] fill-blue-700 font-bold"
                  >
                    {formatK(item.series1)}
                  </text>
                )}

                {/* Series 1 Bar (Baku) */}
                <rect
                  x={bar1X}
                  y={bar1Y}
                  width={barWidth}
                  height={bar1H}
                  fill="#2563eb"
                  rx="4"
                  className="transition-all hover:opacity-90"
                />

                {/* Series 2 Callout label above bar */}
                {showDataLabels && item.series2 > 0 && (
                  <text
                    x={bar2X + barWidth / 2}
                    y={bar2Y - 4}
                    textAnchor="middle"
                    className="text-[8.5px] fill-emerald-700 font-bold"
                  >
                    {formatK(item.series2)}
                  </text>
                )}

                {/* Series 2 Bar (Hasil) */}
                <rect
                  x={bar2X}
                  y={bar2Y}
                  width={barWidth}
                  height={bar2H}
                  fill="#059669"
                  rx="4"
                  className="transition-all hover:opacity-90"
                />

                {/* X-axis label */}
                <text
                  x={centerX}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  className={`text-[9.5px] sm:text-[10px] font-medium transition-colors ${
                    isHovered ? 'fill-slate-900 font-bold' : 'fill-slate-500'
                  }`}
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip when hovered */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xs text-white text-xs px-3.5 py-2 rounded-xl shadow-2xl pointer-events-none flex items-center gap-3 border border-slate-700">
            <span className="font-bold text-slate-300">{data[hoveredIdx].label}:</span>
            <span className="text-blue-300 font-semibold">
              Baku: {formatNum(data[hoveredIdx].series1)} Kg
            </span>
            <span className="text-emerald-300 font-semibold">
              Hasil: {formatNum(data[hoveredIdx].series2)} Kg
            </span>
            <span className="text-amber-300 font-semibold">
              Susut: {formatNum(data[hoveredIdx].series1 - data[hoveredIdx].series2)} Kg
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
