pragma solidity ^0.8.19;

import "./MerkleTree.sol";

abstract contract IVerifier {
    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[0] calldata _pubSignals) public view returns (bool);
}

contract Mixer is MerkleTree {
    uint256 public transferValue;
    mapping(uint256 => bool) public nullifiers;
    IVerifier verifier;

    event Deposit(address from, bytes32 commitment);
    event Withdraw(address to, uint256 nullifier);

    constructor(address _verifier) MerkleTree() {
        verifier = IVerifier(_verifier);
        transferValue = 0.001;
    }

    function deposit(bytes32 commitment) public payable {
        require(
            msg.value == transferValue,
            "Please send `transferValue` ETH along with transaction"
        );
        insert(commitment);
        emit Deposit(msg.sender, commitment);
    }

    function withdraw(bytes memory proof, bytes32 root, uint256 nullifier, address payable receiver) public {
        require(!nullifiers[nullifier], "The note has been already spent");
        require(isKnownRoot(root), "Cannot find your merkle root"); // Make sure to use a recent one
        require(verifier.verifyProof(proof), "Invalid withdraw proof");

        nullifiers[nullifier] = true;
        payable(receiver).transfer(transferValue);
        emit Withdraw(receiver, nullifier);
    }
}