pragma solidity ^0.8.19;

import "./MerkleTree.sol";

abstract contract IVerifier {
    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[0] calldata _pubSignals) public view returns (bool);
}

contract Mixer is MerkleTree {
    uint256 public constant transferValue = 0.00000001;
    mapping(uint256 => bool) public nullifiers;
    IVerifier verifier;

    event Deposit(address from, uint256 commitment);
    event Withdraw(address to, uint256 nullifier);

    constructor(address _verifier) MerkleTree() {
        verifier = IVerifier(_verifier);
    }

    function deposit(uint256 commitment) public payable {
        require(
            msg.value == transferValue,
            "Please send `transferValue` ETH along with transaction"
        );
        insert(commitment);
        emit Deposit(msg.sender, commitment);
    }

    function withdraw(bytes memory proof, uint256 root, uint256 nullifier, address payable receiver) public {
        require(!nullifiers[nullifier], "The note has been already spent");
        require(isKnownRoot(root), "Cannot find your merkle root"); // Make sure to use a recent one
        require(verifier.verifyProof(proof), "Invalid withdraw proof");

        nullifiers[nullifier] = true;
        payable(receiver).transfer(transferValue);
        emit Withdraw(receiver, nullifier);
    }
}