import React from 'react';
import { ProcessedImage } from '../types';
import { Loader2, Target, CheckCircle2, AlertCircle, Maximize2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ImageGalleryProps {
  images: ProcessedImage[];
  onSelect: (image: ProcessedImage) => void;
  onRemove: (id: string) => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onSelect, onRemove }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      <AnimatePresence mode="popLayout">
        {images.map((img) => (
          <motion.div
            key={img.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="group relative glass rounded-2xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all"
          >
            {/* Image Preview */}
            <div className="aspect-video relative overflow-hidden bg-zinc-900">
              <img 
                src={img.originalUrl} 
                alt="Tactical Feed" 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              
              {/* Status Overlay */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {img.status === 'completed' ? (
                  <button 
                    onClick={() => onSelect(img)}
                    className="p-3 bg-blue-600 rounded-full text-white shadow-xl hover:scale-110 transition-transform"
                  >
                    <Maximize2 className="w-6 h-6" />
                  </button>
                ) : img.status === 'processing' ? (
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                ) : img.status === 'error' ? (
                  <AlertCircle className="w-8 h-8 text-red-500" />
                ) : (
                  <Target className="w-8 h-8 text-zinc-400" />
                )}
              </div>

              {/* Badge */}
              <div className="absolute top-3 left-3">
                {img.status === 'completed' && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 backdrop-blur-md rounded-lg border border-green-500/30 text-[10px] font-bold text-green-400 uppercase tracking-widest">
                    <CheckCircle2 className="w-3 h-3" />
                    Processed
                  </div>
                )}
                {img.status === 'processing' && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 backdrop-blur-md rounded-lg border border-blue-500/30 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Analyzing
                  </div>
                )}
              </div>

              {/* Remove Button */}
              <button 
                onClick={(e) => { e.stopPropagation(); onRemove(img.id); }}
                className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-red-600 rounded-full backdrop-blur-md text-white transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Info */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono text-zinc-500">ID: {img.id.slice(0, 8)}</p>
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                  {new Date(img.timestamp).toLocaleTimeString()}
                </p>
              </div>

              {img.status === 'completed' && img.counts && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(img.counts).map(([label, count]) => (
                    <span key={label} className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] font-medium text-zinc-400 capitalize">
                      {label}: {count}
                    </span>
                  ))}
                  {Object.keys(img.counts).length === 0 && (
                    <span className="text-[10px] text-zinc-600 italic">No assets detected</span>
                  )}
                </div>
              )}

              {img.status === 'error' && (
                <p className="text-[10px] text-red-500 font-medium truncate">{img.error}</p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
