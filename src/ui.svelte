<script lang="ts">
	// Style
	import "./app.css";

	// Icons and images
	import magicWand from "./lib//assets/magicWand.svg";
	import loadingCircle from "./lib/assets/loadingCircle.svg";
	import settingsIcon from "./lib/assets/settings-icon.svg";
	import homeIcon from "./lib/assets/home-icon.svg";
	import previousIcon from "./lib/assets/previous-icon.svg";

	import { Textarea } from "figma-plugin-ds-svelte";

	// Svelte
	import { onMount } from "svelte";

	// Types
	import type BinaryNodeJson from "./interfaces/BinaryNodeJson";
	import type PredictionResult from "./interfaces/PredictionResult";
	import type BinaryNode from "./interfaces/BinaryNode";

	// Utils
	import isDebugMode from "src/utils/debugMode";

	// Variables
	let isLoading: boolean = false;
	let emptySelection: boolean = false;
	let responseStatus: number;
	let isOnline: boolean;
	let isModelReady: boolean = false;
	let sampleImage: HTMLImageElement = new Image();
	let precision: number = 0.45;
	let isSettingMode: boolean = false;
	let URL: string = "";

	//TM setup
	let model;

	//Badge note
	const versionNote: string = "Import your own Teachable Machine model! Go to settings ⚙️";

	onMount(async () => {
		isOnline = checkInternetConnection();

		// post message to sandbox to get the model URL
		parent.postMessage({ pluginMessage: { type: "init" } }, "*");
	});

	const handleClick = () => {
		isLoading = true;
		parent.postMessage({ pluginMessage: { type: "clickPredictButton" } }, "*");
	};

	//If setting pannel, close it. If not, open it.
	const handleSettingsClick = () => {
		isSettingMode = !isSettingMode;
	};

	// Validation of the model URL entered by the user
	const validateURL = (url: string): boolean => {
		const regex = new RegExp(/^(http|https):\/\/[^ "]+\/$/);
		return regex.test(url);
	};

	//Submit the new model URL and set in local storage via Figma plugin API.
	const handleModelSubmit = () => {
		let newModelURL = document.querySelector("textarea").value;

		// If the URL is not ended by a slash, add it
		if (!newModelURL.endsWith("/")) {
			newModelURL += "/";
		}
		// If the URL is not valid, alert the user
		if (!validateURL(newModelURL)) {
			alert("Please enter a valid URL");
			return;
		} else {
			// If the URL is valid, sent to the sandbox API to save it in local storage
			parent.postMessage({ pluginMessage: { type: "updateModelURL", payload: newModelURL } }, "*");

			// And update tmSetup
			init(newModelURL + "model.json", newModelURL + "metadata.json");
		}

		// Close the settings pannel
		isSettingMode = false;
		isModelReady = false;
	};

	// Reset the model URL and set to initial value
	const handleModelReset = () => {
		// post message to sandbox to restore the current model value
		parent.postMessage({ pluginMessage: { type: "resetModelURL" } }, "*");
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

			if (isDebugMode) {
				console.log(`[Svelte]: prediction results:`);
				console.log(results);
			}

			//Send result to Figma sandbox
			window.parent.postMessage({ pluginMessage: { type: "response", payload: results } }, "*");

			isLoading = false;
		}
		// if the model URL is recieved, init the model and close setting pannel
		if (event.data.pluginMessage.type === "modelURL") {
			URL = event.data.pluginMessage.payload;
			init(URL + "model.json", URL + "metadata.json");

			isSettingMode = false;
		}
	};

	async function init(modelURL: string, metadataURL: string) {
		//@ts-ignore
		model = await tmImage.load(modelURL, metadataURL);
		isModelReady = true;
		if (isDebugMode) {
			console.log(`[Svelte]: Model ready`, modelURL);
		}
	}

	async function predict(node: BinaryNode): Promise<PredictionResult> {
		const pixelImage: HTMLImageElement = await renderUint8ArrayToImage(node.imageDataBytes);

		if (isDebugMode) {
			sampleImage = pixelImage;
		}

		const prediction: any[] = await model.predict(pixelImage);

		let sortedProbabilities = prediction.sort((a, b) => a.probability - b.probability);

		if (isDebugMode) {
			console.log(sortedProbabilities);
		}

		let finalist = sortedProbabilities[sortedProbabilities.length - 1];

		let predictedNode: PredictionResult;

		if (finalist.probability > precision) {
			predictedNode = {
				nodeId: node.nodeId,
				prediction: finalist.className,
			};
		} else {
			predictedNode = {
				nodeId: node.nodeId,
				prediction: "Container",
			};
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
		if (isDebugMode) {
			console.log(`[Svelte]: ${isOnline ? "Online" : "Offline"}`);
		}
		return isOnline;
	}

	async function renderUint8ArrayToImage(bytes: Uint8Array): Promise<HTMLImageElement> {
		const newImage = new Image(224, 224);
		const base64Data = btoa(String.fromCharCode.apply(null, bytes)); //No Buffer.from(bytes).toString('base64'); cause we are not in Node JS
		newImage.src = "data:image/png;base64," + base64Data;
		return newImage;
	}
</script>

<svelte:head />

<main class="flex flex-col items-center justify-between px-4 py-4 h-full bg-[#2C2C2C]">
	<div class="flex flex-col items-center w-full space-y-4 h-full">
		<p
			class="text-xs text-slate-50 w-full px-3 py-2 border-[1px] border-slate-600 border-opacity-40 rounded-md bg-slate-600 bg-opacity-30"
		>
			What's new: {versionNote}
		</p>

		<div class="text-base font-normal text-white text-center mt-2 w-full">
			{#if isSettingMode}
				<div class="flex flex-col justify-center items-center w-full space-y-2 h-full">
					<div class="flex flex-row justify-between items-center w-full">
						<p>Set a new model URL</p>
						<!-- The Model Reset Button  -->
						<button class="flex flex-row justify-center items-center" on:click={handleModelReset}>
							<img src={previousIcon} alt="Previous icon" height="14" width="14" />
						</button>
					</div>
					<Textarea
						class="text-xs h-full text-slate-50 w-full font-medium mb-4 border-[1px] border-slate-600 border-opacity-40 rounded-md bg-slate-600 bg-opacity-30"
						value={URL}
					/>
				</div>
			{:else if !isModelReady}
				Please wait the model loading
			{:else}
				Select layers and press "Name"
			{/if}
		</div>

		{#if isDebugMode}
			<p class="text-gray-400 text-xs px-2 py-1 border-[1px] w-fit border-gray-400 rounded">Debug mode</p>
			<p class="text-gray-400 justify-center text-xs">Image sent to the model 👇</p>
			<img src={sampleImage.src} alt="Pixels sent to the model" bind:this={sampleImage} class="rounded-md" />
		{/if}
	</div>

	<body-container class="flex flex-col w-full items-center">
		{#if responseStatus === 401}
			<p class="text-xs text-white font-medium mb-4">Non authorized :/</p>
		{:else if !isSettingMode && !isDebugMode}
			<magic-wand-container class="p-2 rounded-full flex flex-col items-center justify-center m-6">
				<img src={magicWand} alt="Magic wand icon" class="-translate-x-[3px] translate-y-[2px] h-10 w-10" />
			</magic-wand-container>
		{/if}
		<button-container class="flex w-full items-center mt-4">
			{#if !isModelReady}
				<button
					class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs cursor-not-allowed grayscale text-white font-medium rounded-md"
				>
					<img src={loadingCircle} alt="Loading circle" class="animate-spin mr-2" />
					Loading model...
				</button>
				{#if !isDebugMode}
					<button
						on:click={handleSettingsClick}
						class="flex flex-row justify-center items-center text-white font-large rounded-md py-[7px] pl-3 bg-Grey"
					>
						{#if isSettingMode}
							<img src={homeIcon} alt="Home icon" width="20" height="20" />
						{:else}
							<img src={settingsIcon} alt="Settings icon" width="20" height="20" />
						{/if}</button
					>
				{/if}
			{:else if isSettingMode}
				<button
					class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs text-white font-medium rounded-md"
					on:click={handleModelSubmit}
				>
					Update the model
				</button>

				{#if !isDebugMode}
					<button
						on:click={handleSettingsClick}
						class="flex flex-row justify-center items-center text-white font-large rounded-md py-[7px] pl-3 bg-Grey"
					>
						{#if isSettingMode}
							<img src={homeIcon} alt="Home icon" width="20" height="20" />
						{:else}
							<img src={settingsIcon} alt="Settings icon" width="20" height="20" />
						{/if}
					</button>
				{/if}
			{:else if !isOnline}
				<button
					class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs cursor-not-allowed grayscale text-white font-medium rounded-md"
				>
					No connection :/
				</button>
				{#if !isDebugMode}
					<button
						on:click={handleSettingsClick}
						class="flex flex-row justify-center items-center text-white font-large rounded-md py-[7px] pl-3 bg-Grey"
					>
						{#if isSettingMode}
							<img src={homeIcon} alt="Home icon" width="20" height="20" />
						{:else}
							<img src={settingsIcon} alt="Settings icon" width="20" height="20" />
						{/if}</button
					>
				{/if}
			{:else if emptySelection}
				<button
					class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs text-white font-medium rounded-md"
					on:click={handleClick}
				>
					Please selects layers
				</button>
				{#if !isDebugMode}
					<button
						on:click={handleSettingsClick}
						class="flex flex-row justify-center items-center text-white font-large rounded-md py-[7px] pl-3 bg-Grey"
					>
						{#if isSettingMode}
							<img src={homeIcon} alt="Home icon" width="20" height="20" />
						{:else}
							<img src={settingsIcon} alt="Settings icon" width="20" height="20" />
						{/if}</button
					>
				{/if}
			{:else}
				<button
					class="w-full flex flex-row justify-center items-center bg-Blue px-3 py-[7px] text-xs text-white font-medium rounded-md"
					class:cursor-not-allowed={isLoading}
					on:click={handleClick}
				>
					{#if isLoading}
						<img src={loadingCircle} alt="Loading circle" class="animate-spin mr-2" />
					{/if}
					{isLoading ? `Processing...` : `Name`}
				</button>

				{#if !isDebugMode}
					<button
						on:click={handleSettingsClick}
						class="flex flex-row justify-center items-center text-white font-large rounded-md pl-3 py-[7px] bg-Grey"
					>
						{#if isSettingMode}
							<img src={homeIcon} alt="Home icon" width="20" height="20" />
						{:else}
							<img src={settingsIcon} alt="Settings icon" width="20" height="20" />
						{/if}</button
					>
				{/if}
			{/if}
		</button-container>
	</body-container>
</main>
