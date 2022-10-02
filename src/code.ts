import type BinaryNode from "./interfaces/BinaryNode"
import type PredictionResult from "./interfaces/PredictionResult";

import isDebugMode from "src/utils/debugMode";

//Disable infinite recursivity in nodes or limit it
const selectOnlyTopLevelNodes: boolean = false;
const maxSubNodes: number = 3;
const pluginUiHeight = isDebugMode ? 424 : 200;


figma.showUI(__html__, {height: pluginUiHeight});


figma.ui.onmessage = async msg => {

  if (msg.type === "clickPredictButton") {

    if (figma.currentPage.selection.length < 1) {
      figma.ui.postMessage({type : "emptySelection"});
    } else {
      const imagesInBytes: BinaryNode[] = await renderElementsFromSelection(figma.currentPage.selection);
      sendImagesToUi(imagesInBytes);
    }
    
  }

  if (msg.type === "response") {
    const nodesToRename: SceneNode[] = selectAllNodesFromSelection(figma.currentPage.selection, ["TEXT"]);
    const msgPayload: PredictionResult[] = msg.payload;
    
    const startTime:  number = new Date().getTime();

    for (const node of nodesToRename) {
      for (let predictionResult of msgPayload) { //figma.findNodeById(id) existe aussi
        if (node.id === predictionResult.nodeId) {
          node.name = predictionResult.prediction;
        }
      }
    }

    const endTime: number = new Date().getTime();

    console.log(`[Figma]: Renaming layer time: ${endTime - startTime}s`);

    //figma.closePlugin();
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
  
}


async function renderElementsFromSelection (selection: readonly SceneNode[]) {

  const allSelectedNodes: SceneNode[] | readonly SceneNode[] = selectOnlyTopLevelNodes ? selectOnlyTopLevelNode(figma.currentPage.selection) : selectAllNodesFromSelection(figma.currentPage.selection, ["TEXT", "VECTOR"]);
  const binaryNodes: BinaryNode[] = await sceneNodeToBinaryNode(allSelectedNodes);

  return binaryNodes;
}

async function sceneNodeToBinaryNode (sceneNodes: SceneNode[] | readonly SceneNode[]): Promise<BinaryNode[]> {
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
    const bytes: Uint8Array = await frameTheNodeToRender.exportAsync({format : "JPG"});
    renderedNodes = [...renderedNodes, {nodeId : id, imageDataBytes : bytes}];
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
  child.layoutAlign = "INHERIT"
  child.layoutGrow = 0;
  frame.insertChild(0, child);
  frame.resize(224, 224);
  
  
  return frame;
}

function selectAllNodesFromSelection (selection: readonly SceneNode[], excludeTypes: string[]): SceneNode[] {

  let selectedNodes: SceneNode[] = [];
  let childrenFromSelectedNodes = [];

  selection.forEach((node: SceneNode) => {
    selectedNodes = [...selectedNodes, node]; //Push the primary nodes in the selection
    if (node.type === "FRAME" || node.type === "GROUP") {
      const children: SceneNode[] = node.findAll();
      childrenFromSelectedNodes = [...childrenFromSelectedNodes, children];
    }
  })

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

function sendImagesToUi (imagesInBytes: BinaryNode[]) {
  figma.ui.postMessage({type : "processingRequest", data : imagesInBytes}); //Send message to browser API
}