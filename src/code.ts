import type BinaryNode from "./interfaces/BinaryNode"
import type PredictionResult from "./interfaces/PredictionResult";

import isDebugMode from "src/utils/debugMode";

//Disable infinite recursivity in nodes or limit it
const selectOnlyTopLevelNodes: boolean = false;
const maxSubNodes: number = 3;
const pluginUiHeight = isDebugMode ? 424 : 216;


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

    const excludedTypes: NodeType[] = ["TEXT", "VECTOR", "COMPONENT", "COMPONENT_SET", "INSTANCE"];
    const nodesToRename: SceneNode[] = selectAllNodesFromSelection(figma.currentPage.selection, excludedTypes);
    const msgPayload: PredictionResult[] = msg.payload;
    
    const startTime:  number = new Date().getTime();

    for (const node of nodesToRename) {
      node.name = "Frame"; //Rename all node "Frame" before renaming to avoid conflicts in exceptions
      for (let predictionResult of msgPayload) { //figma.findNodeById(id) existe too
        if (node.id === predictionResult.nodeId) {
          node.name = predictionResult.prediction;
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
          node.name = "Image"
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
  
}


async function renderElementsFromSelection (selection: readonly SceneNode[]) {

  const excludedTypes: NodeType[] = ["TEXT", "VECTOR", "COMPONENT", "COMPONENT_SET", "INSTANCE"];
  const allSelectedNodes: SceneNode[] | readonly SceneNode[] = selectOnlyTopLevelNodes ? selectOnlyTopLevelNode(figma.currentPage.selection) : selectAllNodesFromSelection(figma.currentPage.selection, excludedTypes);
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

function selectAllNodesFromSelection (selection: readonly SceneNode[], excludeTypes: NodeType[]): SceneNode[] {

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