import { expect } from "chai";
import { ethers } from "hardhat";
import { time, mine } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
    NikGover, 
    GoverToken, 
    Timelock, 
    Star} from "../typechain-types";
import { deployFixture } from "./Deploy-test";
import { BigNumberish, EventLog } from "ethers";

describe("Full DAO flow", function() {
    let admin:SignerWithAddress;
    let user1:SignerWithAddress;
    let user2:SignerWithAddress;
    let gover:NikGover;
    let token:GoverToken;
    let timelock:Timelock;
    let star:Star;
    let targets:string[];
    let values:bigint[];
    let calldatas:string[];
    let description:string;
    let descriptionHash:string;

    async function transferDelegate(user:SignerWithAddress, userTo: SignerWithAddress, amount: BigNumberish) {
        const tx = await token.transfer(user, amount);
        await tx.wait();
        const del = await token.connect(user).delegate(userTo.address);
        await del.wait()
    }
    async function setProposal(
            user:SignerWithAddress,
            targets:string[],
            values:bigint[],
            calldatas:string[],
            description:string
        ):Promise<bigint> {
        const txPropose1 = await gover.connect(user).propose(
            targets,
            values,
            calldatas,
            description
        );
        const proposalReceipt = await txPropose1.wait();

        return (proposalReceipt?.logs[0] as EventLog).args[0] as bigint
    }
    
    beforeEach( async function() {
        const fixture = await deployFixture();
        admin = fixture.admin;
        user1 = fixture.user1;
        user2 = fixture.user2;
        token = fixture.token;
        star = fixture.star;
        gover = fixture.gover;
        timelock = fixture.timelock;
        
        const storeFunCall = star.interface.encodeFunctionData("store", [22n]);
        const sendMoneyFunCall = star.interface.encodeFunctionData("sendMoney", [user2.address, ethers.parseEther("1")]);

        targets = [await star.getAddress(), await star.getAddress()];
        values = [0n, 0n];
        calldatas = [storeFunCall, sendMoneyFunCall];
        description = "Let's store 22 and send money";
        descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));
    })
    it("Full cycle: propose -> vote -> queue -> execute(Reentrancy protection check)", async function() {
        await transferDelegate(user1, user1, ethers.parseEther("10000"));
        await transferDelegate(user2, user2, ethers.parseEther("20000"));

        expect(await token.getVotes(user1)).to.eq(ethers.parseEther("10000"));
        expect(await token.getVotes(user2)).to.eq(ethers.parseEther("20000"));

        expect(await token.numCheckpoints(user1)).to.eq(1n);
        expect(await token.numCheckpoints(user2)).to.eq(1n);

        const proposalId = await setProposal(
            user1,
            targets,
            values,
            calldatas,
            description
        );
        const expectedProposalId = await gover.hashProposal(
            targets,
            values,
            calldatas,
            descriptionHash
        )
        expect(expectedProposalId).to.eq(proposalId);
        await expect(
            gover.connect(user1).castVoteWithReason(proposalId, 1, "Like It"))
                .to.be.revertedWithCustomError(gover, "GovernorUnexpectedProposalState")
                    .withArgs(proposalId, 0, "0x0000000000000000000000000000000000000000000000000000000000000002");

        await mine(await gover.votingDelay() + 1n);
        
        expect(await gover.state(proposalId)).to.eq(1n);

        const vote1 = await gover.connect(user1).castVoteWithReason(proposalId, 1, "Like It");
        await vote1.wait();
        const vote2 = await gover.connect(user2).castVoteWithReason(proposalId, 2, "Don't Like");
        await vote2.wait();

        await mine(await gover.votingPeriod() + 1n);

        expect(await gover.state(proposalId)).to.eq(4n);

        const queueTx = await gover.queue(
            targets,
            values,
            calldatas,
            descriptionHash
        );
        await queueTx.wait();

        await time.increase(await timelock.getMinDelay() + 1n);

        const executeTx = await gover.execute(targets, values, calldatas, descriptionHash);
        await executeTx.wait();

        expect(await star.read()).to.eq(22);
        await expect(executeTx).to.changeEtherBalances(
            [star, user2],
            [-ethers.parseEther("1"), ethers.parseEther("1")]
        );
        await expect(executeTx).to.emit(star, "Stored").withArgs(22);
        await expect(executeTx).to.emit(star, "MoneySent").withArgs(user2.address, ethers.parseEther("1"));

        await expect(gover.connect(user1).execute(targets, values, calldatas, descriptionHash))
            .to.be.revertedWithCustomError(gover, "GovernorUnexpectedProposalState")
                .withArgs(proposalId, 7, "0x0000000000000000000000000000000000000000000000000000000000000030");
    })
    it("Prevent flash-loan vote manipulation", async function () {
        await transferDelegate(user1, user1, ethers.parseEther("10000"));

        const votingPowerBefore = await token.getVotes(user1);
        
        const proposalId = await setProposal(
            user1,
            targets,
            values,
            calldatas,
            description
        )
        
        await mine(await gover.votingDelay() + 1n);

        await token.transfer(user1.address, ethers.parseEther("70000"))

        const votingPowerAfter = await token.getVotes(user1);
        
        expect(votingPowerAfter).to.eq(ethers.parseEther("80000"));
        
        const blockNumber = await ethers.provider.getBlockNumber();
        const pastVotes = await token.getPastVotes(user1.address, blockNumber - 1);
        expect(pastVotes).to.eq(votingPowerBefore);
    })
    it("Delegation transfer during voting does not allow double-voting", async function() {
        await transferDelegate(user1, user1, ethers.parseEther("10000"));
        await transferDelegate(user2, user2, ethers.parseEther("10000"));

        const votingPowerUser2Before = await token.getVotes(user2);
        
        const proposalId = await setProposal(
            user1,
            targets,
            values,
            calldatas,
            description
        )

        await mine(await gover.votingDelay() + 1n);
        
        const del = await token.connect(user1).delegate(user2.address);
        await del.wait();
        
        const blockNumber = await ethers.provider.getBlockNumber();
        const pastVotes = await token.getPastVotes(user2.address, blockNumber - 1);
        expect(pastVotes).to.eq(votingPowerUser2Before);
    })  
    it("Proposal defeated if quorum not reached", async function () {
        await transferDelegate(user1, user1, ethers.parseEther("500"));
        
        const proposalId = await setProposal(
            user1,
            targets,
            values,
            calldatas,
            description
        )

        await mine(await gover.votingDelay() + 1n);

        const vote1 = await gover.connect(user1).castVoteWithReason(proposalId, 1, "Like It");
        await vote1.wait();
       
        await mine(await gover.votingPeriod() + 1n);

        expect(await gover.state(proposalId)).to.eq(3n); //Defeated
    })
    it("Proposal defeated if majority against", async function() {
        await transferDelegate(user1, user1, ethers.parseEther("500"));
        await transferDelegate(user2, user2, ethers.parseEther("50000"));

        const proposalId = await setProposal(
            user1,
            targets,
            values,
            calldatas,
            description
        )
        await mine(await gover.votingDelay() + 1n);

        const vote1 = await gover.connect(user1).castVote(proposalId, 2);
        await vote1.wait();
        const vote2 = await gover.connect(user2).castVote(proposalId, 2);
        await vote1.wait();

        await mine(await gover.votingPeriod() + 1n);

        expect(await gover.state(proposalId)).to.eq(3n); //Defeated
    })
    it("Only governor can queue proposal", async function() {
        await transferDelegate(user1, user1, ethers.parseEther("10000"));
        await transferDelegate(user2, user2, ethers.parseEther("50000"));

        const proposalId = await setProposal(
            user1,
            targets,
            values,
            calldatas,
            description
        )
        await mine(await gover.votingDelay() + 1n);

        const vote1 = await gover.connect(user1).castVote(proposalId, 1);
        await vote1.wait();
        await mine(await gover.votingPeriod() + 1n);
        expect(await gover.state(proposalId)).to.equal(4); // Succeeded
        
        expect(await timelock.hasRole(await timelock.PROPOSER_ROLE(), gover.target)).to.be.true;
        expect(await timelock.hasRole(await timelock.PROPOSER_ROLE(), admin.address)).to.be.false;
        
        const queueTx = await gover.connect(user1).queue(
            targets,
            values,
            calldatas,
            descriptionHash);
        await queueTx.wait();

        expect(await gover.state(proposalId)).to.equal(5); // Queued
    }) 
    it("Direct call to timelock.schedule reverts for non-proposer", async function () {
        const { timelock, user1 } = await deployFixture();

        const predecessor = ethers.ZeroHash;
        const salt = ethers.keccak256(ethers.toUtf8Bytes("test-salt"));
        const delay = 0n;

        await expect(
            timelock.connect(user1).schedule(
            ethers.ZeroAddress,
            0n,
            "0x",
            predecessor,
            salt,
            delay
            )
        ).to.be.revertedWithCustomError(timelock, "AccessControlUnauthorizedAccount")
    })
            
})