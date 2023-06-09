pragma solidity ^0.8.19;

contract MerkleTree {
    uint8 levels = 16;
    // So that when the user generate the proof,
    // and there are some other deposit, the user's root is still valid
    uint8 constant ROOT_HISTORY_SIZE = 32;
    bytes32 constant zero_value = keccak256(abi.encodePacked("Phu ZKP va Khang Tornado"));
    bytes32[] public roots;
    uint256 public current_root = 0;

    bytes32[] public filled_subtrees;
    bytes32[] public zeros;

    uint32 public next_index = 0;

    event LeafAdded(bytes32 leaf, uint32 leaf_index);

    constructor() {
        zeros.push(zero_value);
        filled_subtrees.push(zeros[0]);

        for (uint8 i = 1; i < levels; i++) {
            zeros.push(HashLeftRight(zeros[i - 1], zeros[i - 1]));
            filled_subtrees.push(zeros[i]);
        }

        roots = new bytes32[](ROOT_HISTORY_SIZE);
        roots[0] = HashLeftRight(zeros[levels - 1], zeros[levels - 1]);
    }

    function HashLeftRight(
        bytes32 left,
        bytes32 right
    ) public pure returns (bytes32 hashed) {
        return keccak256(abi.encodePacked(left, right));
    }

    function insert(bytes32 leaf) internal {
        uint32 leaf_index = next_index;
        uint32 current_index = next_index;
        next_index += 1;

        bytes32 current_level_hash = leaf;
        bytes32 left;
        bytes32 right;

        for (uint8 i = 0; i < levels; i++) {
            if (current_index % 2 == 0) {
                left = current_level_hash;
                right = zeros[i];

                filled_subtrees[i] = current_level_hash;
            } else {
                left = filled_subtrees[i];
                right = current_level_hash;
            }

            current_level_hash = HashLeftRight(left, right);

            current_index /= 2;
        }

        current_root = (current_root + 1) % ROOT_HISTORY_SIZE;
        roots[current_root] = current_level_hash;

        emit LeafAdded(leaf, leaf_index);
    }

    function isKnownRoot(bytes32 _root) internal view returns (bool) {
        if (_root == 0) {
            return false;
        }
        for (uint256 i = 0; i < ROOT_HISTORY_SIZE; i++) {
            if (_root == roots[i]) {
                return true;
            }
        }
        return false;
    }

    function getLastRoot() public view returns (bytes32) {
        return roots[current_root];
    }
}
