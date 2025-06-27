export interface MediaFile {
  uri: string;
  type: 'photo' | 'video';
  duration?: number;
  width?: number;
  height?: number;
  // Thumbnail support for unified media display
  thumbnailUri?: string;
  posterUri?: string; // For video poster frames
  location?: {
    latitude: number;
    longitude: number;
  };
  filter?: {
    id: string;
    name: string;
    type: 'face' | 'full_screen' | '3d';
  };
}

export interface FaceDetectionResult {
  faceID?: number;
  bounds: {
    origin: { x: number; y: number };
    size: { width: number; height: number };
  };
  landmarks?: {
    leftEye?: { x: number; y: number };
    rightEye?: { x: number; y: number };
    noseBase?: { x: number; y: number };
    mouthLeft?: { x: number; y: number };
    mouthRight?: { x: number; y: number };
    leftCheek?: { x: number; y: number };
    rightCheek?: { x: number; y: number };
  };
  expressions?: {
    smilingProbability?: number;
    leftEyeOpenProbability?: number;
    rightEyeOpenProbability?: number;
  };
}

export interface FilterAsset {
  id: string;
  name: string;
  type: 'face' | 'full_screen' | '3d';
  category: 'fitness' | 'fun' | 'workout' | 'celebration';
  thumbnail: any; // require() asset
  asset: any; // require() asset
  position?: 'eyes' | 'mouth' | 'forehead' | 'face' | 'full' | 'leftCheek' | 'rightCheek';
  scaleWithFace?: boolean;
}