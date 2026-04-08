import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Shield, Check, AlertCircle, Loader2 } from 'lucide-react';
import { FaceAuthService } from '../services/FaceAuthService';

interface FaceScannerProps {
  mode: 'enroll' | 'verify';
  username?: string;
  onComplete: (descriptor?: Float32Array, matchedUsername?: string) => void;
  onCancel: () => void;
}

export const FaceScanner: React.FC<FaceScannerProps> = ({ mode, username, onComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<string>('Initializing Camera...');
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setStatus('Loading AI Models...');
        await FaceAuthService.loadModels();
        
        setStatus('Accessing Camera...');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: 640, height: 480 } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsReady(true);
          setStatus(mode === 'enroll' ? 'Position your face in the frame' : 'Verifying Identity...');
        }
      } catch (err) {
        console.error(err);
        setError('Camera access denied or models failed to load.');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mode]);

  const [hasBlinked, setHasBlinked] = useState(false);

  useEffect(() => {
    if (!isReady || isProcessing) return;

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const runDetection = async () => {
      if (!videoRef.current || !isMounted) return;

      try {
        const detection = await FaceAuthService.getFaceDescriptor(videoRef.current);
        
        if (detection && isMounted) {
          const descriptor = detection.descriptor;
          const landmarks = detection.landmarks;

          // Liveness check: Blink detection
          if (mode === 'verify' && !hasBlinked) {
            const blinking = FaceAuthService.checkBlink(landmarks);
            if (blinking) {
              setHasBlinked(true);
              setStatus('Blink detected! Verifying...');
            } else {
              setStatus('Please blink to verify liveness');
              timeoutId = setTimeout(runDetection, 100);
              return;
            }
          }

          if (mode === 'enroll') {
            setProgress(prev => {
              const next = prev + 10;
              if (next >= 100) {
                setIsProcessing(true);
                setStatus('Face Enrolled Successfully');
                setTimeout(() => onComplete(descriptor), 1000);
              }
              return next;
            });
            setStatus('Capturing biometric data... Keep still');
          } else {
            // Verification logic
            let matchedUser: string | null = null;

            if (username) {
              const storedDescriptor = FaceAuthService.getStoredDescriptor(username);
              if (storedDescriptor) {
                const distance = FaceAuthService.compareFaces(descriptor, storedDescriptor);
                if (FaceAuthService.isMatch(distance)) matchedUser = username;
              }
            } else {
              const allFaceData = FaceAuthService.getAllFaceData();
              for (const data of allFaceData) {
                const distance = FaceAuthService.compareFaces(descriptor, data.descriptor);
                if (FaceAuthService.isMatch(distance)) {
                  matchedUser = data.username;
                  break;
                }
              }
            }

            if (matchedUser) {
              setIsProcessing(true);
              setStatus(`Identity Verified: ${matchedUser}`);
              setTimeout(() => onComplete(undefined, matchedUser!), 1000);
              return; // Stop loop
            } else {
              setStatus(username ? 'Face not recognized. Try again.' : 'No matching operator found.');
            }
          }
        } else if (isMounted) {
          setStatus('No face detected. Adjust position.');
        }
      } catch (err) {
        console.error(err);
      }

      if (isMounted && !isProcessing) {
        timeoutId = setTimeout(runDetection, 300);
      }
    };

    runDetection();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isReady, isProcessing, mode, username, onComplete, hasBlinked]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="max-w-md w-full glass hud-border p-6 space-y-6 relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white">
              {mode === 'enroll' ? 'Biometric_Enrollment' : 'Biometric_Verification'}
            </h3>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white text-xs font-mono uppercase">Cancel</button>
        </div>

        <div className="relative aspect-video bg-zinc-900 rounded-sm overflow-hidden border border-white/5">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full object-cover grayscale brightness-75"
          />
          
          {/* Scanning Animation */}
          {isReady && !isProcessing && (
            <>
              <div className="scanning-overlay">
                <div className="scanning-frame !inset-12">
                  <div className="scanning-frame-corner top-0 left-0 border-t-2 border-l-2" />
                  <div className="scanning-frame-corner top-0 right-0 border-t-2 border-r-2" />
                  <div className="scanning-frame-corner bottom-0 left-0 border-b-2 border-l-2" />
                  <div className="scanning-frame-corner bottom-0 right-0 border-b-2 border-r-2" />
                  <div className="scanning-line-advanced" />
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-blue-500/20 rounded-full animate-pulse" />
              </div>
            </>
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

          {!isReady && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{status}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
            <span className={error ? 'text-red-500' : 'text-zinc-500'}>{status}</span>
            {mode === 'enroll' && <span className="text-blue-500">{progress}%</span>}
          </div>
          
          {mode === 'enroll' && (
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-blue-600"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-sm flex items-center gap-3 text-red-400 text-xs font-mono">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'verify' && !hasBlinked && isReady && (
            <button 
              onClick={() => setHasBlinked(true)}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-sm text-[10px] text-zinc-400 uppercase tracking-widest transition-colors"
            >
              Cannot blink? Skip verification
            </button>
          )}
        </div>

        <div className="pt-4 border-t border-white/5 text-center">
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
            {mode === 'enroll' ? 'Biometric data encrypted & stored locally' : 'Awaiting facial recognition match'}
          </p>
        </div>
      </div>
    </div>
  );
};
