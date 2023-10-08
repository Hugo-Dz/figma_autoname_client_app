import type BinaryNode from "./interfaces/BinaryNode";
import type PredictionResult from "./interfaces/PredictionResult";

import isDebugMode from "src/utils/debugMode";
import toAndroidResourceName from "src/utils/toAndroidResourceName";

//Disable infinite recursivity in nodes or limit it
const selectOnlyTopLevelNodes: boolean = false;
const maxSubNodes: number = 3;
const pluginUiHeight = isDebugMode ? 500 : 280;

let customTFModel = process.env.PUBLIC_CUSTOM_MODEL;
const defaultModel: string = customTFModel
  ? customTFModel
  : "https://teachablemachine.withgoogle.com/models/7TY9ihr-l/";
const filename: string = toAndroidResourceName(figma.root.name);

figma.showUI(__html__, { height: pluginUiHeight }); // Start the plugin UI with a specific height
// set up the initial state
figma.ui.postMessage({
  type: "devModeSelection",
  payload: null,
  editorType: "design",
});

figma.ui.onmessage = async (msg) => {
  if (msg.type === "clickPredictButton") {
    if (figma.currentPage.selection.length < 1) {
      figma.ui.postMessage({ type: "emptySelection" });
    } else {
      const imagesInBytes: BinaryNode[] = await renderElementsFromSelection(
        figma.currentPage.selection
      );
      const filename: string = toAndroidResourceName(figma.root.name);
      sendImagesToUi(imagesInBytes, filename);
    }
  }

  if (msg.type === "response") {
    const excludedTypes: NodeType[] = [
      "TEXT",
      "VECTOR",
      "COMPONENT",
      "COMPONENT_SET",
      "INSTANCE",
    ];
    const nodesToRename: SceneNode[] = selectAllNodesFromSelection(
      figma.currentPage.selection,
      excludedTypes
    );
    const msgPayload: PredictionResult[] = msg.payload;

    const startTime: number = new Date().getTime();

    for (const node of nodesToRename) {
      node.name = "Frame"; //Rename all node "Frame" before renaming to avoid conflicts in exceptions

      for (let predictionResult of msgPayload) {
        if (node.id === predictionResult.nodeId) {
          node.name = predictionResult.prediction; // Update the node name with the prediction result
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
          const areChildrenAllTextNodes: boolean = children.every(
            (node) => node.type === "TEXT"
          );
          if (areChildrenAllTextNodes) {
            node.name = "Paragraph container";
          }
        }
      }
      //Handle container naming
      const parent: BaseNode & ChildrenMixin = node.parent;
      if (
        parent.name === node.name &&
        parent.name !== "Container" &&
        parent.name !== "Card" &&
        parent.name !== "Horizontal container" &&
        parent.name !== "Vertical container"
      ) {
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

  if (msg.type === "init") {
    // get current model from Client Storage
    // if no current model, use defaultModel

    let current_model: string = await figma.clientStorage.getAsync(filename);
    if (!current_model) {
      current_model = defaultModel;
    }
    console.log("current_model: ", current_model);

    // get design system URL from Client Storage
    // if no design system URL, use null
    let designSystemURL: string = await figma.clientStorage.getAsync(
      filename + "_designSystemURL"
    );
    if (!designSystemURL) {
      designSystemURL = null;
    }
    console.log("designSystemURL: ", designSystemURL);

    // send current model and design system URL to UI
    figma.ui.postMessage({
      type: "modelURL",
      payload: {
        modelURL: current_model,
        designSystemURL: designSystemURL,
      },
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

  // // Reset all storage data
  // if (msg.type === "resetAllRequest") {
  //   // get all keys from Client Storage
  //   const keys = await figma.clientStorage.keysAsync();
  //   // notify number of keys and double check with user
  //   const resetAll = figma.notify(
  //     `You are about to reset ${keys.length} keys.`,
  //     {
  //       timeout: 10000,
  //       button: {
  //         text: "Confirm",
  //         action: () => {
  //           removeAllClientStoageData(keys);
  //         },
  //       },
  //     }
  //   );
  // }

  // if "updateModelURL" msg type, console.log msg and payload
  if (msg.type === "updateModelURL") {
    // update Client Storage
    await figma.clientStorage.setAsync(filename, msg.payload);
    figma.notify("Changes to the TFJS model have been saved.", {
      timeout: 1000,
    });
  }

  // // if "requestLog" msg type, console log Figma client storage
  // if (msg.type === "requestLog") {
  //   // get all keys from Client Storage
  //   const keys = await figma.clientStorage.keysAsync();

  //   // get all values from Client Storage, parse them and console log them
  //   await Promise.all(
  //     keys.map(async (key) => {
  //       const value = await figma.clientStorage.getAsync(key);
  //       try {
  //         // Try parsing the value as JSON
  //         const parsedValue = JSON.parse(value);
  //         console.log(`Key: ${key}`, parsedValue);
  //       } catch (error) {
  //         // If an error occurs, log the error and the original value
  //         console.warn(`Error parsing value for key "${key}": ${error}`);
  //         console.log(`Original value: ${value}`);
  //       }
  //     })
  //   );
  // }

  if (msg.type === "top3Probabilities") {
    // Get design system URL from Client Storage
    let designSystemURL: string = await figma.clientStorage.getAsync(
      filename + "_designSystemURL"
    );

    if (!designSystemURL) {
      // stop if no design system URL
      console.log(
        "No design system URL found. Please set a design system URL in the plugin UI."
      );
    } else {
      const nodeId = msg.id;
      const top3Probabilities = msg.payload;

      const node = figma.getNodeById(nodeId);
      if (node) {
        top3Probabilities.forEach(async (prediction, index) => {
          const predictionText = `Prediction ${index + 1}: ${
            prediction.className
          } (${Math.round(prediction.probability * 100)}%)`;
          console.log(predictionText);

          // Convert className to lowercase and replace spaces with dashes
          const classNameURL = prediction.className
            .toLowerCase()
            .replace(/\s+/g, "-");
          const fullURL = designSystemURL + classNameURL;

          // Get existing dev resources
          const links = await node.getDevResourcesAsync();

          // If the URL already exists, edit it. Otherwise, add a new one.
          if (links.some((link) => link.url === fullURL)) {
            await node.editDevResourceAsync(fullURL, {
              name: predictionText,
              url: fullURL,
            });
          } else {
            await node.addDevResourceAsync(fullURL, predictionText);
          }
        });
      }
    }
  }

  if (msg.type === "updateDesignSystemURL") {
    const designSystemURL = msg.payload;

    // Save the URL to client storage
    await figma.clientStorage.setAsync(
      filename + "_designSystemURL",
      designSystemURL
    );
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

  figma.notify(
    `All Client Storage data has been removed. ${resettedKeys.length} keys remaining.`,
    {
      timeout: 1000,
    }
  );
}

async function renderElementsFromSelection(selection: readonly SceneNode[]) {
  const excludedTypes: NodeType[] = [
    "TEXT",
    "VECTOR",
    "COMPONENT",
    "COMPONENT_SET",
    "INSTANCE",
  ];
  const allSelectedNodes: SceneNode[] | readonly SceneNode[] =
    selectOnlyTopLevelNodes
      ? selectOnlyTopLevelNode(figma.currentPage.selection)
      : selectAllNodesFromSelection(figma.currentPage.selection, excludedTypes);
  const binaryNodes: BinaryNode[] = await sceneNodeToBinaryNode(
    allSelectedNodes
  );

  return binaryNodes;
}

async function sceneNodeToBinaryNode(
  sceneNodes: SceneNode[] | readonly SceneNode[]
): Promise<BinaryNode[]> {
  //Convert a scene node to my custom type: {id: 1, imageDataBytes: <uint8Array>}

  let renderedNodes: BinaryNode[] = [];

  for (const node of sceneNodes) {
    const baseNodeWidth: number = node.width;
    const baseNodeHeight: number = node.height;
    const largestMeasure = Math.max(baseNodeHeight, baseNodeWidth);
    const ratio = Number(224 / largestMeasure).toFixed(2);
    const nodeToRender =
      largestMeasure > 224 ? minifyNode(node, parseFloat(ratio)) : node;
    const frameTheNodeToRender: SceneNode = frameANode(nodeToRender);

    const id: string = node.id;
    //const bytes: Uint8Array = await node.exportAsync({format : "JPG"});
    const bytes: Uint8Array = await frameTheNodeToRender.exportAsync({
      format: "JPG",
    });
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

function selectAllNodesFromSelection(
  selection: readonly SceneNode[],
  excludeTypes: NodeType[]
): SceneNode[] {
  let selectedNodes: SceneNode[] = [];
  let childrenFromSelectedNodes = [];

  selection.forEach((node: SceneNode) => {
    selectedNodes = [...selectedNodes, node]; //Push the primary nodes in the selection
    if (node.type === "FRAME" || node.type === "GROUP") {
      const children: SceneNode[] = node.findAll();
      childrenFromSelectedNodes = [...childrenFromSelectedNodes, children];
    }
  });

  const mergedChildrenFromSelectednodes: SceneNode[] = [].concat.apply(
    [],
    childrenFromSelectedNodes
  );
  const selectedNodesAndAllChildren: SceneNode[] = selectedNodes.concat(
    mergedChildrenFromSelectednodes
  );
  const selectedNodesAndAllChildrenWithoutDuplicate: SceneNode[] = [
    ...new Set(selectedNodesAndAllChildren),
  ]; //Remove all duplicate (TODO: improve this)

  const nodesWithoutExcluded: SceneNode[] =
    selectedNodesAndAllChildrenWithoutDuplicate.filter((node) => {
      if (excludeTypes.includes(node.type)) {
        return false;
      } else {
        return true;
      }
    });

  return nodesWithoutExcluded;
}

function selectOnlyTopLevelNode(
  selection: readonly SceneNode[]
): readonly SceneNode[] {
  let selectedNodes: readonly SceneNode[] = selection;
  return selectedNodes;
}

function sendImagesToUi(imagesInBytes: BinaryNode[], filename: string) {
  figma.ui.postMessage({
    type: "processingRequest",
    data: imagesInBytes,
    filename: filename,
  }); //Send message to browser API
}
