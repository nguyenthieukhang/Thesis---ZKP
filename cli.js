const { Command } = require('commander');
require('dotenv').config();
const assert = require('assert');
const program = new Command();
const snarkjs = require('snarkjs')
const crypto = require('crypto')
const circomlib = require('circomlib')
const circomlibjs = require('circomlibjs')
const { Web3 } = require('web3')
const merkleTree = require('fixed-merkle-tree')
const ethers = require('ethers');
const buildPedersenHash = circomlibjs.buildPedersenHash
const buildBabyJub = circomlibjs.buildBabyjub
const buildMimcSponge = circomlibjs.buildMimcSponge

const BUFFER_SIZE = 31
const MERKLE_TREE_HEIGHT = 32
const ETH_AMOUNT = 1
const MIXER_ADDRESS = '0x707e104e96b68C052271c84eBA79B7DfFc665B9d'
const HASHER_ADDRESS = '0x008738D6aBE2ac2B974446a683D6f8cA8092cCa4'
const FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')
const zero_value = BigInt(0);
let circuit, proving_key, senderAccount, contractJson, web3, tornado, hasherJson, hasher
let PRIVATE_KEY
let pedersen = buildPedersenHash()
let babyJub = buildBabyJub()
let mimcSponge

const buff2Int = buff => BigInt('0x' + buff.toString('hex'))

const Arr2Int = arr => BigInt('0x' + Buffer.from(arr).toString('hex')) % FIELD_SIZE

const Arr2Int2 = arr => BigInt('0x' + Buffer.from(arr).toString('hex'))

// const int2Buff = bigint => Buffer.from(bigint.toString(16), 'hex');

function int2Buff(bigInt, bufferSize = 31) {
  const hexString = bigInt.toString(16).padStart(bufferSize * 2, "0");
  return Buffer.from(hexString, "hex");
}

const rBigInt = () => buff2Int(crypto.randomBytes(BUFFER_SIZE))

const pedersenHash = async data => (await babyJub).unpackPoint((await pedersen).hash(data))[0]

function hashLeftRight(left, right) {
  let C = BigInt(0);
  let R = BigInt(left);
  res = mimcSponge.hash(R, C, BigInt(0));
  R = BigInt(mimcSponge.F.toString(res.xL))
  C = BigInt(mimcSponge.F.toString(res.xR))
  R = (R + BigInt(right)) % FIELD_SIZE
  res = mimcSponge.hash(R, C, BigInt(0));
  R = BigInt(mimcSponge.F.toString(res.xL))
  return R
}

async function createDeposit({ nullifier, secret }) {
    const deposit = { nullifier, secret }
    deposit.preimage = Buffer.concat([int2Buff(deposit.nullifier), int2Buff(deposit.secret)])
    deposit.commitment = await pedersenHash(deposit.preimage)
    buff = int2Buff(deposit.nullifier)
    console.log(`The size of nullifier is ${buff.length*8}`)
    deposit.nullifierHash = await pedersenHash(int2Buff(deposit.nullifier))
    if(BigInt('0x' + Buffer.from(deposit.commitment).toString('hex')) >= FIELD_SIZE) {
      console.log(`Warning! This is a strange number ${BigInt('0x' + Buffer.from(deposit.commitment).toString('hex'))}`)
    }
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
    console.log('Submitting deposit transaction')
    console.log(`The deposit commitment is ${Arr2Int(deposit.commitment)} and the type is ${typeof Arr2Int(deposit.commitment)}`)
    await tornado.methods.deposit(Arr2Int(deposit.commitment)).send({ value: ETH_AMOUNT, from: senderAccount, gas: 2e6 })
    await printETHBalance({ address: tornado._address, name: 'Khang and Phu' })
    await printETHBalance({ address: senderAccount, name: 'Sender account' })
    return noteString
}

