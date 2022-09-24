<script lang="ts">

  import "./app.css";
  import magicWand from "./lib//assets/magicWand.svg";
  import loadingCircle from "./lib/assets/loadingCircle.svg";

  import { onMount } from "svelte";

  import type BinaryNodeJson from "./interfaces/BinaryNodeJson";
  import type PredictionResult from "./interfaces/PredictionResult";
  import type BinaryNode from "./interfaces/BinaryNode";
  
  let isLoading: boolean = false;
  let responseStatus: number;
  let syncWorker: Worker | undefined = undefined;

  onMount(() => {
    loadWorker();
  })

  async function loadWorker() {
    const SyncWorker = await import("./workers/prediction.worker"); //Not this way, we don't use Vite
    syncWorker = new SyncWorker.default();
  }

  const handleClick = () => {
    parent.postMessage({ pluginMessage: { type: "clickPredictButton" } }, "*");
  };

  //Handle the demand from the sandbox API to make a network request when the order is recieved
  window.onmessage = async (event) => {
    if (event.data.pluginMessage.type === "processingRequest") {
      isLoading = true;
      try {
        const binaryNodesWithJsonBytes: BinaryNodeJson[] = event.data.pluginMessage.data;
        let binaryNodes: BinaryNode[] = [];

        binaryNodesWithJsonBytes.forEach((node: BinaryNodeJson) => {
          const id: string = node.nodeId
          const bytesArray: any[] = Object.entries(node.imageDataBytes).map(([key, value]) => value); //Transform {"0":122} -> [122, ..]
          const bytes: Uint8Array = Uint8Array.from(bytesArray); //From uint8Array json (as receieved from the request)
          binaryNodes = [...binaryNodes, {nodeId : id, imageDataBytes : bytes}]
        });

        //TODO post message to worker with binaryNode as payload

        //TODO get results in a results var
        const results = "RESULT HERE";

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