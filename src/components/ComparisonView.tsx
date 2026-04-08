import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2, Layers, Sun, Moon, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProcessedImage, ViewMode, Detection } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ComparisonViewProps {
  image: ProcessedImage;
  onClose: () => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({ image, onClose }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const [isSliderDragging, setIsSliderDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(1, Math.min(2, prev + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const drawBoxes = useCallback((canvas: HTMLCanvasElement, img: HTMLImageElement, detections: Detection[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (viewMode === 'night') {
      // Night mode: Black background, white objects
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      detections.forEach(det => {
        const [ymin, xmin, ymax, xmax] = det.box_2d;
        const left = (xmin / 1000) * canvas.width;
        const top = (ymin / 1000) * canvas.height;
        const width = ((xmax - xmin) / 1000) * canvas.width;
        const height = ((ymax - ymin) / 1000) * canvas.height;

        ctx.fillStyle = 'white';
        ctx.fillRect(left, top, width, height);
      });
      return;
    }

    detections.forEach(det => {
      const [ymin, xmin, ymax, xmax] = det.box_2d;
      const left = (xmin / 1000) * canvas.width;
      const top = (ymin / 1000) * canvas.height;
      const width = ((xmax - xmin) / 1000) * canvas.width;
      const height = ((ymax - ymin) / 1000) * canvas.height;

      const colors: Record<string, string> = {
        'submarine': viewMode === 'thermal' ? '#ffeb3b' : '#06b6d4',
        'warship': viewMode === 'thermal' ? '#ff9800' : '#3b82f6',
        'tank': viewMode === 'thermal' ? '#f44336' : '#10b981',
        'aircraft': viewMode === 'thermal' ? '#e91e63' : '#f59e0b',
        'military vehicle': viewMode === 'thermal' ? '#ff5722' : '#ef4444',
      };
      const color = colors[det.label] || '#ffffff';

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(left, top, width, height);

      ctx.fillStyle = color;
      const label = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 10px Inter, sans-serif';
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(left, top - 15, textWidth + 6, 15);

      ctx.fillStyle = '#000000';
      ctx.fillText(label, left + 3, top - 4);
    });
  }, [viewMode]);

  useEffect(() => {
    if (image.detections && processedCanvasRef.current && imageRef.current) {
      drawBoxes(processedCanvasRef.current, imageRef.current, image.detections);
    }
  }, [image.detections, viewMode, drawBoxes]);

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSliderDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pos = ((x - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pos)));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col"
    >
      {/* Top Bar */}
      <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="font-bold">Tactical Comparison</h2>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">ID: {image.id.slice(0, 8)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1 bg-zinc-800 rounded-xl border border-zinc-700">
          <button 
            onClick={() => setViewMode('normal')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              viewMode === 'normal' ? "bg-blue-600 text-white" : "text-zinc-400 hover:bg-zinc-700"
            )}
          >
            <Sun className="w-4 h-4" />
            NORMAL
          </button>
          <button 
            onClick={() => setViewMode('thermal')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              viewMode === 'thermal' ? "bg-orange-600 text-white" : "text-zinc-400 hover:bg-zinc-700"
            )}
          >
            <Flame className="w-4 h-4" />
            THERMAL
          </button>
          <button 
            onClick={() => setViewMode('night')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              viewMode === 'night' ? "bg-green-600 text-black" : "text-zinc-400 hover:bg-zinc-700"
            )}
          >
            <Moon className="w-4 h-4" />
            NIGHT
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
            <button onClick={() => setZoom(prev => Math.max(1, prev - 0.1))} className="p-1 hover:text-blue-400"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-xs font-mono w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
            <button onClick={() => setZoom(prev => Math.min(2, prev + 0.1))} className="p-1 hover:text-blue-400"><ZoomIn className="w-4 h-4" /></button>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-zinc-800 hover:bg-red-600 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Comparison Area */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-black select-none"
        onMouseMove={(e) => { handleMouseMove(e); handleSliderMove(e); }}
        onMouseDown={handleMouseDown}
        onMouseUp={() => { handleMouseUp(); setIsSliderDragging(false); }}
        onMouseLeave={() => { handleMouseUp(); setIsSliderDragging(false); }}
        onWheel={handleWheel}
        onTouchMove={handleSliderMove}
      >
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {/* Original (Left) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img 
              src={image.originalUrl} 
              alt="Original" 
              className="max-w-full max-h-full object-contain opacity-50"
            />
            <div className="absolute top-8 left-8 px-3 py-1 bg-black/50 backdrop-blur-md rounded border border-white/10 text-[10px] font-bold tracking-widest uppercase">
              Original Feed
            </div>
          </div>

          {/* Processed (Right/Overlay) */}
          <div 
            className="absolute inset-0 flex items-center justify-center overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            <div className={cn(
              "relative w-full h-full flex items-center justify-center",
              viewMode === 'thermal' && "filter-thermal",
              viewMode === 'night' && "filter-night"
            )}>
              <img 
                ref={imageRef}
                src={image.originalUrl} 
                alt="Processed" 
                className="max-w-full max-h-full object-contain"
                onLoad={() => image.detections && drawBoxes(processedCanvasRef.current!, imageRef.current!, image.detections)}
              />
              {viewMode === 'night' && <div className="absolute inset-0 night-scanlines" />}
              <canvas 
                ref={processedCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>
            <div className="absolute top-8 left-8 px-3 py-1 bg-blue-600 rounded border border-blue-400 text-[10px] font-bold tracking-widest uppercase">
              Tactical Analysis
            </div>
          </div>

          {/* Slider Handle */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-50 group"
            style={{ left: `${sliderPos}%` }}
            onMouseDown={(e) => { e.stopPropagation(); setIsSliderDragging(true); }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110">
              <Maximize2 className="w-4 h-4 text-black rotate-45" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Info */}
      <div className="h-20 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-xl px-8 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Detections</p>
            <div className="flex gap-4">
              {Object.entries(image.counts || {}).map(([label, count]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium capitalize">{label}: {count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">System Status</p>
          <p className="text-green-500 text-sm font-bold">ACTIVE • ENHANCED FEED</p>
        </div>
      </div>
    </motion.div>
  );
};
