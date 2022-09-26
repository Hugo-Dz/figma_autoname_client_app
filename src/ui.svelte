<script lang="ts">

  import "./app.css";
  import magicWand from "./lib//assets/magicWand.svg";
  import loadingCircle from "./lib/assets/loadingCircle.svg";
  
  let isLoading: boolean = false;
  let responseStatus: number;

  const handleClick = () => {
    parent.postMessage({ pluginMessage: { type: "clickPredictButton" } }, "*");
  };

  //Handle the demand from the sandbox API to make a network request when the order is recieved
  window.onmessage = async (event) => {
    if (event.data.pluginMessage.type === "networkRequest") {
      try {
        //const url = "https://figma-autoname-backend.herokuapp.com/api/predictNode" //Heroku
        const url = "https://figma-autoname-backend-dy9w4.ondigitalocean.app/api/predictNode"; //DigitalOcean
        //const url = "http://localhost:4001/api/predictNode"; //Localhost
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