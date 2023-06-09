pragma solidity ^0.8.19;

import "./Mixer.sol";

// Mock contract implementing the IVerifier interface
contract VerifierMock is IVerifier {
    // Implement the functions defined in the IVerifier interface
    function verify(bytes memory proof) public override returns (bool) {
        // Mock implementation for testing purposes
        // Return the desired value or perform necessary checks
        return true;
    }
}
