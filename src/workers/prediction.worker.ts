/*
import * as tf from "@tensorflow/tfjs";
import * as tfnode from "@tensorflow/tfjs-node";
*/
import type BinaryNodeJson from "../interfaces/BinaryNodeJson";
import type PredictionResult from "../interfaces/PredictionResult";
import type BinaryNode from "../interfaces/BinaryNode";

importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@2.0.0/dist/tf.min.js");

let binaryNodes: BinaryNode[];
const labels = ["Button", "Calendar"]
let results: PredictionResult[];



onmessage = function (event) {
  console.log(`Hello world`);
}

/*
function decodeImageToTensor (image: Uint8Array) {
  const imageTensor: tf.Tensor<tf.Rank.R3> = tfnode.node.decodeImage(image).expandDims(0); //Add a dimension
  const resizedImageTensor: tf.Tensor<tf.Rank.R3> = tf.image.resizeBilinear(imageTensor, [224, 224]); //Resize tensor shape
  return resizedImageTensor;
}

async function predict (image: Uint8Array) {
  const model = await tf.loadLayersModel("file://./src/models/model.json"); //Pattern + relative path
  const tensor = decodeImageToTensor(image);
  const result = await model.predict(tensor) as tf.Tensor; //To get labels
  const data = await result.as1D().argMax().dataSync()[0];
  return labels[data];
}

async function runPrediction(binaryNodes: BinaryNode[]): Promise<void> {
  let results: PredictionResult[] = [];
  const startTime:  number = new Date().getTime();

  for (let binaryNode of binaryNodes) {
    const prediction: string = await predict(binaryNode.imageDataBytes);
    results = [...results, {nodeId : binaryNode.nodeId, prediction : prediction}];
  }

  const endTime:  number = new Date().getTime();
  console.log(`[PREDICTION]: MODEL RUN Execution time: ${endTime - startTime}ms`);

  results = results;
}
*/

export {};