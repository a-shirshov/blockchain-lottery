const { network, deployments, getNamedAccounts, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("15")

module.exports = async function() {
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let VRFCoordinatorV2Address, subscriptionId 
    if (developmentChains.includes(network.name)) {
        const VRFCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", (await deployments.get("VRFCoordinatorV2Mock")).address, await ethers.provider.getSigner(deployer))
        VRFCoordinatorV2Mock.on(VRFCoordinatorV2Mock.filters.SubscriptionCreated, (subId, _subAddress, event) => {
            subscriptionId = subId
            event.removeListener()
        })
        VRFCoordinatorV2Address = await VRFCoordinatorV2Mock.getAddress()
        const transactionResponse = await VRFCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait()
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        VRFCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
        console.log(subscriptionId)
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]

    const args = [VRFCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval]
    const raffle = await deployments.deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", (await deployments.get("VRFCoordinatorV2Mock")).address)
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
    }

    if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        console.log("Verifying...")
        await verify(raffle.address, args)
    }
    console.log("-----------------------------------------------------")
}

module.exports.tags = ["all", "raffle"]