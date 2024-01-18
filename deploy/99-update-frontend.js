const { ethers, network, deployments } = require("hardhat")
const fs = require("fs")

const FRONT_END_ADRESSES_FILE = "../next-js-lottery-fcc/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../next-js-lottery-fcc/constants/abi.json"

module.exports = async function() {
    if(process.env.UPDATE_FRONTEND) {
        console.log("updating frontend")
        updateContractAdresses()
        updateAbi()
        console.log("----------------------------")
    }
}

async function updateContractAdresses() {
    const raffleAddress = (await deployments.get("Raffle")).address
    const chainId = network.config.chainId.toString()
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADRESSES_FILE, "utf-8"))
    if (chainId in currentAddresses) {
        if(!currentAddresses[chainId].includes(raffleAddress)) {
            currentAddresses[chainId].push(raffleAddress)
        }
    } {
        currentAddresses[chainId] = [raffleAddress]
    }
    fs.writeFileSync(FRONT_END_ADRESSES_FILE, JSON.stringify(currentAddresses))
}

async function updateAbi() {
    const raffleAbi = (await deployments.get("Raffle")).abi
    fs.writeFileSync(FRONT_END_ABI_FILE, JSON.stringify(raffleAbi))
}

module.exports.tags = ["all", "frontend"]