const MerkleTree = artifacts.require("MerkleTree");
const { assert } = require("chai");

contract("MerkleTree", (accounts) => {
  let merkleTreeInstance;

  before(async () => {
    merkleTreeInstance = await MerkleTree.new();
  });

//   it("should correctly compute the hash of 2 child nodes", async () => {
//     const childNode1 = web3.utils.keccak256("Khang");
//     const childNode2 = web3.utils.keccak256("Phu");
//     const father = web3.utils.soliditySha3(childNode1, childNode2);
//     const result = await merkleTreeInstance.HashLeftRight(childNode1, childNode2);
//     assert.equal(result, father, "Incorrect hash value returned");
//   });

//   it("should add a leaf and retrieve the last root", async () => {
//     const leaf = web3.utils.keccak256("example leaf");

//     // Add the leaf to the Merkle tree
//     await merkleTreeInstance.insert(leaf);

//     // Retrieve the last root
//     const lastRoot = await merkleTreeInstance.getLastRoot();

//     // Verify that the last root matches the expected value
//     assert.equal(lastRoot, leaf, "Last root doesn't match the added leaf");
//   });

//   it("should check if a root is known", async () => {
//     const leaf = web3.utils.keccak256("example leaf");

//     // Add the leaf to the Merkle tree
//     await merkleTreeInstance.insert(leaf);

//     // Retrieve the last root
//     const lastRoot = await merkleTreeInstance.getLastRoot();

//     // Check if the last root is known
//     const isKnown = await merkleTreeInstance.isKnownRoot(lastRoot);

//     // Verify that the last root is known
//     assert.isTrue(isKnown, "Last root is not known");
//   });
});
