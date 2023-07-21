const { Command } = require('commander')
require('dotenv').config()
const fs = require("fs")
const assert = require('assert')
const program = new Command()
const snarkjs = require('snarkjs')
const crypto = require('crypto')
const circomlibjs = require('circomlibjs')
const { Web3 } = require('web3')
const merkleTree = require('fixed-merkle-tree')
const ffjavascript = require("ffjavascript")

const FIELD_SIZE_STRING = "21888242871839275222246405745257275088548364400416034343698204186575808495617"

const F = new ffjavascript.ZqField(
  ffjavascript.Scalar.fromString(
    FIELD_SIZE_STRING
  )
);
const buildPedersenHash = circomlibjs.buildPedersenHash
const buildBabyJub = circomlibjs.buildBabyjub
const buildMimcSponge = circomlibjs.buildMimcSponge

const BUFFER_SIZE = 31 // Compatible with the circuits
const MERKLE_TREE_HEIGHT = 32 // Compatible with the circuits and contracts
const ETH_AMOUNT = 1
const FIELD_SIZE = BigInt(FIELD_SIZE_STRING)
const zero_value = BigInt(0);
let senderAccount, contractJson, web3, tornado
let PRIVATE_KEY, MIXER_ADDRESS
let pedersen = buildPedersenHash()
let babyJub = buildBabyJub()
let mimcSponge

const buff2Int = buff => BigInt('0x' + buff.toString('hex'))

const Arr2Int = arr => BigInt('0x' + Buffer.from(arr).toString('hex'))

function int2Buff(bigInt, bufferSize = BUFFER_SIZE) {
  const hexString = bigInt.toString(16).padStart(bufferSize * 2, "0");
  return Buffer.from(hexString, "hex");
}

const rBigInt = () => buff2Int(crypto.randomBytes(BUFFER_SIZE))

async function pedersenHash(data) {
  return F.fromRprLEM((await babyJub).unpackPoint((await pedersen).hash(data))[0])
}

function hashLeftRight(left, right) {
  let C = BigInt(0);
  let R = BigInt(left);
  res = mimcSponge.hash(R, C, zero_value);
  R = BigInt(mimcSponge.F.toString(res.xL))
  C = BigInt(mimcSponge.F.toString(res.xR))
  R = (R + BigInt(right)) % FIELD_SIZE
  res = mimcSponge.hash(R, C, zero_value);
  R = BigInt(mimcSponge.F.toString(res.xL))
  return R
}

async function createDeposit({ nullifier, secret }) {
    const deposit = { nullifier, secret }
    deposit.preimage = Buffer.concat([int2Buff(deposit.nullifier), int2Buff(deposit.secret)])
    deposit.commitment = await pedersenHash(deposit.preimage)
    buff = int2Buff(deposit.nullifier)
    deposit.nullifierHash = await pedersenHash(int2Buff(deposit.nullifier))
    return deposit
}

async function printETHBalance({ address, name }) {
    console.log(`Getting balance from address ${address} with name ${name}...`)
    console.log(`${name} ETH balance is`, await web3.eth.getBalance(address))
}

async function deposit() {
    const deposit = await createDeposit({ nullifier: rBigInt(), secret: rBigInt() })
    const note = deposit.preimage.toString('hex').padStart(64, '0')
    const noteString = `Khang-and-Phu-0x${note}`
    console.log(`Your note: ${noteString}`)
    await printETHBalance({ address: tornado._address, name: 'Khang and Phu' })
    await printETHBalance({ address: senderAccount, name: 'Sender account' })
    latestBlock = await web3.eth.getBlock("latest")
    console.log('Submitting deposit transaction')
    const transactionData = tornado.methods.deposit(deposit.commitment).encodeABI();
    const signedTransaction = await web3.eth.accounts.signTransaction(
      {
        value: ETH_AMOUNT,
        from: senderAccount,
        to: MIXER_ADDRESS,
        data: transactionData,
        gas: 2e7,
        maxFeePerGas: BigInt(latestBlock.baseFeePerGas) * BigInt(2),
        maxPriorityFeePerGas: 0
      },
      PRIVATE_KEY
    );
    web3.eth.sendSignedTransaction(signedTransaction.rawTransaction)
    .on('transactionHash', (hash) => {
      console.log('Transaction hash:', hash);
    });
    // await tornado.methods.deposit(deposit.commitment).send({ value: ETH_AMOUNT, from: senderAccount, gas: 2e6 })
    // await printETHBalance({ address: tornado._address, name: 'Khang and Phu' })
    // await printETHBalance({ address: senderAccount, name: 'Sender account' })
    return noteString
}

