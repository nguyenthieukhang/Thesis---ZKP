pragma solidity ^0.8.19;

contract MerkleTree {
    uint8 levels;

    uint8 constant ROOT_HISTORY_SIZE = 100;
    uint256[] public roots;
    uint256 public current_root = 0;

    uint256[] public filled_subtrees;
    uint256[] public zeros;

    uint32 public next_index = 0;

    event LeafAdded(uint256 leaf, uint32 leaf_index);

    constructor(uint8 tree_levels, uint256 zero_value) public {
        levels = tree_levels;

        zeros.push(zero_value);
        filled_subtrees.push(zeros[0]);

        for (uint8 i = 1; i < levels; i++) {
            zeros.push(HashLeftRight(zeros[i - 1], zeros[i - 1]));
            filled_subtrees.push(zeros[i]);
        }

        roots = new uint256[](ROOT_HISTORY_SIZE);
        roots[0] = HashLeftRight(zeros[levels - 1], zeros[levels - 1]);
    }

    function HashLeftRight(
        uint256 left,
        uint256 right
    ) public pure returns (uint256 hashed) {
        bytes32 hash = keccak256(abi.encodePacked(left, right));
        return uint256(hash);
    }

    function insert(uint256 leaf) internal {
        uint32 leaf_index = next_index;
        uint32 current_index = next_index;
        next_index += 1;

        uint256 current_level_hash = leaf;
        uint256 left;
        uint256 right;

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

    function isKnownRoot(uint _root) internal view returns (bool) {
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

    function getLastRoot() public view returns (uint256) {
        return roots[current_root];
    }
}
