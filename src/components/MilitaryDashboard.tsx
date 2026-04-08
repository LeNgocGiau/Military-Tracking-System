import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Settings, 
  Eye, 
  Zap, 
  Maximize2, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RefreshCw,
  Layers,
  Activity,
  Shield,
  Crosshair,
  ChevronRight,
  ChevronLeft,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cvEngine, CVParams, Detection } from '../lib/cvEngine';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MilitaryDashboard: React.FC = () => {
  // State
  const [image, setImage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [params, setParams] = useState<CVParams>({
    brightness: 0,
    contrast: 1.0,
    cannyLow: 50,
    cannyHigh: 150,
    minArea: 500,
    blurSize: 5,
    viewMode: 'normal',
    resolutionScale: 1
  });
  
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [detections, setDetections] = useState<Detection[]>([]);
  const [processingTime, setProcessingTime] = useState(0);

  // Refs
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(null);

  // Initialize OpenCV
  useEffect(() => {
    const checkCV = setInterval(() => {
      if (cvEngine.isReady()) {
        setIsReady(true);
        clearInterval(checkCV);
      }
    }, 500);
    return () => clearInterval(checkCV);
  }, []);

  // Processing Loop
  const processImage = useCallback(() => {
    if (!isReady || !image || !sourceCanvasRef.current || !outputCanvasRef.current) return;

    const start = performance.now();
    const results = cvEngine.process(sourceCanvasRef.current, outputCanvasRef.current, params);
    const end = performance.now();
    
    setDetections(results);
    setProcessingTime(end - start);
    drawOverlay(results);
  }, [isReady, image, params]);

  // Draw Bounding Boxes Overlay
  const drawOverlay = (results: Detection[]) => {
    const canvas = overlayCanvasRef.current;
    const output = outputCanvasRef.current;
    if (!canvas || !output) return;

    canvas.width = output.width;
    canvas.height = output.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    results.forEach(det => {
      const { x, y, width, height } = det.rect;
      
      // Box
      ctx.strokeStyle = params.viewMode === 'night' ? '#ffffff' : '#00ff00';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([]);
      ctx.strokeRect(x, y, width, height);

      // Label
      ctx.fillStyle = params.viewMode === 'night' ? '#ffffff' : '#00ff00';
      ctx.font = `${12 / zoom}px JetBrains Mono, monospace`;
      const label = `ASSET_${det.area.toFixed(0)}`;
      ctx.fillText(label, x, y - 5);
      
      // Crosshair corners
      const len = 10 / zoom;
      ctx.beginPath();
      ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
      ctx.moveTo(x + width - len, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + len);
      ctx.moveTo(x + width, y + height - len); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width - len, y + height);
      ctx.moveTo(x + len, y + height); ctx.lineTo(x, y + height); ctx.lineTo(x, y + height - len);
      ctx.stroke();
    });
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = sourceCanvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        setImage(event.target?.result as string);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Zoom & Pan Logic
  const handleWheel = (e: React.WheelEvent) => {
    if (!image) return;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * delta, 0.5), 8);
    setZoom(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!image) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Trigger processing on param change
  useEffect(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(processImage);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [params, image, isReady, processImage]);

  const exportImage = () => {
    if (!outputCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'recon_analysis.png';
    link.href = outputCanvasRef.current.toDataURL();
    link.click();
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 320 : 0 }}
        className="relative bg-zinc-900 border-r border-zinc-800 flex-shrink-0 overflow-hidden"
      >
        <div className="w-80 p-6 space-y-8 overflow-y-auto h-full scrollbar-hide">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">RECON_AI</h1>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Tactical Analysis v2.4</p>
            </div>
          </div>

          {/* Controls */}
          <section className="space-y-6">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                <Layers className="w-3 h-3" /> Image Pre-processing
              </label>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono">
                  <span>BRIGHTNESS</span>
                  <span>{params.brightness}</span>
                </div>
                <input 
                  type="range" min="-100" max="100" value={params.brightness}
                  onChange={(e) => setParams(p => ({ ...p, brightness: parseInt(e.target.value) }))}
                  className="w-full accent-blue-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono">
                  <span>CONTRAST</span>
                  <span>{params.contrast.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="0.5" max="3.0" step="0.1" value={params.contrast}
                  onChange={(e) => setParams(p => ({ ...p, contrast: parseFloat(e.target.value) }))}
                  className="w-full accent-blue-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                <Zap className="w-3 h-3" /> Segmentation Engine
              </label>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono">
                  <span>CANNY_LOW</span>
                  <span>{params.cannyLow}</span>
                </div>
                <input 
                  type="range" min="0" max="255" value={params.cannyLow}
                  onChange={(e) => setParams(p => ({ ...p, cannyLow: parseInt(e.target.value) }))}
                  className="w-full accent-blue-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono">
                  <span>CANNY_HIGH</span>
                  <span>{params.cannyHigh}</span>
                </div>
                <input 
                  type="range" min="0" max="255" value={params.cannyHigh}
                  onChange={(e) => setParams(p => ({ ...p, cannyHigh: parseInt(e.target.value) }))}
                  className="w-full accent-blue-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                <Crosshair className="w-3 h-3" /> Object Filtering
              </label>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-mono">
                  <span>MIN_AREA_PX</span>
                  <span>{params.minArea}</span>
                </div>
                <input 
                  type="range" min="100" max="5000" step="100" value={params.minArea}
                  onChange={(e) => setParams(p => ({ ...p, minArea: parseInt(e.target.value) }))}
                  className="w-full accent-blue-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <button 
                onClick={exportImage}
                className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-all border border-zinc-700"
              >
                <Download className="w-4 h-4" /> Export Intelligence
              </button>
              
              <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-500 font-mono">LATENCY</span>
                  <span className="text-[10px] text-blue-400 font-mono">{processingTime.toFixed(1)}ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-500 font-mono">ASSETS_FOUND</span>
                  <span className="text-[10px] text-blue-400 font-mono">{detections.length}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </motion.aside>

      {/* Main Viewport */}
      <main className="flex-1 relative flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-xl z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
            <div className="h-4 w-[1px] bg-zinc-800" />
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setParams(p => ({ ...p, viewMode: 'normal' }))}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest transition-all",
                  params.viewMode === 'normal' ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                NORMAL
              </button>
              <button 
                onClick={() => setParams(p => ({ ...p, viewMode: 'night' }))}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest transition-all",
                  params.viewMode === 'night' ? "bg-zinc-100 text-black" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                NIGHT_RECON
              </button>
              <button 
                onClick={() => setParams(p => ({ ...p, viewMode: 'thermal' }))}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest transition-all",
                  params.viewMode === 'thermal' ? "bg-orange-500 text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                THERMAL
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1">
              <button onClick={() => setZoom(z => Math.max(z - 0.5, 0.5))} className="p-1.5 hover:bg-zinc-800 rounded-md"><ZoomOut className="w-4 h-4" /></button>
              <span className="text-[10px] font-mono w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
              <button onClick={() => setZoom(z => Math.min(z + 0.5, 8))} className="p-1.5 hover:bg-zinc-800 rounded-md"><ZoomIn className="w-4 h-4" /></button>
            </div>
            <button 
              onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Canvas Area */}
        <div 
          ref={containerRef}
          className="flex-1 relative bg-zinc-950 overflow-hidden cursor-crosshair"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {!image ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12">
              <div className="w-full max-w-xl p-12 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center gap-6 bg-zinc-900/20 backdrop-blur-sm">
                <div className="p-6 bg-blue-600/10 rounded-full">
                  <Upload className="w-12 h-12 text-blue-500" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold">Initialize Recon Feed</h3>
                  <p className="text-zinc-500 text-sm">Drag and drop satellite imagery or tactical photos</p>
                </div>
                <button 
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                >
                  Select Tactical Asset
                </button>
                <input 
                  id="file-upload"
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </div>
              
              <div className="mt-12 grid grid-cols-3 gap-8 w-full max-w-3xl">
                {[
                  { icon: Activity, label: "Live Processing", desc: "Classical CV Pipeline" },
                  { icon: Target, label: "Asset Isolation", desc: "Morphological Segmentation" },
                  { icon: Maximize2, label: "4K Upscaling", desc: "Bilinear Interpolation" }
                ].map((item, i) => (
                  <div key={i} className="text-center space-y-2">
                    <div className="mx-auto w-10 h-10 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-800">
                      <item.icon className="w-5 h-5 text-zinc-400" />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">{item.label}</h4>
                    <p className="text-[10px] text-zinc-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div 
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              <div className="relative shadow-2xl shadow-black/50">
                <canvas ref={outputCanvasRef} className="block max-w-none" />
                <canvas ref={overlayCanvasRef} className="absolute inset-0 block max-w-none" />
              </div>
            </div>
          )}

          {/* Hidden Source Canvas */}
          <canvas ref={sourceCanvasRef} className="hidden" />

          {/* HUD Overlays */}
          <AnimatePresence>
            {image && (
              <>
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="absolute top-6 right-6 p-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl z-10 pointer-events-none"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold tracking-widest text-white">LIVE_FEED_ACTIVE</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[24px] font-mono font-bold text-white tracking-tighter">
                      {detections.length.toString().padStart(2, '0')}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">OBJECTS_DETECTED</div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-6 left-6 p-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl z-10 pointer-events-none font-mono text-[10px]"
                >
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                    <span className="text-zinc-500">RES:</span>
                    <span className="text-white">{sourceCanvasRef.current?.width}x{sourceCanvasRef.current?.height}</span>
                    <span className="text-zinc-500">FPS:</span>
                    <span className="text-white">{(1000 / Math.max(processingTime, 16)).toFixed(0)}</span>
                    <span className="text-zinc-500">ZOOM:</span>
                    <span className="text-white">{zoom.toFixed(1)}x</span>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Loading Overlay */}
        {!isReady && (
          <div className="absolute inset-0 bg-zinc-950 z-50 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold">Initializing OpenCV.js</h2>
              <p className="text-zinc-500 text-sm">Loading tactical computer vision modules...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
