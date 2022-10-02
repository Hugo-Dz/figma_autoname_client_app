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
        let binaryNodes: BinaryNode[] = event.data.pluginMessage.data;
        let results: PredictionResult[];

        console.log(binaryNodes);
        

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





</script>



<svelte:head>
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js" type="text/javascript"></script>
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