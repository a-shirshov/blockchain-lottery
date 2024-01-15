const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

!developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Raffle Unit Tests", function(){
        let raffle, vrfCoordinatorV2Mock, entranceFee, deployer, interval
        const chainId = network.config.chainId
        beforeEach(async function(){
            deployer = (await getNamedAccounts()).deployer
            await deployments.fixture(["all"])
            raffle = await ethers.getContractAt("Raffle", (await deployments.get("Raffle")).address, await ethers.provider.getSigner(deployer))
            vrfCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", (await deployments.get("VRFCoordinatorV2Mock")).address, await ethers.provider.getSigner(deployer))
            entranceFee = await raffle.getEntranceFee()
            interval = await raffle.getInterval()
        })

        describe("constructor", function() {
            it("initializes the raffleState correctly", async function(){
                const raffleState = await raffle.getRaffleState()
                assert.equal(raffleState.toString(), "0")
            })
            
            it("initializes the interval correctly", async function() {
                //const interval = await raffle.getInterval()
                assert.equal(interval.toString(), networkConfig[chainId]["interval"])
            })

            it("initializes the entrance fee", async function() {
                //const entranceFee = await raffle.getEntranceFee()
                assert.equal(entranceFee.toString(), networkConfig[chainId]["entranceFee"])
            })
        })

        describe("enter Raffle", function() {
            it("reverts when you don't pay enough", async function() {
                await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(raffle, "Raffle__NotEnouthETHEntered")
            })
            it("records players when they enter", async function() {
                await raffle.enterRaffle({value: entranceFee})
                const playerFromContract = await raffle.getPlayer(0)
                assert.equal(playerFromContract, deployer)
            })
            it("emits event on enter", async function(){
                await expect(raffle.enterRaffle({value: entranceFee})).to.emit(raffle, "RaffleEnter")
            })
            it("doesn't allow entrance when raffle is calculating", async () => {
                await raffle.enterRaffle({value: entranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                await raffle.performUpkeep("0x")
                await expect(raffle.enterRaffle({value: entranceFee})).to.be.revertedWithCustomError(raffle, "Raffle_NotOpen")
            })
        })

        describe("checkUpkeep", function(){
            it("return false if people haven't sent any ETH", async function(){
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const {upkeepNeeded} = await raffle.checkUpkeep.staticCall("0x")
                assert.equal(upkeepNeeded, false)
            })

            it("returns false if raffle is not open", async function(){
                await raffle.enterRaffle({value: entranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                await raffle.performUpkeep("0x")
                const raffleState = await raffle.getRaffleState()
                const {upkeepNeeded} = await raffle.checkUpkeep.staticCall("0x")
                assert.equal(raffleState.toString(), "1")
                assert.equal(upkeepNeeded, false)
            })

            it("return false if not enough time passed", async function(){
                await raffle.enterRaffle({value: entranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) - 2])
                await network.provider.request({ method: "evm_mine", params: [] })
                const {upkeepNeeded} = await raffle.checkUpkeep.staticCall("0x")
                assert.equal(upkeepNeeded, false)
            })

            it("return true if all good", async function(){
                await raffle.enterRaffle({value: entranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const {upkeepNeeded} = await raffle.checkUpkeep.staticCall("0x")
                assert.equal(upkeepNeeded, true)
            })
        })

        describe("performUpkeep", function(){
            it("it can only run if checkUpkeep is true", async function(){
                await raffle.enterRaffle({value: entranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                await expect(raffle.performUpkeep("0x")).not.to.be.reverted
            })

            it("it reverts if checkUpkeep is false", async function(){
                await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(raffle, "Raffle_UpkeepNoNeeded")
            })

            it("updates the raffle state, emits an event", async function() {
                await raffle.enterRaffle({value: entranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const txResponse = await raffle.performUpkeep("0x")
                const txReceipt = await txResponse.wait(1)
                const requestId = (await raffle.queryFilter("RequestedRaffleWinner"))[0].args[0]
                const raffleState = await raffle.getRaffleState()
                assert.isTrue(Number(requestId) > 0)
                assert.isTrue(raffleState == 1)
            })
        })

        describe("fulfillRandomWords", function(){
            beforeEach(async function(){
                await raffle.enterRaffle({value: entranceFee})
                await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
            })
            it("can only be called after performUpkeep", async function() {
                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(0, (await deployments.get("Raffle")).address)
                ).to.be.revertedWith("nonexistent request")

                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(1, (await deployments.get("Raffle")).address)
                ).to.be.revertedWith("nonexistent request")
            })

            it("resets the lottery and sends the money", async function() {
                const additionalEntrants = 3
                const startingAccountIndex = 1
                const accounts = await ethers.getSigners();
                for(let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
                    const accountsConnectedRaffle = raffle.connect(accounts[i])
                    await accountsConnectedRaffle.enterRaffle({value: entranceFee})
                }
                const startingTimeStamp = await raffle.getLatestTimeStamp()
                await new Promise(async (resolve, reject) => {
                    raffle.on("WinnerPicked", async () => {
                        console.log("Found the event")
                        try{
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const endingTimeStamp = await raffle.getLatestTimeStamp()
                            const numPlayers = await raffle.getNumberOfPlayers()
                            const winnerEndingBalance = await ethers.provider.getBalance(accounts[1])
                            assert.equal(numPlayers.toString(), "0")
                            assert.equal(raffleState.toString(), "0")
                            assert.isTrue(endingTimeStamp > startingTimeStamp)
                            assert.equal(winnerEndingBalance.toString(), (winnerStartingBalance + BigInt(entranceFee) + BigInt(additionalEntrants)*BigInt(entranceFee)).toString())
                            resolve()
                        } catch (e) {
                            reject(e)
                        }
                    })

                    const tx = await raffle.performUpkeep("0x")
                    const txReceipt = await tx.wait(1)
                    const winnerStartingBalance = await ethers.provider.getBalance(accounts[1])
                    const requestId = (await raffle.queryFilter("RequestedRaffleWinner"))[0].args[0]
                    await vrfCoordinatorV2Mock.fulfillRandomWords(
                        requestId,
                        (await deployments.get("Raffle")).address
                    )
                    
                })
            })
        })

    })