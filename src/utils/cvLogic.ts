/**
 * Classical Computer Vision Logic using OpenCV.js
 * No AI/ML models used.
 */

export interface CVParams {
  brightness: number;
  contrast: number;
  threshold: number;
  edgeLow: number;
  edgeHigh: number;
  morphSize: number;
  viewMode: 'normal' | 'night' | 'thermal';
}

export interface Detection {
  x: number;
  y: number;
  w: number;
  h: number;
}

declare const cv: any;

export const processImage = (
  sourceCanvas: HTMLCanvasElement,
  params: CVParams
): { processedDataUrl: string; detections: Detection[] } => {
  if (typeof cv === 'undefined' || !cv.Mat) {
    return { processedDataUrl: sourceCanvas.toDataURL(), detections: [] };
  }

  const src = cv.imread(sourceCanvas);
  const dst = new cv.Mat();
  
  // 1. Brightness and Contrast
  // dst = alpha * src + beta
  // alpha = contrast, beta = brightness
  src.convertTo(dst, -1, params.contrast, params.brightness);

  // 2. Grayscale
  const gray = new cv.Mat();
  cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY);

  // 3. Gaussian Blur
  const blurred = new cv.Mat();
  const ksize = new cv.Size(5, 5);
  cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);

  // 4. Adaptive Threshold / Binary
  const binary = new cv.Mat();
  cv.threshold(blurred, binary, params.threshold, 255, cv.THRESH_BINARY);

  // 5. Canny Edge Detection
  const edges = new cv.Mat();
  cv.Canny(blurred, edges, params.edgeLow, params.edgeHigh, 3, false);

  // 6. Morphological Operations
  const M = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(params.morphSize, params.morphSize));
  const morphed = new cv.Mat();
  cv.dilate(edges, morphed, M, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
  cv.erode(morphed, morphed, M, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());

  // 7. Find Contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const detections: Detection[] = [];
  for (let i = 0; i < contours.size(); ++i) {
    const cnt = contours.get(i);
    const rect = cv.boundingRect(cnt);
    // Filter small noise
    if (rect.width > 10 && rect.height > 10) {
      detections.push({ x: rect.x, y: rect.y, w: rect.width, h: rect.height });
    }
  }

  // 8. View Mode Processing
  const finalDst = new cv.Mat();
  if (params.viewMode === 'night') {
    // Night Recon: Black background, White objects
    // We can use the binary or morphed image
    cv.cvtColor(morphed, finalDst, cv.COLOR_GRAY2RGBA);
  } else if (params.viewMode === 'thermal') {
    // Thermal: Pseudo-color
    try {
      const thermal = new cv.Mat();
      cv.applyColorMap(gray, thermal, cv.COLORMAP_JET);
      cv.cvtColor(thermal, finalDst, cv.COLOR_BGR2RGBA);
      thermal.delete();
    } catch (e) {
      // Fallback if applyColorMap is not available
      cv.cvtColor(gray, finalDst, cv.COLOR_GRAY2RGBA);
      // We could do manual color mapping here if needed, 
      // but for now we'll just show grayscale as fallback
    }
  } else {
    // Normal
    dst.copyTo(finalDst);
  }

  // Create output canvas
  const outCanvas = document.createElement('canvas');
  cv.imshow(outCanvas, finalDst);
  const dataUrl = outCanvas.toDataURL();

  // Cleanup
  src.delete();
  dst.delete();
  gray.delete();
  blurred.delete();
  binary.delete();
  edges.delete();
  morphed.delete();
  contours.delete();
  hierarchy.delete();
  M.delete();
  finalDst.delete();

  return { processedDataUrl: dataUrl, detections };
};
