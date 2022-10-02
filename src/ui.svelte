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
  let responseStatus: number;
  let isOnline: boolean;
  let image: HTMLImageElement = new Image();
  const labels = ["Button", "Calendar"];

  onMount(() => {
    isOnline = checkInternetConnection();
  });

  const handleClick = () => {
    parent.postMessage({ pluginMessage: { type: "clickPredictButton" } }, "*");
  };

  //Handle the demand from the sandbox API to make a network request when the order is recieved
  window.onmessage = async (event) => {
    if (event.data.pluginMessage.type === "processingRequest") {
      isLoading = true;
      if (isDebugMode) {
          image = renderUint8ArrayToImage(event.data.pluginMessage.data[0].imageDataBytes);
        }
      try {
        let binaryNodes: BinaryNode[] = event.data.pluginMessage.data;
        let results: PredictionResult[];

        console.log(`Nodes from Figma:`);
        console.log(binaryNodes);

        //TM PREDICTION SETUP, NO TYPES
        const URL = "https://teachablemachine.withgoogle.com/models/7TY9ihr-l/";
        let model, webcam, labelContainer, maxPredictions;
        const modelURL = URL + "model.json";
        const metadataURL = URL + "metadata.json";
        //@ts-ignore
        model = await tmImage.load(modelURL, metadataURL);
        console.log(model);
        maxPredictions = model.getTotalClasses();

        //TM PREDICTION LOOP
        for (let node of binaryNodes) {
          let pixelImage: HTMLImageElement = renderUint8ArrayToImage(node.imageDataBytes);
          console.log(`start prediction for the image ${pixelImage}`);
          const prediction = await model.predict(pixelImage);
          console.log(`end prediction`);
          console.log(prediction);
        }



        //Send result to Figma sandbox
        //window.parent.postMessage({pluginMessage : {type : "response", payload : results}}, "*");

        isLoading = false;
      } catch (error) {
        console.log(error.message);
        isLoading = false;
      }
    }
  };

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

  function renderUint8ArrayToImage(bytes: Uint8Array): HTMLImageElement {
    const uintArray = Uint8Array.from(bytes);
    let image: HTMLImageElement = new Image();
    image.src = URL.createObjectURL(
      new Blob([uintArray.buffer], { type: "image/png" })
    );
    return image;
  }

</script>



<svelte:head>
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js" type="text/javascript"></script>
  <script src="https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8.3/dist/teachablemachine-image.min.js" type="text/javascript"></script>
</svelte:head>

<main class="flex flex-col items-center justify-between px-4 py-4 h-full bg-Black">
  
  <title-container class="flex flex-col items-center w-full space-y-4">
    <h1 class="text-base font-medium text-white text-center mt-2">
      SelectSSS layers and press "Name"
    </h1>
  
    {#if isDebugMode}
      <p class="text-gray-400 text-xs px-2 py-1 border-[1px] w-fit border-gray-400 rounded">
        Debug mode
      </p>
      <p class="text-gray-400 justify-center text-xs">Image sent to the model 👇</p>
      <img src={image.src} alt="Pixels sent to the model" bind:this={image} class="rounded-md" />
    {/if}
  </title-container>

  <body-container class="flex flex-col w-full items-center">
    {#if responseStatus === 401}
      <p class="text-xs text-white font-medium mb-4">Non authorized :/</p>
    {:else if !isDebugMode}
      <img src={magicWand} alt="Magic wand icon" class="mb-8" />
    {/if}

    {#if responseStatus > 250}
      <button
        class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs text-white font-medium rounded-md"
        on:click={closePlugin}
      >
        Close
      </button>
    {:else if !isOnline}
      <button
        class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs cursor-not-allowed grayscale text-white font-medium rounded-md"
      >
        No connection :/
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
