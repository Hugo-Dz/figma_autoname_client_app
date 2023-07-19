interface PredictionResult {
  nodeId : string;
  prediction : string;
  probability?: string;
  imageDataBytes?: Uint8Array;
}

export default PredictionResult;

//An object like {nodeId : "abcd", prediction : "Button"}