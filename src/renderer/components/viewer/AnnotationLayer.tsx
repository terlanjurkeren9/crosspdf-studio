import { useCallback, useRef } from 'react';
import type { Annotation as AnnotationType } from '../../types/annotation.types';
import { pdfRectToPixel, quadPointsToPixel } from '../../lib/pdf-coordinates';
import {
  getAnnotationHitTargetCursor,
  getAnnotationHitTargetPointerEvents,
} from '../../lib/hand-tool';
import type { PageDims } from '../../lib/zoom';

interface AnnotationLayerProps {
  annotations: AnnotationType[];
  pageNumber: number;
  zoom: number;
  pageDims?: PageDims | null;
  selectedIds: Set<string>;
  activeTool: string;
  onAnnotationClick?: (id: string) => void;
  onAnnotationDoubleClick?: (id: string) => void;
  onPageClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export function AnnotationLayer({
  annotations,
  pageNumber,
  zoom,
  pageDims,
  selectedIds,
  activeTool,
  onAnnotationClick,
  onAnnotationDoubleClick,
  onPageClick,
  className = '',
}: AnnotationLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  const width = pageDims ? pageDims.width * zoom : 0;
  const height = pageDims ? pageDims.height * zoom : 0;

  const isCreationTool =
    activeTool === 'sticky-note' ||
    activeTool === 'free-text' ||
    activeTool === 'stamp' ||
    activeTool === 'freehand' ||
    activeTool === 'rectangle' ||
    activeTool === 'ellipse' ||
    activeTool === 'line' ||
    activeTool === 'arrow';

  const handleCreationClick = useCallback(
    (e: React.PointerEvent) => {
      onPageClick?.(e as unknown as React.MouseEvent);
    },
    [onPageClick]
  );

  return (
    <>
      {/* ── Layer 1: SVG visual only — never intercepts pointer events ── */}
      <div
        className={`annotationLayer absolute inset-0 ${className}`}
        style={{ pointerEvents: 'none', zIndex: 1 }}
      >
        {width > 0 && height > 0 && (
          <svg
            ref={svgRef}
            className="absolute top-0 left-0"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ pointerEvents: 'none' }}
          >
            {pageAnnotations.map((a) => (
              <AnnotationRenderer
                key={a.id}
                annotation={a}
                zoom={zoom}
                selected={selectedIds.has(a.id)}
              />
            ))}
          </svg>
        )}
      </div>

      {/* ── Layer 2: creation-tool click target — covers entire page ── */}
      {isCreationTool && (
        <div
          className="absolute inset-0"
          style={{ pointerEvents: 'all', zIndex: 2 }}
          onPointerDown={handleCreationClick}
        />
      )}

      {/* ── Layer 3: per-annotation HTML hit targets — always on top ── */}
      {pageAnnotations.map((a) => {
        const pixel = pdfRectToPixel(a.rect, zoom);
        const pad = 4;
        const x = Math.max(0, pixel.x - pad);
        const y = Math.max(0, pixel.y - pad);
        const w = Math.max(8, pixel.width + pad * 2);
        const h = Math.max(8, pixel.height + pad * 2);

        return (
          <div
            key={`hit-${a.id}`}
            data-annotation-hit={a.id}
            data-annotation-type={a.type}
            className="absolute"
            style={{
              left: x,
              top: y,
              width: w,
              height: h,
              pointerEvents: getAnnotationHitTargetPointerEvents(activeTool),
              cursor: getAnnotationHitTargetCursor(activeTool),
              zIndex: 3,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onAnnotationClick?.(a.id);
            }}
            onDoubleClick={() => onAnnotationDoubleClick?.(a.id)}
          />
        );
      })}
    </>
  );
}

