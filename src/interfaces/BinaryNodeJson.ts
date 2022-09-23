interface BinaryNodeJson {
  nodeId : string;
  imageDataBytes : any;
}

export default BinaryNodeJson;

//An object like {nodeId : "abcd", imageDataBytes : {"0":122, "1":15, ...}}
//Don't change the type without changing the client side type (If send an object with node.imageDataBytes in client and attempt to recieve node.newImageDataBytes in server it will not work)