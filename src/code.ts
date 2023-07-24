import type BinaryNode from "./interfaces/BinaryNode";
import type PredictionResult from "./interfaces/PredictionResult";

import isDebugMode from "src/utils/debugMode";
import toAndroidResourceName from "src/utils/toAndroidResourceName";

//Disable infinite recursivity in nodes or limit it
const selectOnlyTopLevelNodes: boolean = false;
const maxSubNodes: number = 3;
const pluginUiHeight = isDebugMode ? 500 : 280;

let customTFModel = process.env.PUBLIC_CUSTOM_MODEL;
const defaultModel: string = customTFModel ? customTFModel : "https://teachablemachine.withgoogle.com/models/7TY9ihr-l/";
const filename: string = toAndroidResourceName(figma.root.name);

// Show the plugin UI based on the editor type

if (figma.editorType === "dev") {

  figma.showUI(__html__) //Show the plugin UI
  updateSelection();
  figma.on('selectionchange', updateSelection);
} else {
  figma.showUI(__html__, { height: pluginUiHeight }); // Start the plugin UI with a specific height
}


async function updateSelection() {

  const selectedLayers = figma.currentPage.selection;

  if (selectedLayers.length > 0) {
    const predictionResultJson = await figma.clientStorage.getAsync(selectedLayers[0].id);

    if (predictionResultJson) {
      figma.ui.postMessage({ type: "updateSelection", payload: predictionResultJson });
    } else {
      figma.ui.postMessage({ type: "updateSelection", payload: "none" });
    }
  } else {
    figma.ui.postMessage({ type: "updateSelection", payload: "none" });
  }
}