async function parseNote(noteString) {
    const noteRegex = /Khang-and-Phu-0x(?<note>[0-9a-fA-F]{124})/g
    const match = noteRegex.exec(noteString)
    if (!match) {
      throw new Error('The note has invalid format')
    }

    const buff = Buffer.from(match.groups.note, 'hex')
    const nullifier = buff2Int(buff.subarray(0, BUFFER_SIZE))
    const secret = buff2Int(buff.subarray(BUFFER_SIZE, 2 * BUFFER_SIZE))
    const deposit = await createDeposit({ nullifier, secret })

    const note = '0x' + deposit.preimage.toString('hex').padStart(64, '0')
    const noteString_ = `Khang-and-Phu-${note}`
    assert(noteString_.localeCompare(noteString) == 0, 'The parsing function is wrong!')
    return deposit
}

async function generateMerkleProof(deposit) {
    // Get all deposit events from smart contract and assemble merkle tree from them
    console.log('Getting current state from mixer contract')
    const events = await tornado.getPastEvents('LeafAdded', { fromBlock: 0, toBlock: 'latest' })
    const leaves = events
      .sort((a, b) => {
        diff = a.returnValues.leaf_index - b.returnValues.leaf_index
        if(diff > 0) {
          return 1;
        } else if (diff < 0){
          return -1;
        } else {
          return 0;
        }
      }) // Sort events in chronological order
      .map(e => e.returnValues.leaf)
    const tree = new merkleTree.MerkleTree(MERKLE_TREE_HEIGHT, leaves, {zeroElement: zero_value, hashFunction: hashLeftRight})
    console.log('Leaves array:');
    leaves.forEach((leaf, index) => {
      console.log(`Leaf ${index + 1}: ${leaf}`);
    });

    // Find current commitment in the tree
    console.log(`The value we are looking for is ${deposit.commitment}`)
    const depositEvent = events.find(e => e.returnValues.leaf === deposit.commitment)
    const leafIndex = depositEvent ? Number(depositEvent.returnValues.leaf_index) : -1

    // Validate that our data is correct
    const root = tree.root
    try {
      const lastRoot = await tornado.methods.getLastRoot().call();
      // console.log('Last Root:', lastRoot.toString());
    } catch (error) {
      console.error('Error retrieving last root:', error);
    }
    const isValidRoot = await tornado.methods.isKnownRoot(BigInt(root)).call()
    const isSpent = await tornado.methods.isSpent(deposit.nullifierHash).call()
    assert(isValidRoot === true, 'Merkle tree is corrupted')
    assert(isSpent === false, 'The note is already spent')
    assert(leafIndex >= 0, 'The deposit is not found in the tree')

    // Compute merkle proof of our commitment
    const { pathElements, pathIndices } = tree.path(leafIndex)
    return { pathElements, pathIndices, root: BigInt(tree.root) }
  }

