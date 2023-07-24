interface PredictionResult {
  nodeId : string;
  prediction : string;
  probability?: string;
  pixelImage?: string;
}

export default PredictionResult;

//An object like {nodeId : "abcd", prediction : "Button"}