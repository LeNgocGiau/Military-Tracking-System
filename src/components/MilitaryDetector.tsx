import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader2, Target, Download, FileJson, Camera, AlertCircle, Maximize2, Sun, Contrast, RotateCcw, Eye, EyeOff, Shield, Activity, Crosshair, LayoutGrid } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Detection {
  label: string;
  confidence: number;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
}

interface DetectionResult {
  detections: Detection[];
}

const GENAI_API_KEY = process.env.GEMINI_API_KEY || '';

export const MilitaryDetector: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);
  const [results, setResults] = useState<Detection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [viewMode, setViewMode] = useState<'normal' | 'thermal' | 'night' | 'recon'>('normal');
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [showOriginal, setShowOriginal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeFilter, setActiveFilter] = useState<{ type: 'all' | 'category' | 'individual', value?: string | number }>({ type: 'all' });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const popupCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const popupImageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    setError(null);
    setResults(null);
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const analyzeImage = async () => {
    if (!image || !GENAI_API_KEY) {
      if (!GENAI_API_KEY) setError('Gemini API Key is missing. Please check your environment variables.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const genAI = new GoogleGenAI({ apiKey: GENAI_API_KEY });
      
      // Convert base64 to parts
      const base64Data = image.split(',')[1];

      const prompt = `Analyze this tactical imagery with extreme precision. 
      Detect ALL military objects, including very small ones that might be easily missed.
      
      Classify each object into one of these categories:
      - 'warship': armed naval vessels (destroyers, frigates, corvettes, patrol boats)
      - 'submarine': military underwater vessels
      - 'civilian_vessel': cargo ships, tankers, fishing boats, yachts, ferries
      - 'military_aircraft': fighter jets, bombers, military transport planes, attack helicopters
      - 'civilian_aircraft': commercial airliners, private jets, general aviation planes
      - 'tank': main battle tanks, light tanks
      - 'military_vehicle': tactical trucks, APCs, mobile artillery
      - 'dock': port infrastructure
      
      CRITICAL INSTRUCTION:
      - Distinguish carefully between military and civilian versions of ships and aircraft.
      - Provide the absolute MINIMUM axis-aligned bounding box (box_2d) [ymin, xmin, ymax, xmax] normalized (0-1000).
      
      Return ONLY a JSON object:
      {
        "detections": [
          { 
            "label": "warship", 
            "confidence": 0.95, 
            "box_2d": [ymin, xmin, ymax, xmax] 
          }
        ]
      }
      Note: box_2d coordinates must be normalized (0-1000).`;

      const result = await (genAI as any).models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
          ]
        },
        config: {
          responseMimeType: 'application/json'
        }
      });
      
      const text = result.text;
      
      // Extract JSON from response (sometimes Gemini wraps it in markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data: DetectionResult = JSON.parse(jsonMatch[0]);
        setResults(data.detections);
        setShowSuccessFlash(true);
        setTimeout(() => setShowSuccessFlash(false), 800);
      } else {
        throw new Error('Failed to parse detection results.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        setError('API Quota exceeded. Please wait a moment before trying again.');
      } else {
        setError(err.message || 'An error occurred during analysis.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const drawBoundingBoxes = (targetCanvas?: HTMLCanvasElement | null, targetImage?: HTMLImageElement | null, isOriginal?: boolean) => {
    const canvas = targetCanvas || canvasRef.current;
    const img = targetImage || imageRef.current;
    if (!canvas || !img || !results || isOriginal) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size for high resolution (2K/4K simulation on high-DPI screens)
    canvas.width = img.clientWidth * dpr;
    canvas.height = img.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, img.clientWidth, img.clientHeight);

    const filteredResults = results.filter((det, index) => {
      if (activeFilter.type === 'all') return true;
      if (activeFilter.type === 'category') return det.label === activeFilter.value;
      if (activeFilter.type === 'individual') return index === activeFilter.value;
      return true;
    });

    // In tactical modes, dim the background first
    if (viewMode !== 'normal') {
      let dimColor = 'rgba(0, 0, 0, 0.7)';
      if (viewMode === 'night') dimColor = 'rgba(0, 20, 0, 0.65)';
      if (viewMode === 'recon') dimColor = 'rgba(0, 0, 0, 0.88)';
      
      ctx.fillStyle = dimColor;
      ctx.fillRect(0, 0, img.clientWidth, img.clientHeight);
    }

    filteredResults.forEach((det) => {
      const [ymin, xmin, ymax, xmax] = det.box_2d;
      const isMilitary = ['warship', 'submarine', 'military_aircraft', 'tank', 'military_vehicle'].includes(det.label);
      const isNaval = ['warship', 'submarine', 'civilian_vessel'].includes(det.label);
      const isDock = det.label === 'dock';
      
      // Convert normalized 0-1000 to pixel coordinates
      const left = (xmin / 1000) * img.clientWidth;
      const top = (ymin / 1000) * img.clientHeight;
      const width = ((xmax - xmin) / 1000) * img.clientWidth;
      const height = ((ymax - ymin) / 1000) * img.clientHeight;

      // In tactical modes, "punch a hole" for military/naval objects
      if (viewMode !== 'normal' && (isMilitary || isNaval)) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'white';
        ctx.fillRect(left, top, width, height);
        ctx.restore();
      }

      // Set style based on label and view mode
      let color = '#ffffff';
      let opacity = 1;

      if (viewMode === 'night') {
        color = isMilitary ? '#00ff00' : (isNaval ? '#00aa00' : (isDock ? '#002200' : '#004400'));
        opacity = isMilitary ? 1 : 0.5;
      } else if (viewMode === 'thermal') {
        color = isMilitary ? '#ff3300' : (isNaval ? '#aa2200' : (isDock ? '#220000' : '#441100'));
        opacity = isMilitary ? 1 : 0.5;
      } else if (viewMode === 'recon') {
        color = isMilitary ? '#ffffff' : (isNaval ? '#888888' : (isDock ? '#222222' : '#444444'));
        opacity = isMilitary ? 1 : 0.3;
      } else {
        const colors: Record<string, string> = {
          'submarine': '#06b6d4',
          'warship': '#3b82f6',
          'civilian_vessel': '#10b981',
          'tank': '#8b5cf6',
          'military_aircraft': '#f59e0b',
          'civilian_aircraft': '#14b8a6',
          'military_vehicle': '#ef4444',
          'dock': '#71717a'
        };
        color = colors[det.label] || '#ffffff';
      }

      ctx.globalAlpha = opacity;

      // Draw box
      ctx.strokeStyle = color;
      const lineWidth = isNaval ? Math.max(2, Math.min(5, img.clientWidth / 250)) : 1;
      ctx.lineWidth = lineWidth;
      
      if (isNaval && viewMode !== 'normal') {
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.setLineDash(viewMode === 'night' ? [5, 5] : []);
      ctx.strokeRect(left, top, width, height);

      // Draw label background
      ctx.fillStyle = color;
      const label = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      const fontSize = Math.max(10, Math.min(14, img.clientWidth / 100));
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      const textWidth = ctx.measureText(label).width;
      
      ctx.shadowBlur = 0; 
      ctx.fillRect(left, top - fontSize - 6, textWidth + 10, fontSize + 6);

      // Draw label text
      ctx.fillStyle = (viewMode === 'normal' || !isNaval) ? '#000000' : '#ffffff';
      ctx.globalAlpha = 1;
      ctx.fillText(label, left + 5, top - 6);
      
      ctx.globalAlpha = 1;
    });
  };

  useEffect(() => {
    if (results) {
      drawBoundingBoxes();
      if (isPopupOpen) {
        setTimeout(() => drawBoundingBoxes(popupCanvasRef.current, popupImageRef.current, showOriginal), 50);
      }
    }
  }, [results, viewMode, isPopupOpen, showOriginal, activeFilter]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!isPopupOpen) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoomLevel(prev => Math.min(Math.max(prev * delta, 0.5), 10));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isPopupOpen) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !isPopupOpen) return;
    setPanPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetZoom = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const getTacticalFilter = (mode: string) => {
    const manual = `brightness(${100 + brightness}%) contrast(${contrast})`;
    switch (mode) {
      case 'thermal':
        return `grayscale(1) contrast(1.5) brightness(1.1) sepia(1) hue-rotate(-50deg) saturate(15) ${manual}`;
      case 'recon':
        return `grayscale(1) contrast(2.5) brightness(0.8) ${manual}`;
      case 'night':
        return `grayscale(1) sepia(1) hue-rotate(70deg) saturate(5) brightness(1.1) contrast(1.3) ${manual}`;
      default:
        return manual;
    }
  };

  // Redraw on window resize
  useEffect(() => {
    const handleResize = () => {
      if (results) drawBoundingBoxes();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [results]);

  const counts = results?.reduce((acc, det) => {
    acc[det.label] = (acc[det.label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const downloadAnnotatedImage = () => {
    if (!canvasRef.current || !imageRef.current) return;
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const img = imageRef.current;
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;

    // Draw original image
    tempCtx.drawImage(img, 0, 0);

    // Draw boxes scaled to natural size
    if (results) {
      results.forEach((det) => {
        const [ymin, xmin, ymax, xmax] = det.box_2d;
        const left = (xmin / 1000) * tempCanvas.width;
        const top = (ymin / 1000) * tempCanvas.height;
        const width = ((xmax - xmin) / 1000) * tempCanvas.width;
        const height = ((ymax - ymin) / 1000) * tempCanvas.height;

        const colors: Record<string, string> = {
          'submarine': '#06b6d4',
          'warship': '#3b82f6',
          'civilian_vessel': '#10b981',
          'tank': '#8b5cf6',
          'military_aircraft': '#f59e0b',
          'civilian_aircraft': '#14b8a6',
          'military_vehicle': '#ef4444',
          'dock': '#71717a'
        };
        const color = colors[det.label] || '#ffffff';

        tempCtx.strokeStyle = color;
        tempCtx.lineWidth = Math.max(4, tempCanvas.width / 200);
        tempCtx.strokeRect(left, top, width, height);

        tempCtx.fillStyle = color;
        const label = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
        const fontSize = Math.max(16, tempCanvas.width / 80);
        tempCtx.font = `bold ${fontSize}px Inter, sans-serif`;
        const textWidth = tempCtx.measureText(label).width;
        tempCtx.fillRect(left, top - fontSize - 10, textWidth + 10, fontSize + 10);

        tempCtx.fillStyle = '#000000';
        tempCtx.fillText(label, left + 5, top - 8);
      });
    }

    const link = document.createElement('a');
    link.download = 'military-detection-result.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  };

  const exportJson = () => {
    if (!results) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ detections: results, counts }, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "detection-results.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 font-sans">
      {/* Left: Tactical Viewport */}
      <div className="lg:col-span-3 space-y-6">
        <div 
          className={cn(
            "relative min-h-[500px] rounded-sm border transition-all flex flex-col items-center justify-center p-1 overflow-hidden hud-border",
            dragActive ? "border-blue-500 bg-blue-500/5" : "border-zinc-800 bg-black/40",
            image ? "border-zinc-700" : ""
          )}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {/* HUD Decorative Elements */}
          <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em] pointer-events-none">
            <Activity className="w-3 h-3" />
            <span>System.Active // Tactical_Feed</span>
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-2 text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em] pointer-events-none">
            <span>Lat: 34.0522 N // Lon: 118.2437 W</span>
          </div>

          {!image ? (
            <div className="text-center space-y-6 py-20">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 border border-blue-500/20 rounded-full animate-pulse" />
                <div className="absolute inset-2 border border-blue-500/40 rounded-full animate-ping" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Upload className="w-10 h-10 text-blue-500" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xl font-bold uppercase tracking-widest text-white">Đang chờ nguồn cấp dữ liệu chiến thuật</p>
                <p className="text-xs font-mono text-zinc-500 uppercase">Thả hình ảnh hoặc chọn nguồn để bắt đầu phân tích</p>
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary"
              >
                Initialize Source
              </button>
              <input 
                id="tactical-upload-trigger"
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center bg-black/20">
              {/* Advanced Scanning Overlay */}
              <AnimatePresence>
                {isAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="scanning-overlay"
                  >
                    <div className="scanning-frame">
                      {/* Frame Corners */}
                      <div className="scanning-frame-corner top-0 left-0 border-t-2 border-l-2" />
                      <div className="scanning-frame-corner top-0 right-0 border-t-2 border-r-2" />
                      <div className="scanning-frame-corner bottom-0 left-0 border-b-2 border-l-2" />
                      <div className="scanning-frame-corner bottom-0 right-0 border-b-2 border-r-2" />
                      
                      {/* Moving Scan Line */}
                      <div className="scanning-line-advanced" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success Flash Effect */}
              <div className={cn(
                "absolute inset-0 z-40 pointer-events-none transition-colors duration-500",
                showSuccessFlash ? "bg-emerald-500/20" : "bg-transparent"
              )} />
              
              <div className="relative inline-block max-w-full max-h-full p-4">
                {/* Corner Brackets for Image */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-blue-500/40" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-blue-500/40" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-blue-500/40" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-blue-500/40" />

                <div 
                  className="relative overflow-hidden cursor-zoom-in group"
                  style={{ filter: getTacticalFilter(viewMode) }}
                  onClick={() => setIsPopupOpen(true)}
                >
                  <img 
                    ref={imageRef}
                    src={image} 
                    alt="Tactical Feed" 
                    className="max-w-full max-h-[700px] block object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                    onLoad={() => results && drawBoundingBoxes()}
                  />
                  {viewMode === 'night' && (
                    <>
                      <div className="absolute inset-0 night-scanlines" />
                      <div className="absolute inset-0 night-overlay" />
                    </>
                  )}
                  <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full">
                      <Maximize2 className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                
                <canvas 
                  ref={canvasRef}
                  className="absolute top-4 left-4 w-[calc(100%-32px)] h-[calc(100%-32px)] pointer-events-none"
                />
              </div>
              
              {/* View Mode Controls - HUD Style */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-black/80 backdrop-blur-xl rounded-sm border border-zinc-800 shadow-2xl z-10">
                {(['normal', 'thermal', 'night', 'recon'] as const).map((mode) => (
                  <button 
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "px-4 py-1.5 text-[10px] font-bold transition-all uppercase tracking-tighter",
                      viewMode === mode 
                        ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => { setImage(null); setResults(null); }}
                className="absolute top-6 right-6 p-2 bg-black/60 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 border border-white/5 rounded-sm backdrop-blur-md transition-all z-10"
                title="Clear Feed"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Tactical Adjustments - Bento Style */}
        {image && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-sm p-5 space-y-4 hud-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Sun className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Luminance_Offset</span>
                </div>
                <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-sm">
                  {brightness > 0 ? `+${brightness}` : brightness}
                </span>
              </div>
              <input 
                type="range" 
                min="-100" 
                max="100" 
                value={brightness} 
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-none appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div className="glass rounded-sm p-5 space-y-4 hud-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Contrast className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Signal_Contrast</span>
                </div>
                <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-sm">
                  {contrast.toFixed(1)}x
                </span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1"
                value={contrast} 
                onChange={(e) => setContrast(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-none appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        )}

        {image && !results && !isAnalyzing && (
          <div className="flex justify-center pt-4">
            <button 
              onClick={analyzeImage}
              className="btn-primary px-12 py-4 flex items-center gap-3 text-base group"
            >
              <Crosshair className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
              Execute Tactical Scan
            </button>
          </div>
        )}

        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-16 space-y-6 glass rounded-sm hud-border">
            <div className="relative">
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin opacity-20" />
              <Target className="absolute inset-0 w-16 h-16 text-blue-500 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-bold uppercase tracking-[0.3em] text-white animate-pulse">Scanning_In_Progress</p>
              <p className="text-[10px] font-mono text-zinc-500 uppercase">Gemini Neural Engine // Object_Detection_Active</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-sm flex items-start gap-3 text-red-400 hud-border !border-red-500/30">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider">System_Error</p>
              <p className="text-xs font-mono opacity-80">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Intelligence Panel */}
      <div className="space-y-6">
        <div className="glass rounded-sm p-6 space-y-6 hud-border">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" />
              <h3 className="font-bold text-sm uppercase tracking-[0.2em]">Intel_Report</h3>
            </div>
            {results && (
              <button 
                onClick={() => setActiveFilter({ type: 'all' })}
                className={cn(
                  "text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm transition-all border",
                  activeFilter.type === 'all' 
                    ? "bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.3)]" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                )}
              >
                Reset_View
              </button>
            )}
          </div>

          {!results ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-12 h-12 border border-zinc-800 rounded-sm flex items-center justify-center mx-auto text-zinc-700">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <p className="text-zinc-600 text-[10px] font-mono uppercase tracking-wider leading-relaxed">
                Awaiting imagery data<br/>for tactical processing
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Summary Counts - Two Columns */}
              <div className="grid grid-cols-2 gap-4">
                {/* Military Column */}
                <div className="space-y-2">
                  <h4 className="text-[9px] font-bold text-blue-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Military_Assets
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(counts || {})
                      .filter(([label]) => ['warship', 'submarine', 'military_aircraft', 'tank', 'military_vehicle'].includes(label))
                      .map(([label, count]) => (
                        <button 
                          key={label} 
                          onClick={() => setActiveFilter(
                            activeFilter.type === 'category' && activeFilter.value === label 
                              ? { type: 'all' } 
                              : { type: 'category', value: label }
                          )}
                          className={cn(
                            "p-2.5 rounded-sm border transition-all text-left group relative overflow-hidden",
                            activeFilter.type === 'category' && activeFilter.value === label 
                              ? "bg-blue-600/10 border-blue-500/50" 
                              : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
                          )}
                        >
                          <p className={cn(
                            "text-[8px] uppercase font-bold mb-0.5 tracking-wider transition-colors",
                            activeFilter.type === 'category' && activeFilter.value === label ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-400"
                          )}>{label.replace('_', ' ')}</p>
                          <p className="text-lg font-mono font-bold">{count.toString().padStart(2, '0')}</p>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Civilian Column */}
                <div className="space-y-2">
                  <h4 className="text-[9px] font-bold text-emerald-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <Activity className="w-3 h-3" /> Civilian_Assets
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(counts || {})
                      .filter(([label]) => ['civilian_vessel', 'civilian_aircraft', 'dock'].includes(label))
                      .map(([label, count]) => (
                        <button 
                          key={label} 
                          onClick={() => setActiveFilter(
                            activeFilter.type === 'category' && activeFilter.value === label 
                              ? { type: 'all' } 
                              : { type: 'category', value: label }
                          )}
                          className={cn(
                            "p-2.5 rounded-sm border transition-all text-left group relative overflow-hidden",
                            activeFilter.type === 'category' && activeFilter.value === label 
                              ? "bg-emerald-600/10 border-emerald-500/50" 
                              : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
                          )}
                        >
                          <p className={cn(
                            "text-[8px] uppercase font-bold mb-0.5 tracking-wider transition-colors",
                            activeFilter.type === 'category' && activeFilter.value === label ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-400"
                          )}>{label.replace('_', ' ')}</p>
                          <p className="text-lg font-mono font-bold">{count.toString().padStart(2, '0')}</p>
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              {/* Detailed List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Target_Manifest</h4>
                  <span className="text-[9px] font-mono text-zinc-600">Count: {results.length}</span>
                </div>
                <div className="max-h-[400px] overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
                  {results.map((det, i) => (
                    <button 
                      key={i} 
                      onClick={() => setActiveFilter(
                        activeFilter.type === 'individual' && activeFilter.value === i 
                          ? { type: 'all' } 
                          : { type: 'individual', value: i }
                      )}
                      className={cn(
                        "w-full flex items-center justify-between p-2.5 rounded-sm border transition-all text-left group",
                        activeFilter.type === 'individual' && activeFilter.value === i 
                          ? "bg-blue-600/10 border-blue-500/50" 
                          : "bg-zinc-900/20 border-zinc-900 hover:border-zinc-800"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]",
                          det.label === 'submarine' && "text-cyan-500 bg-cyan-500",
                          det.label === 'warship' && "text-blue-500 bg-blue-500",
                          det.label === 'civilian_vessel' && "text-emerald-500 bg-emerald-500",
                          det.label === 'tank' && "text-violet-500 bg-violet-500",
                          det.label === 'military_aircraft' && "text-amber-500 bg-amber-500",
                          det.label === 'civilian_aircraft' && "text-teal-500 bg-teal-500",
                          det.label === 'military_vehicle' && "text-red-500 bg-red-500",
                          det.label === 'dock' && "text-zinc-500 bg-zinc-500",
                        )} />
                        <span className={cn(
                          "text-xs font-bold uppercase tracking-tight transition-colors",
                          activeFilter.type === 'individual' && activeFilter.value === i ? "text-blue-400" : "text-zinc-400 group-hover:text-zinc-200"
                        )}>{det.label.replace('_', ' ')}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-600 group-hover:text-zinc-400">
                        {(det.confidence * 100).toFixed(0)}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-6 border-t border-white/5 space-y-3">
                <button 
                  onClick={downloadAnnotatedImage}
                  className="w-full btn-secondary flex items-center justify-center gap-2 py-3"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export_Imagery
                </button>
                <button 
                  onClick={exportJson}
                  className="w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-blue-400 text-[10px] font-bold uppercase tracking-widest transition-all"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  Data_Stream.json
                </button>
              </div>
            </div>
          )}
        </div>

        {/* System Status Card */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-sm p-6 hud-border">
          <div className="flex items-center gap-3 mb-4 text-blue-500/60">
            <Activity className="w-4 h-4" />
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">System_Status</h4>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-[9px] font-mono">
              <span className="text-zinc-600">Neural_Engine:</span>
              <span className="text-emerald-500">OPTIMIZED</span>
            </div>
            <div className="flex justify-between text-[9px] font-mono">
              <span className="text-zinc-600">Encryption:</span>
              <span className="text-emerald-500">AES-256</span>
            </div>
            <div className="flex justify-between text-[9px] font-mono">
              <span className="text-zinc-600">Uplink:</span>
              <span className="text-blue-500">STABLE</span>
            </div>
          </div>
        </div>
      </div>
      {/* Tactical Popup Viewer */}
      <AnimatePresence>
        {isPopupOpen && image && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold tracking-tight">Tactical Viewer</h2>
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-full">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Zoom</span>
                  <span className="text-xs font-mono text-blue-400">{(zoomLevel * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowOriginal(!showOriginal)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                    showOriginal ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                  )}
                >
                  {showOriginal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showOriginal ? "Show Tactical" : "Show Original"}
                </button>
                <button 
                  onClick={resetZoom}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsPopupOpen(false)}
                  className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-all text-zinc-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Viewer Area */}
            <div 
              className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <motion.div 
                className="absolute inset-0 flex items-center justify-center p-8"
                style={{
                  x: panPosition.x,
                  y: panPosition.y,
                  scale: zoomLevel,
                }}
              >
                <div className="relative inline-block shadow-2xl shadow-black/50">
                  <div 
                    className="relative overflow-hidden rounded-lg"
                    style={{ filter: showOriginal ? 'none' : getTacticalFilter(viewMode) }}
                  >
                    <img 
                      ref={popupImageRef}
                      src={image} 
                      alt="Tactical Zoom" 
                      className="max-w-full max-h-[85vh] block object-contain select-none pointer-events-none"
                      onLoad={() => results && drawBoundingBoxes(popupCanvasRef.current, popupImageRef.current, showOriginal)}
                    />
                    {!showOriginal && viewMode === 'night' && (
                      <>
                        <div className="absolute inset-0 night-scanlines" />
                        <div className="absolute inset-0 night-overlay" />
                      </>
                    )}
                  </div>
                  <canvas 
                    ref={popupCanvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  />
                </div>
              </motion.div>

              {/* Zoom Instructions */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-400 pointer-events-none">
                Scroll to Zoom • Drag to Pan
              </div>
            </div>

            {/* Footer Controls */}
            <div className="p-6 border-t border-white/10 bg-zinc-900/50">
              <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Sun className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Brightness</span>
                    </div>
                    <span className="text-xs font-mono text-blue-400">{brightness > 0 ? `+${brightness}` : brightness}</span>
                  </div>
                  <input 
                    type="range" 
                    min="-100" 
                    max="100" 
                    value={brightness} 
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Contrast className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Contrast</span>
                    </div>
                    <span className="text-xs font-mono text-blue-400">{contrast.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.1"
                    value={contrast} 
                    onChange={(e) => setContrast(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