async function generateProof({ deposit, recipient }) {
    // Compute merkle proof of our commitment
    const { root, pathElements, pathIndices } = await generateMerkleProof(deposit)

    function reverseBuffer(buffer) {
      const reversedBuffer = Buffer.from(buffer);
      reversedBuffer.reverse();
      return reversedBuffer;
    }
    // Prepare circuit input
    const input = {
      // Public snark inputs
      root: root,
      nullifierHash: deposit.nullifierHash,

      // Private snark inputs
      nullifier: Arr2Int(reverseBuffer(int2Buff(deposit.nullifier))),
      secret: Arr2Int(reverseBuffer(int2Buff(deposit.secret))),
      pathElements: pathElements,
      pathIndices: pathIndices,
    }

    console.log('Generating SNARK proof')
    console.time('Proof time')
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, "./circuits/WithDraw_js/WithDraw.wasm", "./circuits/WithDraw_0001.zkey");
    console.timeEnd('Proof time')
    // console.log("Proof: ");
    // console.log(JSON.stringify(proof, null, 1));
    // console.log('Public signals:')
    // console.log(JSON.stringify(publicSignals, null, 1));

    const vKey = JSON.parse(fs.readFileSync("./circuits/verification_key.json"));

    const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    if (res === true) {
        console.log("Offline verification OK");
    } else {
        console.log("Invalid proof");
    }

    const args = [
      BigInt(input.root),
      BigInt(input.nullifierHash),
      recipient
    ]

    proofArr = [proof.pi_a[0], proof.pi_a[1], proof.pi_b[0][1], proof.pi_b[0][0], proof.pi_b[1][1], proof.pi_b[1][0], proof.pi_c[0], proof.pi_c[1], publicSignals[0], publicSignals[1]]

    return { proofArr, args }
}

async function withdraw({ deposit, recipient }) {
    const { proofArr, args } = await generateProof({ deposit, recipient })
    console.log('Submitting withdraw transaction')
    latestBlock = await web3.eth.getBlock("latest")
    const transactionData = tornado.methods.withdraw(proofArr, ...args).encodeABI();
    const signedTransaction = await web3.eth.accounts.signTransaction(
      {
        from: senderAccount,
        to: MIXER_ADDRESS,
        data: transactionData,
        gas: 2e7,
        maxFeePerGas: BigInt(latestBlock.baseFeePerGas) * BigInt(2),
        maxPriorityFeePerGas: 0
      },
      PRIVATE_KEY
    );
    web3.eth.sendSignedTransaction(signedTransaction.rawTransaction)
    .on('transactionHash', (hash) => {
      console.log('Transaction hash:', hash);
    });
    // await tornado.methods.withdraw(proofArr, ...args).send({ from: senderAccount, gas: 2e6 })
}

async function init() {
    contractJson = require('./build/contracts/Mixer.json')
    PRIVATE_KEY = process.env.PRIVATE_KEY
    MIXER_ADDRESS = process.env.MIXER_ADDRESS
    RPC = process.env.RPC
    web3 = new Web3(RPC)
    console.log(`The RPC URL is ${RPC}`)
    console.log(`The private key found is ${PRIVATE_KEY}`)
    if (PRIVATE_KEY) {
        const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY)
        web3.eth.accounts.wallet.add(PRIVATE_KEY)
        web3.eth.defaultAccount = account.address
        senderAccount = account.address
    } else {
        console.log('Warning! PRIVATE_KEY not found. Please provide PRIVATE_KEY in .env file if you deposit')
    }
    tornado = new web3.eth.Contract(contractJson.abi, MIXER_ADDRESS)
    mimcSponge = await buildMimcSponge()
}

async function main() {
    program
      .command('deposit')
      .description('Submit a 0.00000001 ETH deposit to the mixer and retrieve a note which can be used to get back the money later')
      .action(async () => {
        await init()
        noteString = await deposit()
        console.log(`Here is your note, please keep it safe so that you can withdraw later:\n${noteString}`)
      })
    program
      .command('balance <address>')
      .description('Check ETH balance')
      .action(async (address) => {
        await init()
        await printETHBalance({ address, name: '' })
      })
    program
      .command('withdraw <note> <recipient>')
      .description('Withdraw a note to a recipient account')
      .action(async (noteString, recipient) => {
        const deposit = await parseNote(noteString)
        await init()
        await withdraw({ deposit, recipient })
      })
    program.parse(process.argv)
}

main()