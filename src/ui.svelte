<script lang="ts">
  import "./app.css";
  import magicWand from "./lib//assets/magicWand.svg";
  import loadingCircle from "./lib/assets/loadingCircle.svg";

  import { onMount } from "svelte";

  import type BinaryNodeJson from "./interfaces/BinaryNodeJson";
  import type PredictionResult from "./interfaces/PredictionResult";
  import type BinaryNode from "./interfaces/BinaryNode";

  import isDebugMode from "src/utils/debugMode";

  let isLoading: boolean = false;
  let emptySelection: boolean = false;
  let responseStatus: number;
  let isOnline: boolean;
  let isModelReady: boolean = false;
  let sampleImage: HTMLImageElement = new Image();
  let precision: number = 0.8;

  //TM setup
  const URL = "https://teachablemachine.withgoogle.com/models/7TY9ihr-l/";
  const modelURL = URL + "model.json";
  const metadataURL = URL + "metadata.json";
  let model;

  onMount( async () => {
    isOnline = checkInternetConnection();
    await init();
  });

  const handleClick = () => {
    isLoading = true;
    parent.postMessage({ pluginMessage: { type: "clickPredictButton" } }, "*");
  };

  //Handle the demand from the sandbox API to make a network request when the order is recieved
  window.onmessage = async (event) => {

    if (event.data.pluginMessage.type === "emptySelection") {
      emptySelection = true;
    }

    if (event.data.pluginMessage.type === "processingRequest") {

      emptySelection = false;

      const binaryNodes: BinaryNode[] = event.data.pluginMessage.data;

      if (isDebugMode) {
        sampleImage = await renderUint8ArrayToImage(binaryNodes[0].imageDataBytes);
      }

      let results: PredictionResult[] = [];

      //TM PREDICTION LOOP
      for (let node of binaryNodes) {
        const predictedNode: PredictionResult = await predict(node);
        results = [...results, predictedNode];
      }

      console.log(`[Svelte]: prediction results`);
      console.log(results);

      //Send result to Figma sandbox
      window.parent.postMessage({pluginMessage : {type : "response", payload : results}}, "*");

      isLoading = false;
    }
  };

  async function init() {
    //@ts-ignore
    model = await tmImage.load(modelURL, metadataURL);
    isModelReady = true;
    console.log(`[Svelte]: model ready`);
  }

  async function predict(node: BinaryNode): Promise<PredictionResult> {

    const pixelImage: HTMLImageElement = await renderUint8ArrayToImage(node.imageDataBytes);

    if (isDebugMode) {
      sampleImage = pixelImage;
    }

    const prediction: any[] = await model.predict(pixelImage);
    
    let sortedProbabilities = prediction.sort((a, b) => a.probability - b.probability);
    console.dir(sortedProbabilities);
    let finalist = sortedProbabilities.pop();

    let predictedNode: PredictionResult;

    if (finalist.probability > precision) {
      predictedNode = {
        nodeId : node.nodeId,
        prediction : finalist.className
      }
    } else {
      predictedNode = {
        nodeId : node.nodeId,
        prediction : "Container"
      }
    }

    pixelImage.remove();

    return predictedNode;
  }

  function closePlugin(): void {
    window.parent.postMessage({ pluginMessage: { type: "close" } }, "*");
  }

  function checkInternetConnection(): boolean {
    let isOnline: boolean;
    isOnline = navigator.onLine ? true : false;
    console.log(
      `[Svelte]: Connection status: ${isOnline ? "Online" : "Offline"}`
    );
    return isOnline;
  }

  async function renderUint8ArrayToImage(bytes: Uint8Array): Promise<HTMLImageElement> {
    const newImage = new Image(224, 224);
    const base64Data = btoa(String.fromCharCode.apply(null, bytes)); //No Buffer.from(bytes).toString('base64'); cause we are not in Node
    newImage.src = "data:image/png;base64," + base64Data;
    return newImage;
  }


</script>

<svelte:head />

<main
  class="flex flex-col items-center justify-between px-4 py-4 h-full bg-[#2C2C2C]"
>
  <title-container class="flex flex-col items-center w-full space-y-4">
    <h1 class="text-base font-medium text-white text-center mt-2">
      {isModelReady ? `Select layers and press "Name"` : `Please wait the model loading`}
    </h1>

    {#if isDebugMode}
      <p
        class="text-gray-400 text-xs px-2 py-1 border-[1px] w-fit border-gray-400 rounded"
      >
        Debug mode
      </p>
      <p class="text-gray-400 justify-center text-xs">
        Image sent to the model 👇
      </p>
      <img
        src={sampleImage.src}
        alt="Pixels sent to the model"
        bind:this={sampleImage}
        class="rounded-md"
      />
    {/if}
  </title-container>

  <body-container class="flex flex-col w-full items-center">
    {#if responseStatus === 401}
      <p class="text-xs text-white font-medium mb-4">Non authorized :/</p>
    {:else if !isDebugMode}
      <magic-wand-container class="p-4 rounded-full flex flex-col items-center justify-center m-6">
        <img src={magicWand} alt="Magic wand icon" class="-translate-x-[3px] translate-y-[2px]"/>
      </magic-wand-container>
    {/if}

    {#if  !isModelReady}
      <button
      class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs cursor-not-allowed grayscale text-white font-medium rounded-md"
      >
        <img
          src={loadingCircle}
          alt="Loading circle"
          class="animate-spin mr-2"
        />
        Loading model...
      </button>
    {:else if !isOnline}
      <button
        class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs cursor-not-allowed grayscale text-white font-medium rounded-md"
      >
        No connection :/
      </button>
    {:else if emptySelection}
      <button
        class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs text-white font-medium rounded-md"
        on:click={handleClick}
      >
        Please selects layers
      </button>
    {:else}
      <button
        class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs text-white font-medium rounded-md"
        on:click={handleClick}
      >
        {#if isLoading}
          <img
            src={loadingCircle}
            alt="Loading circle"
            class="animate-spin mr-2"
          />
        {/if}
        {isLoading ? `Processing...` : `Name`}
      </button>
    {/if}
  </body-container>
</main>
