const PlonkVerifier = artifacts.require("PlonkVerifier");

module.exports = function (deployer) {
    deployer.then(async () => {
        await deployer.deploy(PlonkVerifier);
    });
};