figma.ui.onmessage = async msg => {

  if (msg.type === "clickPredictButton") {

    if (figma.currentPage.selection.length < 1) {
      figma.ui.postMessage({ type: "emptySelection" });
    } else {
      const imagesInBytes: BinaryNode[] = await renderElementsFromSelection(figma.currentPage.selection);
      const filename: string = toAndroidResourceName(figma.root.name);
      sendImagesToUi(imagesInBytes, filename);
    }

  }

  if (msg.type === "response") {

    const excludedTypes: NodeType[] = ["TEXT", "VECTOR", "COMPONENT", "COMPONENT_SET", "INSTANCE"];
    const nodesToRename: SceneNode[] = selectAllNodesFromSelection(figma.currentPage.selection, excludedTypes);
    const msgPayload: PredictionResult[] = msg.payload;

    const startTime: number = new Date().getTime();

    for (const node of nodesToRename) {
      node.name = "Frame"; //Rename all node "Frame" before renaming to avoid conflicts in exceptions


      // Update the node name based on prediction result
      for (let predictionResult of msgPayload) { //figma.findNodeById(id) existe too
        if (node.id === predictionResult.nodeId) {
          node.name = predictionResult.prediction;

          // set the prediction result via clientStorage
          // Eencode it as a JSON string first via JSON.stringify and JSON.parse and store it as a string

          const dataStoredAsString = JSON.stringify(predictionResult);
          await figma.clientStorage.setAsync(node.id, dataStoredAsString);
        }
      }


      /*
      **********
      EXCEPTIONS HANDLING
      Must correct node.name & parent.name references here if classes names changes in the model
      **********
      */

      //Handle image node naming
      if (node.type === "RECTANGLE") {
        const fills: readonly Paint[] | typeof figma.mixed = node.fills;
        if (fills[0].type === "IMAGE") {
          node.name = "Image";
        }
      }
      //Handle text only container naming
      if (node.type === "FRAME" || node.type === "GROUP") {
        const children: SceneNode[] = node.findAll();
        if (children.length > 1) {
          const areChildrenAllTextNodes: boolean = children.every((node) => node.type === "TEXT");
          if (areChildrenAllTextNodes) {
            node.name = "Paragraph container";
          }
        }
      }
      //Handle container naming
      const parent: BaseNode & ChildrenMixin = node.parent;
      if (parent.name === node.name && parent.name !== "Container" && parent.name !== "Card" && parent.name !== "Horizontal container" && parent.name !== "Vertical container") {
        parent.name = `${node.name} container`;
      }
    }

    const endTime: number = new Date().getTime();

    console.log(`[Figma]: Renaming layer time: ${endTime - startTime}s`);

    //figma.closePlugin();

  }

  if (msg.type === "close") {
    figma.closePlugin();
  }

  // If "init" msg type, check the Client Storage and send the model URL to the UI
  if (msg.type === "init") {
    // get current model from Client Storage
    // if no current model, use defaultModel

    let current_model: string = await figma.clientStorage.getAsync(filename);
    if (!current_model) {
      current_model = defaultModel;
    }
    console.log("current_model: ", current_model);

    // send current model to UI

    figma.ui.postMessage({
      type: "modelURL",
      payload: current_model,
    });
  }

  // if "resetModelURL" msg type, remove current_model from Client Storage and send the default model URL to the UI
  if (msg.type === "resetModelURL") {

    // remove current model from Client Storage
    await figma.clientStorage.setAsync(filename, "");
    // send default model to UI
    figma.ui.postMessage({
      type: "modelURL",
      payload: defaultModel,
    });
  }

  // Reset all storage data
  if (msg.type === "resetAllRequest") {
    // get all keys from Client Storage
    const keys = await figma.clientStorage.keysAsync();
    // notify number of keys and double check with user
    const resetAll = figma.notify(`You are about to reset ${keys.length} keys.`, {
      timeout: 10000,
      button: { text: "Confirm", action: () => { removeAllClientStoageData(keys); } }
    });
  }




  // if "updateModelURL" msg type, console.log msg and payload
  if (msg.type === "updateModelURL") {
    // update Client Storage
    await figma.clientStorage.setAsync(filename, msg.payload);
    figma.notify("Changes to the TFJS model have been saved.", {
      timeout: 1000,
    });
  }

  // if "downloadResults" msg type, download the results as an Excel file
  if (msg.type === "requestForDownloadList") {
    // Check keys in the Client Storage
    const keys = await figma.clientStorage.keysAsync();

    // Filter keys to only include the ones that are related to the current file
    // Use FindAll method to find all the nodes in the current file with the same ID as the keys

    const filteredKeys = keys.filter((key) => figma.currentPage.findAll((node) => node.id === key).length > 0 && key !== filename);


    // Get the prediction results from the Client Storage
    const downloadList: PredictionResult[] = await Promise.all(
      filteredKeys.map(async (key) => {
        const predictionResultJson = await figma.clientStorage.getAsync(key);
        return JSON.parse(predictionResultJson);
      })
    );

    // send DownloadList to UI
    figma.ui.postMessage({
      type: "download",
      payload: downloadList,
      filename: filename,
    });

  }
};

async function removeAllClientStoageData(keys) {
  console.log("Removing all Client Storage data...", keys);
  // remove all keys from Client Storage and notify user after completion
  await Promise.all(
    keys.map(async (key) => {
      await figma.clientStorage.deleteAsync(key);
    })
  );

  // get resetted keys from Client Storage
  const resettedKeys = await figma.clientStorage.keysAsync();

  // notify user that all Client Storage data has been removed

  figma.notify(`All Client Storage data has been removed. ${resettedKeys.length} keys remaining.`, {
    timeout: 1000,  
  });

}


async function renderElementsFromSelection(selection: readonly SceneNode[]) {
  const excludedTypes: NodeType[] = ["TEXT", "VECTOR", "COMPONENT", "COMPONENT_SET", "INSTANCE"];
  const allSelectedNodes: SceneNode[] | readonly SceneNode[] = selectOnlyTopLevelNodes ? selectOnlyTopLevelNode(figma.currentPage.selection) : selectAllNodesFromSelection(figma.currentPage.selection, excludedTypes);
  const binaryNodes: BinaryNode[] = await sceneNodeToBinaryNode(allSelectedNodes);

  return binaryNodes;
}

