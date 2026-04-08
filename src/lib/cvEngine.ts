/**
 * CVEngine.ts
 * High-performance Computer Vision wrapper for Military Reconnaissance.
 * Uses OpenCV.js for classical image processing.
 */

export interface CVParams {
  brightness: number;
  contrast: number;
  cannyLow: number;
  cannyHigh: number;
  minArea: number;
  blurSize: number;
  viewMode: 'normal' | 'night' | 'thermal';
  resolutionScale: number;
}

export interface Detection {
  rect: { x: number; y: number; width: number; height: number };
  area: number;
  aspectRatio: number;
}

class CVEngine {
  private cv: any;

  constructor() {
    this.cv = (window as any).cv;
  }

  public isReady(): boolean {
    return !!(window as any).cv && !!(window as any).cv.Mat;
  }

  /**
   * Main processing pipeline
   */
  public process(
    sourceCanvas: HTMLCanvasElement,
    outputCanvas: HTMLCanvasElement,
    params: CVParams
  ): Detection[] {
    if (!this.isReady()) return [];
    const cv = (window as any).cv;

    let src = cv.imread(sourceCanvas);
    let dst = new cv.Mat();
    let detections: Detection[] = [];

    try {
      // 1. Pre-processing: Brightness & Contrast
      src.convertTo(dst, -1, params.contrast, params.brightness);

      // 2. Grayscale
      let gray = new cv.Mat();
      cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY);

      // 3. Gaussian Blur
      let blurred = new cv.Mat();
      let ksize = new cv.Size(params.blurSize, params.blurSize);
      cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);

      // 4. CLAHE (Contrast Limited Adaptive Histogram Equalization)
      let clahe = new cv.Mat();
      let tileGridSize = new cv.Size(8, 8);
      let claheObj = new cv.CLAHE(2.0, tileGridSize);
      claheObj.apply(blurred, clahe);
      claheObj.delete();

      // 5. Segmentation & Edge Detection
      let edges = new cv.Mat();
      cv.Canny(clahe, edges, params.cannyLow, params.cannyHigh, 3, false);

      // 6. Morphology
      let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
      let morphed = new cv.Mat();
      cv.dilate(edges, morphed, kernel, new cv.Point(-1, -1), 1);
      cv.erode(morphed, morphed, kernel, new cv.Point(-1, -1), 1);
      cv.morphologyEx(morphed, morphed, cv.MORPH_CLOSE, kernel);

      // 7. Detection: Find Contours
      let contours = new cv.MatVector();
      let hierarchy = new cv.Mat();
      cv.findContours(morphed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      // 8. Filter & Generate Bounding Boxes
      for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        let rect = cv.boundingRect(cnt);
        let aspectRatio = rect.width / rect.height;

        // Filter by area and aspect ratio (ships are usually elongated)
        if (area > params.minArea && aspectRatio > 0.2 && aspectRatio < 5.0) {
          detections.push({ rect, area, aspectRatio });
        }
      }

      // 9. Display Modes
      if (params.viewMode === 'normal') {
        cv.imshow(outputCanvas, dst);
      } else if (params.viewMode === 'night') {
        // Night Recon: High Contrast B&W
        let night = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC4);
        // Draw white filled contours on black background
        for (let i = 0; i < detections.length; i++) {
          let color = new cv.Scalar(255, 255, 255, 255);
          cv.rectangle(night, 
            new cv.Point(detections[i].rect.x, detections[i].rect.y),
            new cv.Point(detections[i].rect.x + detections[i].rect.width, detections[i].rect.y + detections[i].rect.height),
            color, -1);
        }
        // Add glowing edges
        cv.addWeighted(night, 0.7, dst, 0.3, 0, night);
        cv.imshow(outputCanvas, night);
        night.delete();
      } else if (params.viewMode === 'thermal') {
        // Thermal Analysis: Colormap
        let thermal = new cv.Mat();
        cv.applyColorMap(clahe, thermal, cv.COLORMAP_JET);
        cv.imshow(outputCanvas, thermal);
        thermal.delete();
      }

      // Cleanup
      gray.delete();
      blurred.delete();
      clahe.delete();
      edges.delete();
      kernel.delete();
      morphed.delete();
      contours.delete();
      hierarchy.delete();

    } catch (e) {
      console.error("CV Processing Error:", e);
    } finally {
      src.delete();
      dst.delete();
    }

    return detections;
  }

  /**
   * Export canvas to PNG
   */
  public export(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL('image/png');
  }
}

export const cvEngine = new CVEngine();
