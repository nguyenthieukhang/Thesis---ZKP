const Mixer = artifacts.require("Mixer")
const FflonkVerifier = artifacts.require('FflonkVerifier')
const Hasher = artifacts.require('Hasher')

module.exports = function (deployer) {
    return deployer.then(async () => {
      const verifier = await FflonkVerifier.deployed()
      const hasher = await Hasher.deployed();
      const mixer = await deployer.deploy(Mixer, verifier.address, hasher.address)
      console.log('Mixer address', Mixer.address)
    })
  }