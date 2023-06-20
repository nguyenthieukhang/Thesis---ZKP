pragma solidity ^0.8.19;

interface IHasher {
  function MiMCSponge(uint256 in_xL, uint256 in_xR, uint256 k) external pure returns (uint256 xL, uint256 xR);
}

contract MerkleTree {
    uint8 constant LEVELS = 16;
    uint256 constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // So that when the user generate the proof,
    // and there are some other deposit, the user's root is still valid
    uint8 constant ROOT_HISTORY_SIZE = 16;
    uint256 constant zero_value = uint256(keccak256(abi.encodePacked("Phu ZKP va Khang Tornado")));
    uint256[] public roots;
    uint256 public current_root = 0;

    uint256[] public filled_subtrees;
    uint256[] public zeros;

    uint32 public next_index = 0;
    IHasher public immutable hasher;

    event LeafAdded(uint256 leaf, uint32 leaf_index);

    constructor(address _hasher) {
        hasher = IHasher(_hasher);
        zeros.push(zero_value);
        filled_subtrees.push(zeros[0]);

        for (uint8 i = 1; i < LEVELS; i++) {
            zeros.push(hashLeftRight(zeros[i - 1], zeros[i - 1]));
            filled_subtrees.push(zeros[i]);
        }

        roots = new uint256[](ROOT_HISTORY_SIZE);
        roots[0] = hashLeftRight(zeros[LEVELS - 1], zeros[LEVELS - 1]);
    }

    function hashLeftRight(
        uint256 _left,
        uint256 _right
    ) public view returns (uint256) {
        require(_left < FIELD_SIZE, "_left should be inside the field");
        require(_right < FIELD_SIZE, "_right should be inside the field");
        uint256 R = _left;
        uint256 C = 0;
        (R, C) = hasher.MiMCSponge(R, C, 0);
        R = addmod(R, _right, FIELD_SIZE);
        (R, C) = hasher.MiMCSponge(R, C, 0);
        return R;
    }

    function insert(uint256 leaf) internal {
        uint32 leaf_index = next_index;
        uint32 current_index = next_index;
        next_index += 1;

        uint256 current_level_hash = leaf;
        uint256 left;
        uint256 right;

        for (uint8 i = 0; i < LEVELS; i++) {
            if (current_index % 2 == 0) {
                left = current_level_hash;
                right = zeros[i];

                filled_subtrees[i] = current_level_hash;
            } else {
                left = filled_subtrees[i];
                right = current_level_hash;
            }

            current_level_hash = hashLeftRight(left, right);

            current_index /= 2;
        }

        current_root = (current_root + 1) % ROOT_HISTORY_SIZE;
        roots[current_root] = current_level_hash;

        emit LeafAdded(leaf, leaf_index);
    }

    function isKnownRoot(uint256 _root) internal view returns (bool) {
        if (_root == 0) {
            return false;
        }
        for (uint8 i = 0; i < ROOT_HISTORY_SIZE; i++) {
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
