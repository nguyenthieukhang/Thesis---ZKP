pragma solidity ^0.8.0;

contract Verifier { // A dummy verifier
  function verify(bytes memory proof) public returns(bool) {
    return true;
  }
}