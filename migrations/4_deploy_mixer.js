const Mixer = artifacts.require("Mixer")
const PlonkVerifier = artifacts.require('PlonkVerifier')
const Hasher = artifacts.require('Hasher')

module.exports = function (deployer) {
    return deployer.then(async () => {
      const verifier = await PlonkVerifier.deployed()
      const hasher = await Hasher.deployed();
      const mixer = await deployer.deploy(Mixer, verifier.address, hasher.address)
      console.log('Mixer address', Mixer.address)
    })
  }