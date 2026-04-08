export interface Detection {
  label: string;
  confidence: number;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
}

export interface DetectionResult {
  detections: Detection[];
}

export interface ProcessedImage {
  id: string;
  originalUrl: string;
  processedUrl?: string;
  detections?: Detection[];
  status: 'idle' | 'processing' | 'completed' | 'error';
  error?: string;
  counts?: Record<string, number>;
  timestamp: number;
}

export type ViewMode = 'normal' | 'thermal' | 'night';
