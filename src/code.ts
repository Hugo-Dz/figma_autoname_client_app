import type BinaryNode from "./interfaces/BinaryNode"
import type PredictionResult from "./interfaces/PredictionResult";


//Disable infinite recursivity in nodes or limit it
const selectOnlyTopLevelNodes: boolean = true;
const maxSubNodes: number = 3;


figma.showUI(__html__);


figma.ui.onmessage = async msg => {

  if (msg.type === "clickPredictButton") {
    const imagesInBytes: BinaryNode[] = await renderElementsFromSelection(figma.currentPage.selection);
    sendImagesToBackend(imagesInBytes);
    
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }

  if (msg.type === "response") {
    const nodesToRename: SceneNode[] = selectAllNodesFromSelection(figma.currentPage.selection, "TEXT");
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

    console.log(`FIGMA RENAME LAYERS Execution time in Figma: ${endTime - startTime}s`);

    figma.closePlugin();
  }
  
}


async function renderElementsFromSelection (selection: readonly SceneNode[]) {

  const allSelectedNodes: SceneNode[] | readonly SceneNode[] = selectOnlyTopLevelNodes ? selectOnlyTopLevelNode(figma.currentPage.selection, "TEXT") : selectAllNodesFromSelection(figma.currentPage.selection, "TEXT");
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

    const id: string = node.id;
    //const bytes: Uint8Array = await node.exportAsync({format : "JPG"});
    const bytes: Uint8Array = await nodeToRender.exportAsync({format : "JPG"});
    renderedNodes = [...renderedNodes, {nodeId : id, imageDataBytes : bytes}];
    if (nodeToRender !== node) {
      nodeToRender.remove();
    }
  }

  return renderedNodes;
}

function minifyNode(node: SceneNode, ratio: number): SceneNode {
    const minifiedNode: SceneNode = node.clone();
    minifiedNode.rescale(ratio);
    return minifiedNode;
}

function selectAllNodesFromSelection (selection: readonly SceneNode[], exludeType: string): SceneNode[] {

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

  const nodesWithoutText: SceneNode[] = selectedNodesAndAllChildrenWithoutDuplicate.filter((node) => node.type !== exludeType);

  return nodesWithoutText;
}

function selectOnlyTopLevelNode(selection: readonly SceneNode[], exludeType: string): readonly SceneNode[] {
  let selectedNodes: readonly SceneNode[] = selection;
  return selectedNodes;
}

function sendImagesToBackend (imagesInBytes: BinaryNode[]) {
  figma.ui.postMessage({type : "networkRequest", data : imagesInBytes}); //Send message to browser API
}