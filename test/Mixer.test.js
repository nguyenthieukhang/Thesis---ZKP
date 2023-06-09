const Mixer = artifacts.require("Mixer");
const VerifierMock = artifacts.require("VerifierMock");

const { assert } = require("chai");

contract("Mixer", (accounts) => {
    let mixerInstance;
    let verifier;
    const transferValue = 1;

    before(async () => {
        verifier = await VerifierMock.new();
        mixerInstance = await Mixer.new(verifier.address, transferValue);
    });

    it("should deposit with correct events", async () => {
        const commitment = web3.utils.keccak256("Test Commitment");
        const depositTx = await mixerInstance.deposit(commitment, { from: accounts[0], value: transferValue });

        // Verify the emitted events
        assert.strictEqual(depositTx.logs.length, 2, "Two events should be emitted");

        // Verify LeafAdded event from MerkleTree contract
        const leafAddedEvent = depositTx.logs[0];
        assert.strictEqual(leafAddedEvent.event, "LeafAdded", "Event should be 'LeafAdded'");
        assert.strictEqual(leafAddedEvent.args.leaf, commitment, "Event 'leaf' should match");
        assert.strictEqual(leafAddedEvent.args.leaf_index.toNumber(), 0, "Event 'leaf_index' should match");

        // Verify Deposit event from Mixer contract
        const depositEvent = depositTx.logs[1];
        assert.strictEqual(depositEvent.event, "Deposit", "Event should be 'Deposit'");
        assert.strictEqual(depositEvent.args.from, accounts[0], "Event 'from' address should match");
        assert.strictEqual(depositEvent.args.commitment, commitment, "Event 'commitment' should match");
    });
  });
