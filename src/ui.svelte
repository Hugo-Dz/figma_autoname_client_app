<script lang="ts">

  import "./app.css";
  import magicWand from "./lib//assets/magicWand.svg";
  import loadingCircle from "./lib/assets/loadingCircle.svg";

  import type BinaryNodeJson from "./interfaces/BinaryNodeJson";
  import type PredictionResult from "./interfaces/PredictionResult";
  import type BinaryNode from "./interfaces/BinaryNode";

  
  let isLoading: boolean = false;
  let responseStatus: number;
  const labels = ["Button", "Calendar"];

  const handleClick = () => {
    parent.postMessage({ pluginMessage: { type: "clickPredictButton" } }, "*");
  };

  //Handle the demand from the sandbox API to make a network request when the order is recieved
  window.onmessage = async (event) => {
    if (event.data.pluginMessage.type === "processingRequest") {
      isLoading = true;
      try {
        let binaryNodes: BinaryNode[] = [];
        let results: PredictionResult[];

        //Get data from Figma sandbox
        const binaryNodesWithJsonBytes: BinaryNodeJson[] = event.data.pluginMessage.data;

        binaryNodesWithJsonBytes.forEach((node: BinaryNodeJson) => {
          const id: string = node.nodeId
          const bytesArray: any[] = Object.entries(node.imageDataBytes).map(([key, value]) => value); //Transform {"0":122} -> [122, ..]
          const bytes: Uint8Array = Uint8Array.from(bytesArray); //From uint8Array json (as receieved from the request)
          binaryNodes = [...binaryNodes, {nodeId : id, imageDataBytes : bytes}]
        });

        results = await runPredictions(binaryNodes);

        //Send result to Figma sandbox
        window.parent.postMessage({pluginMessage : {type : "response", payload : results}}, "*");

        isLoading = false;

      } catch (error) {
        console.log(error.message);
        isLoading = false;
      }
    }
  }

  function closePlugin(): void {
    window.parent.postMessage({ pluginMessage: { type: "close" } }, "*")
  }

  function tfReady(): void {
    console.log(`[TF]: Script loaded`);
  }

  function decodeImageToTensor (image: Uint8Array) {
    const imageTensor: tf.Tensor<tf.Rank.R3> = tf.browser.fromPixels({data: image, width: 224, height: 224}).expandDims(0); //Add a dimension
    const resizedImageTensor: tf.Tensor<tf.Rank.R3> = tf.image.resizeBilinear(imageTensor, [224, 224]); //Resize tensor shape
    return resizedImageTensor;
  }
  

  async function predict (image: Uint8Array) {
    const model = await tf.loadLayersModel("http://localhost:4001/api/model"); //TODO fetch() the model on a tiny server
    const tensor = decodeImageToTensor(image);
    const result = await model.predict(tensor) as tf.Tensor; //To get labels
    const data = await result.as1D().argMax().dataSync()[0];
    return labels[data];
  }

  async function runPredictions(binaryNodes: BinaryNode[]): Promise<PredictionResult[]> {
    let results: PredictionResult[] = [];
    const startTime:  number = new Date().getTime();

    for (let binaryNode of binaryNodes) {
      const prediction: string = await predict(binaryNode.imageDataBytes);
      results = [...results, {nodeId : binaryNode.nodeId, prediction : prediction}];
    }

    const endTime:  number = new Date().getTime();
    console.log(`[PREDICTIONS]: MODEL RUN Execution time: ${endTime - startTime}ms`);

    return results;
  }



</script>



<svelte:head>
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js" type="text/javascript" on:load={tfReady}></script>
</svelte:head>

<main class="flex flex-col items-center justify-between px-4 py-4 h-full bg-Black">

  <h1 class="text-base font-medium text-white text-center mt-2">Select layers and press "Name"</h1>

  {#if responseStatus === 401}
    <p class="text-xs text-white font-medium">Non authorized :/</p>
  {:else if responseStatus < 250}
  <p class="text-xs text-white font-medium">Error {responseStatus}</p>
  {:else}
    <img src={magicWand} alt="Magic wand icon">
  {/if}

  {#if responseStatus > 250}
    <button
      class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs text-white font-medium rounded-md"
      on:click={closePlugin}>
      Close
    </button>
  {:else}
    <button
      class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs text-white font-medium rounded-md"
      on:click={handleClick}>
      {#if isLoading}
        <img src={loadingCircle} alt="Loading circle" class="animate-spin mr-2">
      {/if}
      {isLoading ? `Processing...` : `Name`}
    </button>
  {/if}

</main>