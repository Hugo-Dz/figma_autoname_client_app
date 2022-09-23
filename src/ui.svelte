<script lang="ts">

  import "./app.css";
  import magicWand from "./lib//assets/magicWand.svg";
  import loadingCircle from "./lib/assets/loadingCircle.svg";
  import predict from "./prediction/prediction";

  import type BinaryNodeJson from "./interfaces/BinaryNodeJson";
  import type PredictionResult from "./interfaces/PredictionResult";
  import type BinaryNode from "./interfaces/BinaryNode";
  
  let isLoading: boolean = false;
  let responseStatus: number;

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

        const results = await runPrediction(binaryNodes);

        window.parent.postMessage({pluginMessage : {type : "response", payload : results}}, "*");

        isLoading = false;

        //Old server side computing
        /*
        const url = "https://figma-autoname-backend.herokuapp.com/api/predictNode"
        //const url = "http://localhost:4001/api/predictNode";
        const initObject = {
          method: "POST",
          headers: {
            "Content-type": "application/json",
            "x-api-key": "theBrownFox"
          },
          body: JSON.stringify({ imagesData: event.data.pluginMessage.data }),
        };
        isLoading = true;
        const response = await fetch(url, initObject);
        responseStatus = await response.status
        const responseJson = await response.json();
        window.parent.postMessage({pluginMessage : {type : "response", payload : responseJson}}, "*"); //Close plugin only when the request end
        isLoading = false;
        */

      } catch (error) {
        console.log(error.message);
        isLoading = false;
      }
    }
  }

  function closePlugin(): void {
    window.parent.postMessage({ pluginMessage: { type: "close" } }, "*")
  }

  async function runPrediction(binaryNodes: BinaryNode[]): Promise<PredictionResult[]> {
    let results: PredictionResult[] = [];
    const startTime:  number = new Date().getTime();

    for (let binaryNode of binaryNodes) {
      const prediction: string = await predict(binaryNode.imageDataBytes);
      results = [...results, {nodeId : binaryNode.nodeId, prediction : prediction}];
    }

    const endTime:  number = new Date().getTime();
    console.log(`[PREDICTION]: MODEL RUN Execution time: ${endTime - startTime}ms`);

    return results;
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