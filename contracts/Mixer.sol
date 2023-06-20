pragma solidity ^0.8.19;

import "./MerkleTree.sol";

abstract contract IVerifier {
    function verifyProof(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[2] memory input
        ) public virtual view returns (bool r);
}

contract Mixer is MerkleTree {
    uint256 public constant transferValue = 1;
    mapping(uint256 => bool) public nullifiers;
    IVerifier verifier;

    event Deposit(address from, uint256 commitment);
    event Withdraw(address to, uint256 nullifier);

    constructor(address _verifier, address _hasher) MerkleTree(_hasher) {
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

    function withdraw(uint[10] memory proof, uint256 root, uint256 nullifier, address payable receiver) public {
        require(!nullifiers[nullifier], "The note has been already spent");
        require(isKnownRoot(root), "Cannot find your merkle root"); // Make sure to use a recent one
        uint[2] memory a = [proof[0], proof[1]];
        uint[2][2] memory b = [[proof[2], proof[3]], [proof[4], proof[5]]];
        uint[2] memory c = [proof[6], proof[7]];
        uint[2] memory input = [proof[8], proof[9]];
        require(verifier.verifyProof(a, b, c, input), "Invalid withdraw proof");

        nullifiers[nullifier] = true;
        payable(receiver).transfer(transferValue);
        emit Withdraw(receiver, nullifier);
    }
}