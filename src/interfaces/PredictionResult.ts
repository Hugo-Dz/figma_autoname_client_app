interface PredictionResult {
  nodeId : string;
  prediction : string;
  url?: string;
  probability?: string;
  pixelImage?: string;
  imageDataBytes? : Uint8Array;
}

export default PredictionResult;