function AnnotationRenderer({
  annotation,
  zoom,
  selected,
}: {
  annotation: AnnotationType;
  zoom: number;
  selected: boolean;
}) {
  const pixelRect = pdfRectToPixel(annotation.rect, zoom);

  if (
    annotation.type === 'highlight' ||
    annotation.type === 'underline' ||
    annotation.type === 'strikeout'
  ) {
    const quads = quadPointsToPixel(annotation.quadPoints, zoom);
    const paths: string[] = [];

    for (let i = 0; i < quads.length; i += 8) {
      const x1 = quads[i];
      const y1 = quads[i + 1];
      const x2 = quads[i + 2];
      const y2 = quads[i + 3];
      const x3 = quads[i + 4];
      const y3 = quads[i + 5];
      const x4 = quads[i + 6];
      const y4 = quads[i + 7];

      if (annotation.type === 'highlight') {
        paths.push(`M${x1},${y1} L${x2},${y2} L${x3},${y3} L${x4},${y4} Z`);
      } else if (annotation.type === 'underline') {
        paths.push(`M${x1},${y4} L${x2},${y3}`);
      } else if (annotation.type === 'strikeout') {
        const midY = (y1 + y4) / 2;
        paths.push(`M${x1},${midY} L${x3},${midY}`);
      }
    }

    const d = paths.join(' ');

    if (annotation.type === 'highlight') {
      return (
        <g>
          <path d={d} fill={annotation.color} opacity={annotation.opacity} />
          {selected && (
            <path d={d} fill="none" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3,2" />
          )}
        </g>
      );
    }

    if (annotation.type === 'underline' || annotation.type === 'strikeout') {
      return (
        <g>
          <path
            d={d}
            fill="none"
            stroke={annotation.color}
            strokeWidth={2 * zoom}
            strokeLinecap="square"
          />
          {selected && (
            <rect
              x={pixelRect.x - 2}
              y={pixelRect.y - 2}
              width={pixelRect.width + 4}
              height={pixelRect.height + 4}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={1}
              strokeDasharray="3,2"
            />
          )}
        </g>
      );
    }
  }

  if (annotation.type === 'sticky-note') {
    const size = Math.max(20, 22 * Math.min(zoom, 3));
    return (
      <g>
        <path
          d={`M${pixelRect.x},${pixelRect.y} L${pixelRect.x + size - 6},${pixelRect.y} L${pixelRect.x + size},${pixelRect.y + 6} L${pixelRect.x + size},${pixelRect.y + size} L${pixelRect.x},${pixelRect.y + size} Z`}
          fill={annotation.color}
          stroke={selected ? '#3b82f6' : 'rgba(0,0,0,0.2)'}
          strokeWidth={selected ? 2 : 1}
        />
        {annotation.content && (
          <text
            x={pixelRect.x + 4}
            y={pixelRect.y + 14}
            fontSize={Math.max(8, 10 * Math.min(zoom, 2))}
            fill="#333"
          >
            {annotation.content.length > 20
              ? annotation.content.slice(0, 20) + '...'
              : annotation.content}
          </text>
        )}
      </g>
    );
  }

  if (annotation.type === 'free-text') {
    return (
      <g>
        <rect
          x={pixelRect.x}
          y={pixelRect.y}
          width={pixelRect.width || 100}
          height={pixelRect.height || 24}
          fill="rgba(255,255,255,0.9)"
          stroke={selected ? '#3b82f6' : 'rgba(0,0,0,0.3)'}
          strokeWidth={selected ? 2 : 1}
          rx={2}
        />
        {annotation.content && (
          <text
            x={pixelRect.x + 4}
            y={pixelRect.y + annotation.fontSize * zoom + 2}
            fontSize={annotation.fontSize * zoom}
            fill={annotation.color}
          >
            {annotation.content}
          </text>
        )}
      </g>
    );
  }

  if (annotation.type === 'freehand') {
    const pts = annotation.points;
    if (pts.length < 2) return null;
    let d = `M${pts[0] * zoom},${pts[1] * zoom}`;
    for (let i = 2; i < pts.length; i += 2) {
      d += ` L${pts[i] * zoom},${pts[i + 1] * zoom}`;
    }
    return (
      <path
        d={d}
        fill="none"
        stroke={annotation.color}
        strokeWidth={annotation.strokeWidth * zoom}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={annotation.opacity}
      />
    );
  }

  if (annotation.type === 'rectangle') {
    return (
      <rect
        x={pixelRect.x}
        y={pixelRect.y}
        width={pixelRect.width}
        height={pixelRect.height}
        fill="none"
        stroke={annotation.color}
        strokeWidth={annotation.strokeWidth * zoom}
        opacity={annotation.opacity}
      />
    );
  }

  if (annotation.type === 'ellipse') {
    return (
      <ellipse
        cx={pixelRect.x + pixelRect.width / 2}
        cy={pixelRect.y + pixelRect.height / 2}
        rx={pixelRect.width / 2}
        ry={pixelRect.height / 2}
        fill="none"
        stroke={annotation.color}
        strokeWidth={annotation.strokeWidth * zoom}
        opacity={annotation.opacity}
      />
    );
  }

  if (annotation.type === 'line' || annotation.type === 'arrow') {
    const pts = annotation.points;
    if (pts.length < 4) return null;
    const x1 = pts[0] * zoom;
    const y1 = pts[1] * zoom;
    const x2 = pts[2] * zoom;
    const y2 = pts[3] * zoom;
    return (
      <g>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={annotation.color}
          strokeWidth={annotation.strokeWidth * zoom}
          opacity={annotation.opacity}
        />
        {annotation.type === 'arrow' && (
          <polygon
            points={arrowHead(x1, y1, x2, y2, 8 * zoom)}
            fill={annotation.color}
            opacity={annotation.opacity}
          />
        )}
      </g>
    );
  }

  if (annotation.type === 'redaction') {
    const patternId = `redact-pattern-${annotation.id}`;
    return (
      <g>
        <defs>
          <pattern
            id={patternId}
            width={8}
            height={8}
            patternUnits="userSpaceOnUse"
            patternTransform={`scale(${zoom})`}
          >
            <rect width={8} height={8} fill="rgba(0,0,0,0.7)" />
            <line x1={0} y1={0} x2={8} y2={8} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            <line x1={8} y1={0} x2={0} y2={8} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          </pattern>
        </defs>
        <rect
          x={pixelRect.x}
          y={pixelRect.y}
          width={pixelRect.width}
          height={pixelRect.height}
          fill={`url(#${patternId})`}
          stroke={selected ? '#3b82f6' : 'rgba(0,0,0,0.4)'}
          strokeWidth={selected ? 2 : 1}
        />
        <text
          x={pixelRect.x + pixelRect.width / 2}
          y={pixelRect.y + pixelRect.height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.6)"
          fontSize={Math.max(8, 10 * zoom)}
          style={{ pointerEvents: 'none' }}
        >
          REDACTED
        </text>
      </g>
    );
  }

  if (annotation.type === 'stamp') {
    if (!annotation.imageDataUrl || pixelRect.width <= 0 || pixelRect.height <= 0) return null;
    return (
      <g>
        <image
          href={annotation.imageDataUrl}
          x={pixelRect.x}
          y={pixelRect.y}
          width={pixelRect.width}
          height={pixelRect.height}
          opacity={annotation.opacity}
        />
        {selected && (
          <rect
            x={pixelRect.x}
            y={pixelRect.y}
            width={pixelRect.width}
            height={pixelRect.height}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="3,2"
          />
        )}
      </g>
    );
  }

  if (annotation.type === 'form-field') {
    const typeIcons: Record<string, string> = {
      text: 'T',
      checkbox: '☑',
      dropdown: '▼',
      radiogroup: '◉',
    };
    const label = annotation.fieldName || '';
    const typeIcon = typeIcons[annotation.fieldType] || 'T';
    const displayLabel = label ? `${typeIcon} ${label}` : typeIcon;

    return (
      <g>
        <rect
          x={pixelRect.x}
          y={pixelRect.y}
          width={pixelRect.width}
          height={pixelRect.height}
          fill="rgba(59, 130, 246, 0.1)"
          stroke={selected ? '#3b82f6' : 'rgba(59, 130, 246, 0.6)'}
          strokeWidth={selected ? 2 : 1}
          strokeDasharray={selected ? 'none' : '4,2'}
          rx={2}
        />
        <text
          x={pixelRect.x + 4}
          y={pixelRect.y + pixelRect.height / 2}
          fontSize={Math.max(10, 12 * zoom)}
          fill="#3b82f6"
          dominantBaseline="middle"
          style={{ pointerEvents: 'none' }}
        >
          {displayLabel}
        </text>
      </g>
    );
  }

  return null;
}

function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a1 = angle + Math.PI * 0.85;
  const a2 = angle - Math.PI * 0.85;
  return `${x2},${y2} ${x2 + size * Math.cos(a1)},${y2 + size * Math.sin(a1)} ${x2 + size * Math.cos(a2)},${y2 + size * Math.sin(a2)}`;
}