async function sceneNodeToBinaryNode(sceneNodes: SceneNode[] | readonly SceneNode[]): Promise<BinaryNode[]> {
  //Convert a scene node to my custom type: {id: 1, imageDataBytes: <uint8Array>}

  let renderedNodes: BinaryNode[] = [];

  for (const node of sceneNodes) {
    const baseNodeWidth: number = node.width;
    const baseNodeHeight: number = node.height;
    const largestMeasure = Math.max(baseNodeHeight, baseNodeWidth);
    const ratio = Number(224 / largestMeasure).toFixed(2);
    const nodeToRender = largestMeasure > 224 ? minifyNode(node, parseFloat(ratio)) : node;
    const frameTheNodeToRender: SceneNode = frameANode(nodeToRender);

    const id: string = node.id;
    //const bytes: Uint8Array = await node.exportAsync({format : "JPG"});
    const bytes: Uint8Array = await frameTheNodeToRender.exportAsync({ format: "JPG" });
    renderedNodes = [...renderedNodes, { nodeId: id, imageDataBytes: bytes }];
    if (nodeToRender !== node) {
      nodeToRender.remove();
    }
    if (frameTheNodeToRender !== node) {
      frameTheNodeToRender.remove();
    }
  }

  return renderedNodes;
}

function minifyNode(node: SceneNode, ratio: number): SceneNode {
  const minifiedNode: SceneNode = node.clone();
  minifiedNode.rescale(ratio);
  return minifiedNode;
}

function frameANode(node: SceneNode): SceneNode {
  const frame: FrameNode = figma.createFrame();
  const child: SceneNode = node.clone();
  frame.layoutMode = "HORIZONTAL";
  frame.counterAxisAlignItems = "CENTER";
  frame.primaryAxisAlignItems = "CENTER";
  frame.counterAxisSizingMode = "FIXED";
  frame.primaryAxisSizingMode = "FIXED";
  child.layoutAlign = "INHERIT";
  child.layoutGrow = 0;
  frame.insertChild(0, child);
  frame.resize(224, 224);


  return frame;
}

function selectAllNodesFromSelection(selection: readonly SceneNode[], excludeTypes: NodeType[]): SceneNode[] {

  let selectedNodes: SceneNode[] = [];
  let childrenFromSelectedNodes = [];

  selection.forEach((node: SceneNode) => {
    selectedNodes = [...selectedNodes, node]; //Push the primary nodes in the selection
    if (node.type === "FRAME" || node.type === "GROUP") {
      const children: SceneNode[] = node.findAll();
      childrenFromSelectedNodes = [...childrenFromSelectedNodes, children];
    }
  });

  const mergedChildrenFromSelectednodes: SceneNode[] = [].concat.apply([], childrenFromSelectedNodes);
  const selectedNodesAndAllChildren: SceneNode[] = selectedNodes.concat(mergedChildrenFromSelectednodes);
  const selectedNodesAndAllChildrenWithoutDuplicate: SceneNode[] = [...new Set(selectedNodesAndAllChildren)]; //Remove all duplicate (TODO: improve this)

  const nodesWithoutExcluded: SceneNode[] = selectedNodesAndAllChildrenWithoutDuplicate.filter((node) => {
    if (excludeTypes.includes(node.type)) {
      return false;
    } else {
      return true;
    }
  });

  return nodesWithoutExcluded;
}

function selectOnlyTopLevelNode(selection: readonly SceneNode[]): readonly SceneNode[] {
  let selectedNodes: readonly SceneNode[] = selection;
  return selectedNodes;
}

function sendImagesToUi(imagesInBytes: BinaryNode[], filename: string) {
  figma.ui.postMessage({ type: "processingRequest", data: imagesInBytes, filename: filename }); //Send message to browser API
}
