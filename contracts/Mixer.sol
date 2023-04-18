pragma solidity ^0.8.19;

import "./MerkleTree.sol";

abstract contract IVerifier {
    function verify(bytes memory proof) public virtual returns (bool);
}

contract Mixer is MerkleTree {
    uint256 public transferValue;
    mapping(uint256 => bool) public nullifiers;
    IVerifier verifier;

    event Deposit(address from, uint256 commitment);
    event Withdraw(address to, uint256 nullifier);

    constructor(address _verifier, uint256 _transferValue) public MerkleTree(16, 0) {
        verifier = IVerifier(_verifier);
        transferValue = _transferValue;
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
        require(verifier.verify(proof), "Invalid withdraw proof");

        nullifiers[nullifier] = true;
        payable(receiver).transfer(transferValue);
        emit Withdraw(receiver, nullifier);
    }
}
