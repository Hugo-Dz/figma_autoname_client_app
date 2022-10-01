<script lang="ts">
  import { onMount } from "svelte";
  import isDebugMode from "./utils/debugMode";

  import "./app.css";
  import magicWand from "./lib//assets/magicWand.svg";
  import loadingCircle from "./lib/assets/loadingCircle.svg";

  let isLoading: boolean = false;
  let responseStatus: number;
  let isOnline: boolean;
  let image: HTMLImageElement;

  onMount(() => {
    isOnline = checkInternetConnection();
  });

  const handleClick = () => {
    parent.postMessage({ pluginMessage: { type: "clickPredictButton" } }, "*");
  };

  //Handle the demand from the sandbox API to make a network request when the order is recieved
  window.onmessage = async (event) => {
    if (event.data.pluginMessage.type === "networkRequest") {
      if (isDebugMode) {
        renderSelectedImageInPlugin(event);
      }
      try {
        //const url = "https://figma-autoname-backend.herokuapp.com/api/predictNode" //Heroku
        //const url = "https://figma-autoname-backend-dy9w4.ondigitalocean.app/api/predictNode"; //DigitalOcean
        const url = "http://localhost:4001/api/predictNode"; //Localhost
        const initObject = {
          method: "POST",
          headers: {
            "Content-type": "application/json",
            "x-api-key": "theBrownFox",
          },
          body: JSON.stringify({ imagesData: event.data.pluginMessage.data }),
        };
        isLoading = true;
        const response = await fetch(url, initObject);
        responseStatus = await response.status;
        const responseJson = await response.json();
        window.parent.postMessage(
          { pluginMessage: { type: "response", payload: responseJson } },
          "*"
        ); //Close plugin only when the request end
        isLoading = false;
      } catch (error) {
        console.log(`[Svelte]: Error: ${error.message}`);
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

  function renderSelectedImageInPlugin(e): void {
    let bytesFromFigma = e.data.pluginMessage.data[0].imageDataBytes;
    const uintArray = Uint8Array.from(bytesFromFigma);
    image.src = URL.createObjectURL(
      new Blob([uintArray.buffer], { type: "image/png" })
    );
  }

</script>

<main class="flex flex-col items-center justify-between px-4 py-4 h-full bg-Black">

  <title-container class="flex flex-col items-center w-full space-y-4">
    <h1 class="text-base font-medium text-white text-center mt-2">
      Select layers and press "Name"
    </h1>
  
    {#if isDebugMode}
      <p class="text-gray-400 text-xs px-2 py-1 border-[1px] w-fit border-gray-400 rounded">
        Debug mode
      </p>
      <p class="text-gray-400 justify-center text-xs">Image sent to the model 👇</p>
      <img src="" alt="Pixels sent to the model" bind:this={image} class="rounded-md" />
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
