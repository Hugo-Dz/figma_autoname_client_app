<script lang="ts">

  import "./app.css";
  

  const handleClick = () => {
    parent.postMessage({ pluginMessage: { type: "clickPredictButton" } }, "*");
  };

  //Handle the demand from the sandbox API to make a network request when the order is recieved
  window.onmessage = async (event) => {
    if (event.data.pluginMessage.type === "networkRequest") {
      try {
        const url = "http://localhost:4001/api/predictNode";
        const initObject = {
          method: "POST",
          headers: {
            "Content-type": "application/json",
          },
          body: JSON.stringify({ imagesData: event.data.pluginMessage.data }),
        };
        const response = await fetch(url, initObject);
        const responseJson = await response.json();
        const { result } = responseJson;
        console.log(`Result:`);
        console.log(`-------------------`);
        console.log(result);
        window.parent.postMessage({ pluginMessage: { type: "close" } }, "*"); //Close plugin only when the request end
      } catch (error) {
        console.log(error.message);
        window.parent.postMessage({ pluginMessage: { type: "close" } }, "*"); //Close plugin only when the request end
      }
    }
  };

</script>



<main class="flex flex-col items-center justify-between px-4 py-4 h-full">
  <h1 class="text-2xl text-center mb-8 mt-4">Name thousands of layers in one click</h1>
  <button
    class="px-4 py-2 w-full font-bold rounded-md bg-black text-white border-[1px]"
    on:click={handleClick}>Name my layers</button
  >
</main>
