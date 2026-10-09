import React, { useState } from 'react';
import { formatPct } from '../../services/dataService';

interface DataPoint {
  label: string;
  value: number;
  subValue?: string | number;
}

interface InteractiveLineChartProps {
  title?: string;
  data: DataPoint[];
  color?: string;
  valueFormatter?: (v: number) => string;
  height?: number;
  unit?: string;
  targetLine?: number;
  showDataLabels?: boolean;
}

export const InteractiveLineChart: React.FC<InteractiveLineChartProps> = ({
  title,
  data,
  color = '#2563eb', // blue-600
  valueFormatter = (v) => `${formatPct(v)}%`,
  height = 280,
  unit = '%',
  targetLine,
  showDataLabels = true
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
        Tidak ada data untuk grafik ini
      </div>
    );
  }

  const isMaximized = height > 350;
  const padding = {
    top: isMaximized ? 35 : 25,
    right: isMaximized ? 35 : 25,
    bottom: isMaximized ? 45 : 35,
    left: isMaximized ? 55 : 45
  };
  const width = isMaximized ? 850 : 600; // viewBox width

  const values = data.map((d) => d.value);
  const minVal = Math.max(0, Math.min(...values) * 0.85);
  const maxVal = Math.max(1, Math.max(...values) * 1.2); // 20% headroom for labels

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getX = (idx: number) => {
    if (data.length <= 1) return padding.left + chartW / 2;
    return padding.left + (idx / (data.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    if (maxVal === minVal) return padding.top + chartH / 2;
    return padding.top + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;
  };

  const points = data.map((d, i) => ({
    x: getX(i),
    y: getY(d.value),
    ...d
  }));

  // Create path
  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
  }

  // Create area fill path
  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`
      : '';

  // Generate 4 horizontal grid lines
  const gridLines = [0, 0.33, 0.66, 1].map((pct) => {
    const val = minVal + pct * (maxVal - minVal);
    const y = getY(val);
    return { val, y };
  });

  return (
    <div className="w-full">
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-800 tracking-tight">{title}</h4>
          {hoveredIdx !== null && data[hoveredIdx] && (
            <div className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {data[hoveredIdx].label}: {valueFormatter(data[hoveredIdx].value)}
            </div>
          )}
        </div>
      )}

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          style={{ maxHeight: height }}
        >
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.30" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

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
                {g.val.toFixed(2)}
                {unit}
              </text>
            </g>
          ))}

          {/* Optional target threshold line */}
          {targetLine !== undefined && (
            <line
              x1={padding.left}
              y1={getY(targetLine)}
              x2={width - padding.right}
              y2={getY(targetLine)}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />
          )}

          {/* Area Fill */}
          <path d={areaD} fill={`url(#grad-${color.replace('#', '')})`} />

          {/* Line Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth={isMaximized ? '3.5' : '2.5'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points & Callout Labels (matching Image 3) */}
          {points.map((p, idx) => {
            const isHovered = hoveredIdx === idx;
            const labelText = valueFormatter(p.value);

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {/* Data Value Badge Tag Callout above point (like in reference screenshot) */}
                {showDataLabels && (
                  <g transform={`translate(${p.x}, ${p.y - 14})`}>
                    <rect
                      x={-22}
                      y={-10}
                      width={44}
                      height={14}
                      rx={4}
                      fill="#ffffff"
                      stroke="#cbd5e1"
                      strokeWidth={1}
                      className="shadow-xs"
                    />
                    <text
                      x={0}
                      y={0}
                      textAnchor="middle"
                      className="text-[8.5px] fill-slate-700 font-bold"
                    >
                      {labelText}
                    </text>
                  </g>
                )}

                {/* Point circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? (isMaximized ? '7' : '5.5') : (isMaximized ? '4.5' : '3.5')}
                  fill={isHovered ? '#ffffff' : color}
                  stroke={color}
                  strokeWidth={isHovered ? '3' : '1.5'}
                  className="transition-all duration-150"
                />

                {/* Invisible hover trigger */}
                <circle cx={p.x} cy={p.y} r="18" fill="transparent" />

                {/* X-axis label */}
                <text
                  x={p.x}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  className={`text-[9.5px] sm:text-[10px] font-medium transition-colors ${
                    isHovered ? 'fill-blue-700 font-bold' : 'fill-slate-500'
                  }`}
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip when hovered */}
        {hoveredIdx !== null && data[hoveredIdx] && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs px-3 py-1.5 rounded-xl shadow-xl pointer-events-none flex items-center gap-2 border border-slate-700">
            <span className="font-semibold text-slate-300">{data[hoveredIdx].label}:</span>
            <span className="font-bold text-blue-400">
              {valueFormatter(data[hoveredIdx].value)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
