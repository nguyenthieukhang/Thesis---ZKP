const { Command } = require('commander');
require('dotenv').config();
const program = new Command();
const snarkjs = require('snarkjs')
const crypto = require('crypto')
const circomlib = require('circomlib')
const circomlibjs = require('circomlibjs')
const { Web3 } = require('web3')
const merkleTree = require('fixed-merkle-tree')
const buildPedersenHash = circomlibjs.buildPedersenHash
const buildBabyJub = circomlibjs.buildBabyjub

const BUFFER_SIZE = 31
const MERKLE_TREE_HEIGHT = 32
const ETH_AMOUNT = 1
const MIXER_ADDRESS = '0xCCAB9Cd7A6c90906a4a6EEb704c7c5b6dd602a01'
const FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')
let circuit, proving_key, senderAccount, contractJson, web3
let PRIVATE_KEY
let pedersen = buildPedersenHash()
let babyJub = buildBabyJub()

const buff2Int = buff => BigInt('0x' + buff.toString('hex'))

const Arr2Int = arr => BigInt('0x' + Buffer.from(arr).toString('hex')) % FIELD_SIZE

const int2Buff = bigint => Buffer.from(bigint.toString(16), 'hex');

const rBigInt = () => buff2Int(crypto.randomBytes(BUFFER_SIZE))

const pedersenHash = async data => (await babyJub).unpackPoint((await pedersen).hash(data))[0]

async function createDeposit({ nullifier, secret }) {
    const deposit = { nullifier, secret }
    deposit.preimage = Buffer.concat([int2Buff(deposit.nullifier), int2Buff(deposit.secret)])
    deposit.commitment = await pedersenHash(deposit.preimage)
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
    const note = '0x' + deposit.preimage.toString('hex').padStart(64, '0')
    const noteString = `Khang-and-Phu-${note}`
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

    // const note = '0x' + deposit.preimage.toString('hex').padStart(64, '0')
    // const noteString_ = `Khang-and-Phu-${note}`
    // console.log(`The created parsed is ${noteString_}`)
    return deposit
}

// async function generateMerkleProof(deposit) {
//     // Get all deposit events from smart contract and assemble merkle tree from them
//     console.log('Getting current state from tornado contract')
//     const events = await tornado.getPastEvents('LeafAdded', { fromBlock: 0, toBlock: 'latest' })
//     const leaves = events
//       .sort((a, b) => a.returnValues.leaf_index - b.returnValues.leaf_index) // Sort events in chronological order
//       .map(e => e.returnValues.leaf)
//     const tree = new merkleTree(MERKLE_TREE_HEIGHT, leaves)

//     // Find current commitment in the tree
//     console.log(`The value we are looking for is ${BigInt(deposit.commitment)}`)
//     console.log(`All events are ${events}`)
//     const depositEvent = events.find(e => e.returnValues.commitment === BigInt(deposit.commitment))
//     const leafIndex = depositEvent ? depositEvent.returnValues.leaf_index : -1

//     // Validate that our data is correct
//     const root = tree.root()
//     const isValidRoot = await tornado.methods.isKnownRoot(BigInt(root)).call()
//     const isSpent = await tornado.methods.isSpent(BigInt(deposit.nullifierHash)).call()
//     assert(isValidRoot === true, 'Merkle tree is corrupted')
//     assert(isSpent === false, 'The note is already spent')
//     assert(leafIndex >= 0, 'The deposit is not found in the tree')

//     // Compute merkle proof of our commitment
//     const { pathElements, pathIndices } = tree.path(leafIndex)
//     return { pathElements, pathIndices, root: BigInt(tree.root()) }
//   }

// async function generateProof({ deposit, recipient }) {
//     // Compute merkle proof of our commitment
//     const { root, pathElements, pathIndices } = await generateMerkleProof(deposit)

//     // Prepare circuit input
//     const input = {
//       // Public snark inputs
//       root: root,
//       nullifierHash: deposit.nullifierHash,
//       recipient: bigInt(recipient),

//       // Private snark inputs
//       nullifier: deposit.nullifier,
//       secret: deposit.secret,
//       pathElements: pathElements,
//       pathIndices: pathIndices,
//     }

//     console.log('Generating SNARK proof')
//     console.time('Proof time')
//     const proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, proving_key)
//     const { proof } = websnarkUtils.toSolidityInput(proofData)
//     console.timeEnd('Proof time')

//     const args = [
//       BigInt(input.root),
//       BigInt(input.nullifierHash),
//       BigInt(input.recipient)
//     ]

//     return { proof, args }
// }

async function withdraw({ deposit, recipient }) {
    // const { proof, args } = await generateProof({ deposit, recipient })

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
        const deposit = parseNote(noteString)
        await init({ rpc: program.rpc })
        await withdraw({ deposit, recipient })
      })
    program.parse(process.argv)
}

main()