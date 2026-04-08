import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

export class FaceAuthService {
  private static isLoaded = false;

  static async loadModels() {
    if (this.isLoaded) return;
    
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);
    
    this.isLoaded = true;
    console.log('Face API Models Loaded');
  }

  static async getFaceDescriptor(videoElement: HTMLVideoElement) {
    const detection = await faceapi.detectSingleFace(
      videoElement, 
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

    return detection;
  }

  static async getFaceWithLandmarks(videoElement: HTMLVideoElement) {
    return await faceapi.detectSingleFace(
      videoElement,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })
    ).withFaceLandmarks();
  }

  static checkBlink(landmarks: faceapi.FaceLandmarks68): boolean {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const getEAR = (eye: faceapi.Point[]) => {
      const v1 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
      const v2 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
      const h = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
      return (v1 + v2) / (2 * h);
    };

    const ear = (getEAR(leftEye) + getEAR(rightEye)) / 2;
    return ear < 0.25; // More lenient threshold for closed eyes
  }

  static saveFaceDescriptor(username: string, descriptor: Float32Array) {
    const descriptorArray = Array.from(descriptor);
    localStorage.setItem(`face_auth_${username}`, JSON.stringify(descriptorArray));
  }

  static getStoredDescriptor(username: string): Float32Array | null {
    const stored = localStorage.getItem(`face_auth_${username}`);
    if (!stored) return null;
    return new Float32Array(JSON.parse(stored));
  }

  static getAllFaceData(): { username: string; descriptor: Float32Array }[] {
    const data: { username: string; descriptor: Float32Array }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('face_auth_')) {
        const username = key.replace('face_auth_', '');
        const stored = localStorage.getItem(key);
        if (stored) {
          data.push({
            username,
            descriptor: new Float32Array(JSON.parse(stored))
          });
        }
      }
    }
    return data;
  }

  static compareFaces(descriptor1: Float32Array, descriptor2: Float32Array): number {
    return faceapi.euclideanDistance(descriptor1, descriptor2);
  }

  static isMatch(distance: number, threshold = 0.6): boolean {
    return distance < threshold;
  }
}
