import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Shield, Check, AlertCircle, Loader2, Upload, Camera, X } from 'lucide-react';
import jsQR from 'jsqr';

import { QRAuthService } from '../services/QRAuthService';

interface QRScannerProps {
  onComplete: (username: string) => void;
  onCancel: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [status, setStatus] = useState<string>('Initializing Scanner...');
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('camera');

  useEffect(() => {
    if (scanMode !== 'camera') return;

    let stream: MediaStream | null = null;
    let animationFrame: number;

    const startCamera = async () => {
      try {
        setStatus('Accessing Camera...');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: 640, height: 480 } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsReady(true);
          setStatus('Align QR Code within the frame');
          requestAnimationFrame(scan);
        }
      } catch (err) {
        console.error(err);
        setError('Camera access denied.');
      }
    };

    const scan = () => {
      if (!videoRef.current || !canvasRef.current || isProcessing) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code) {
          handleDetectedToken(code.data);
          return;
        }
      }
      animationFrame = requestAnimationFrame(scan);
    };

    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      cancelAnimationFrame(animationFrame);
    };
  }, [scanMode, isProcessing]);

  const handleDetectedToken = (token: string) => {
    const username = QRAuthService.findUserByToken(token);
    
    if (username) {
      setIsProcessing(true);
      setStatus(`Đã phát hiện QR: ${username}`);
      setTimeout(() => onComplete(username), 1000);
    } else {
      setStatus('Mã QR không hợp lệ hoặc đã hết hạn');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          handleDetectedToken(code.data);
        } else {
          setError('No QR Code found in image.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="max-w-md w-full glass hud-border p-6 space-y-6 relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white">
              Tactical_QR_Scanner
            </h3>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setScanMode('camera')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${scanMode === 'camera' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
          >
            <Camera className="w-4 h-4" />
            Live Scan
          </button>
          <button 
            onClick={() => setScanMode('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${scanMode === 'upload' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
          >
            <Upload className="w-4 h-4" />
            Upload Image
          </button>
        </div>

        <div className="relative aspect-square bg-zinc-900 rounded-sm overflow-hidden border border-white/5">
          {scanMode === 'camera' ? (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover grayscale brightness-75"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {isReady && !isProcessing && (
                <div className="scanning-overlay">
                  <div className="scanning-frame !inset-16">
                    <div className="scanning-frame-corner top-0 left-0 border-t-2 border-l-2" />
                    <div className="scanning-frame-corner top-0 right-0 border-t-2 border-r-2" />
                    <div className="scanning-frame-corner bottom-0 left-0 border-b-2 border-l-2" />
                    <div className="scanning-frame-corner bottom-0 right-0 border-b-2 border-r-2" />
                    <div className="scanning-line-advanced" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-700 transition-colors border-2 border-dashed border-zinc-700"
              >
                <Upload className="w-8 h-8 text-zinc-500" />
              </div>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Select QR Image File</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileUpload}
              />
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-900/40"
              >
                <Check className="w-10 h-10 text-white" />
              </motion.div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-center">
            <span className={error ? 'text-red-500' : 'text-zinc-500'}>{status}</span>
          </div>

          {error && (
            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-sm flex items-center gap-3 text-red-400 text-xs font-mono">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-white/5 text-center">
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
            Secure QR Authentication // AES-256
          </p>
        </div>
      </div>
    </div>
  );
};