async function parseNote(noteString) {
    const noteRegex = /Khang-and-Phu-0x(?<note>[0-9a-fA-F]{124})/g
    const match = noteRegex.exec(noteString)
    if (!match) {
      throw new Error('The note has invalid format')
    }

    const buff = Buffer.from(match.groups.note, 'hex')
    const nullifier = buff2Int(buff.subarray(0, 31))
    const secret = buff2Int(buff.subarray(31, 62))
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
    console.log(`The value we are looking for is ${Arr2Int(deposit.commitment)}`)
    console.log(`All events are ${events}`)
    const depositEvent = events.find(e => e.returnValues.leaf === Arr2Int(deposit.commitment))
    const leafIndex = depositEvent ? Number(depositEvent.returnValues.leaf_index) : -1

    // Validate that our data is correct
    const root = tree.root
    console.log(`The root is ${BigInt(await root)}`)
    try {
      const lastRoot = await tornado.methods.getLastRoot().call();
      console.log('Last Root:', lastRoot.toString());
    } catch (error) {
      console.error('Error retrieving last root:', error);
    }
    console.log(`The current client zero is ${zero_value}`)
    console.log(`The zero value of the contract is ${BigInt(await tornado.methods.zero_value().call())}`)
    let l = 12
    let r = 18789
    console.log(`The hash of l and r for client is ${hashLeftRight(l, r)}`)
    console.log(`The hash of l and r for contract is ${BigInt(await tornado.methods.hashLeftRight(l, r).call())}`)
    const resContract = await hasher.methods.MiMCSponge(l, r, 0).call()
    const resJs = mimcSponge.hash(l, r, 0)
    console.log(`The mimcSponge hash of client is ${mimcSponge.F.toString(resJs.xL)}`)
    console.log(`The mimcSponge hash of contract is ${BigInt(resContract.xL)}`)
    const isValidRoot = await tornado.methods.isKnownRoot(BigInt(root)).call()
    const isSpent = await tornado.methods.isSpent(Arr2Int(deposit.nullifierHash)).call()
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
      //console.log(`Before reverse ${buffer.toJSON().data}`);
      reversedBuffer.reverse();
      //console.log(`After reverse ${reversedBuffer.toJSON().data}`)
      return reversedBuffer;
    }

    console.log(`The sdafsF ${deposit.nullifier}`)

    // // Prepare circuit input
    const input = {
      // Public snark inputs
      root: root,
      nullifierHash: Arr2Int(deposit.nullifierHash),

      // Private snark inputs
      nullifier: Arr2Int2(reverseBuffer(int2Buff(deposit.nullifier))),
      secret: Arr2Int2(reverseBuffer(int2Buff(deposit.secret))),
      pathElements: pathElements,
      pathIndices: pathIndices,
    }

    console.log('Generating SNARK proof')
    console.time('Proof time')
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, "./circuits/WithDraw_js/WithDraw.wasm", "./circuits/WithDraw_0000.zkey");
    console.timeEnd('Proof time')
    console.log("Proof: ");
    console.log(JSON.stringify(proof, null, 1));

    const vKey = JSON.parse(fs.readFileSync("./circuits/verification_key.json"));

    const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    if (res === true) {
        console.log("Verification OK");
    } else {
        console.log("Invalid proof");
    }

    // const args = [
    //   BigInt(input.root),
    //   BigInt(input.nullifierHash),
    //   BigInt(input.recipient)
    // ]

    // return { proof, args }
}

async function withdraw({ deposit, recipient }) {
    const { proof, args } = await generateProof({ deposit, recipient })

    // console.log('Submitting withdraw transaction')
    // await tornado.methods.withdraw(proof, ...args).send({ from: senderAccount })
    // .on('transactionHash', function (txHash) {
    //     console.log(`The transaction hash is ${txHash}`)
    // }).on('error', function (e) {
    //     console.error('on transactionHash error', e.message)
    // })
    // console.log('Done')
}

async function init(rpc) {
    console.log(`The RPC URL is ${rpc}`)
    web3 = new Web3(rpc)
    contractJson = require('./build/contracts/Mixer.json')
    hasherJson = require('./build/contracts/Hasher.json')
    PRIVATE_KEY = process.env.PRIVATE_KEY
    console.log(`The private key found is ${PRIVATE_KEY}`)
    if (PRIVATE_KEY) {
        const account = web3.eth.accounts.privateKeyToAccount('0x' + PRIVATE_KEY)
        web3.eth.accounts.wallet.add('0x' + PRIVATE_KEY)
        web3.eth.defaultAccount = account.address
        senderAccount = account.address
    } else {
        console.log('Warning! PRIVATE_KEY not found. Please provide PRIVATE_KEY in .env file if you deposit')
    }
    tornado = new web3.eth.Contract(contractJson.abi, MIXER_ADDRESS)
    hasher = new web3.eth.Contract(hasherJson.abi, HASHER_ADDRESS)
    mimcSponge = await buildMimcSponge()
}

async function main() {
    program
      .option('-r, --rpc <URL>', 'The RPC, CLI should interact with', 'http://localhost:8545')
    program
      .command('deposit')
      .description('Submit a 0.00000001 ETH deposit to the mixer and retrieve a note which can be used to get back the money later')
      .action(async () => {
        await init(program.opts().rpc)
        noteString = await deposit()
        console.log(`Here is your note, please keep it safe so that you can withdraw later:\n${noteString}`)
      })
    program
      .command('balance <address>')
      .description('Check ETH balance')
      .action(async (address) => {
        await init(program.opts().rpc)
        await printETHBalance({ address, name: '' })
      })
    program
      .command('withdraw <note> <recipient>')
      .description('Withdraw a note to a recipient account')
      .action(async (noteString, recipient) => {
        const deposit = await parseNote(noteString)
        await init(program.opts().rpc)
        await withdraw({ deposit, recipient })
      })
    program.parse(process.argv)
}

main()