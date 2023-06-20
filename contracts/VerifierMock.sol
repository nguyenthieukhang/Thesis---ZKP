pragma solidity ^0.8.19;

import "./Mixer.sol";

// Mock contract implementing the IVerifier interface
contract VerifierMock is IVerifier {
    // Implement the functions defined in the IVerifier interface
    function verifyProof(uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[2] memory input) public pure override returns (bool) {
        // Mock implementation for testing purposes
        // Return the desired value or perform necessary checks
        return true;
    }
}
