import type BinaryNode from "./interfaces/BinaryNode"



figma.showUI(__html__);


async function renderElements () {
  const nodes: SceneNode[] = [];

  let imagesInBytes: BinaryNode[] = [];

  for (const node of figma.currentPage.selection) {
    const id: string = node.id;
    const bytes: Uint8Array = await node.exportAsync({format : "JPG"});
    imagesInBytes.push({nodeId : id, uint8Array : bytes});
  }
  return imagesInBytes;
}

function sendImagesToBackend (imagesInBytes: BinaryNode[]) {
  figma.ui.postMessage({type : "networkRequest", data : imagesInBytes}); //Send message to browser API
}



figma.ui.onmessage = async msg => {
  if (msg.type === "clickPredictButton") {
    const imagesInBytes: BinaryNode[] = await renderElements();
    sendImagesToBackend(imagesInBytes);
    
  }
  if (msg.type === "close") {
    figma.closePlugin();
  }
}