const program = require('commander')
const snarkjs = require('snarkjs')
const crypto = require('crypto')
const circomlib = require('circomlib')
const Web3 = require('web3')
const merkleTree = require('fixed-merkle-tree')

const BUFFER_SIZE = 32
const MERKLE_TREE_HEIGHT = 16
const ETH_AMOUNT = 1e-8
const MIXER_ADDRESS = '[Enter the address after deployment here]'
let circuit, proving_key, senderAccount, contractJson
let PRIVATE_KEY

const buff2Int = buff => BigInt('0x' + buff.toString('hex'))

const int2Buff = bigint => Buffer.from(bigint.toString(16).padStart(64, '0'), 'hex');

const rBigInt = () => buff2Int(crypto.randomBytes(BUFFER_SIZE))

const pedersenHash = data => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]

function createDeposit({ nullifier, secret }) {
    const deposit = { nullifier, secret }
    deposit.preimage = Buffer.concat([int2Buff(deposit.nullifier), int2Buff(deposit.secret)])
    deposit.commitment = pedersenHash(deposit.preimage)
    deposit.nullifierHash = pedersenHash(int2Buff(deposit.nullifier))
    return deposit
}

async function printETHBalance({ address, name }) {
    console.log(`${name} ETH balance is`, web3.utils.fromWei(await web3.eth.getBalance(address)))
}

async function deposit() {
    const deposit = createDeposit({ nullifier: rBigInt(), secret: rBigInt() })
    const note = deposit.preimage.toString('hex')
    const noteString = `Khang-and-Phu-${note}`
    console.log(`Your note: ${noteString}`)
    await printETHBalance({ address: tornado._address, name: 'Khang and Phu' })
    await printETHBalance({ address: senderAccount, name: 'Sender account' })
    console.log('Submitting deposit transaction')
    await tornado.methods.deposit(deposit.commitment.toString('hex')).send({ value: ETH_AMOUNT, from: senderAccount })
    await printETHBalance({ address: tornado._address, name: 'Khang and Phu' })
    await printETHBalance({ address: senderAccount, name: 'Sender account' })
    return noteString
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

// async function withdraw({ deposit, recipient }) {
//     const { proof, args } = await generateProof({ deposit, recipient })

//     console.log('Submitting withdraw transaction')
//     await tornado.methods.withdraw(proof, ...args).send({ from: senderAccount })
//     .on('transactionHash', function (txHash) {
//         console.log(`The transaction hash is ${txHash}`)
//     }).on('error', function (e) {
//         console.error('on transactionHash error', e.message)
//     })
//     console.log('Done')
// }

async function init(rpc) {
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
        await init(program.rpc)
        noteString = await deposit()
        console.log(`Here is your note, please keep it safe so that you can withdraw later:\n${noteString}`)
      })
    program
      .command('balance <address>')
      .description('Check ETH balance')
      .action(async (address) => {
        await init({ rpc: program.rpc })
        await printETHBalance({ address, name: '' })
      })
    // program
    //   .command('withdraw <note> <recipient>')
    //   .description('Withdraw a note to a recipient account')
    //   .action(async (noteString, recipient) => {
    //     const { deposit } = parseNote(noteString)
    //     await init({ rpc: program.rpc })
    //     await withdraw({ deposit, recipient })
    //   })
}

main()