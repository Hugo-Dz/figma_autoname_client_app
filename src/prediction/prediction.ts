import * as tf from "@tensorflow/tfjs";
import * as tfnode from "@tensorflow/tfjs-node";

const labels = ["Button", "Calendar"]

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

export default predict;