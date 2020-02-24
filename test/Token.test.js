import { tokens, EVM_REVERT } from './helpers'

const Token = artifacts.require('./Token')

require('chai')
  .use(require('chai-as-promised'))
  .should()

contract('Token', ([deployer, receiver, exchange]) => {
  const name = 'Munny Token'
  const symbol = 'MUNNY'
  const decimals = '18'
  const totalSupply = tokens(1000000).toString()
  let token

  beforeEach(async () => {
    token = await Token.new()             // Fetch token from blockchain
  })

  describe('deployment', () => {
    it('tracks the name', async () => {
      const result = await token.name()   // Read token name here...
      result.should.equal(name)     // Check the token name is 'My Token'
    })

    it('tracks the symbol', async () => {
      const result = await token.symbol()
      result.should.equal(symbol)
    })

    it('tracks the decimals', async () => {
      const result = await token.decimals()
      result.toString().should.equal(decimals)
    })

    it('tracks the total supply', async () => {
      const result = await token.totalSupply()
      result.toString().should.equal(totalSupply.toString())
    })
    it('assigns the total supply to the deployer', async () => {
      const result = await token.balanceOf(deployer)
      result.toString().should.equal(totalSupply.toString())
    })


  })

  describe('token transfer', () => {
    let amount
    let result

    describe('success', async () => {

      beforeEach(async () => {
        amount = tokens(100)
        result = await token.transfer(receiver, amount, { from: deployer })
      })

      it('transfers token balances', async () => {
        let balanceOf
        balanceOf = await token.balanceOf(deployer)
        balanceOf.toString().should.equal(tokens(999900).toString())
        balanceOf = await token.balanceOf(receiver)
        balanceOf.toString().should.equal(tokens(100).toString())
      })

      it('emits a Transfer event', async () => {
        const log = result.logs[0]
        log.event.should.equal('Transfer')
        const events = log.args
        events.from.toString().should.equal(deployer, 'from is correct')
        events.to.should.equal(receiver, 'to is correct')
        events.value.toString().should.equal(amount.toString(), 'value is correct')
      })
    })

    describe('failure', async () => {

      it('rejects insufficient balance', async () => {
        let invalidAmount
        invalidAmount = tokens(100000000) // 100 million is greater than total supply
        await token.transfer(receiver, invalidAmount, { from: deployer }).should.be.rejectedWith(EVM_REVERT);

        //Attempt to transfer with no balance
        invalidAmount = tokens(10)
        await token.transfer(deployer, invalidAmount, { from: receiver }).should.be.rejectedWith(EVM_REVERT);
      })

      it('rejects invalid recipients', async () => {
        await token.transfer(0x0, amount, { from: deployer }).should.be.rejected
      })
    })


  })

  describe('approving tokens', () => {
    let result
    let amount

    beforeEach(async () => {
      amount = tokens(100)
      result = await token.approve(exchange, amount, { from: deployer })
    })

    describe('success', () => {

      it('allocates an allowance for delegated token spending on exchange', async () => {
        const allowance = await token.allowance(deployer, exchange)
        allowance.toString().should.equal(amount.toString())
      })

      it('emits an Approval event', async () => {
        const log = result.logs[0]
        log.event.should.equal('Approval')
        const events = log.args
        events.owner.toString().should.equal(deployer, 'owner is correct')
        events.spender.should.equal(exchange, 'spender is correct')
        events.value.toString().should.equal(amount.toString(), 'value is correct')
      })
    })

    describe('failure', () => {

      it('rejects invalid spenders', async () => {
        await token.approve(0x0, amount, { from: deployer }).should.be.rejected
      })
    })

  })

  describe('delegated token transfers', () => {
    let amount
    let result

    beforeEach(async () => {
      amount = tokens(100)
      await token.approve(exchange, amount, { from: deployer })
    })

    describe('success', async () => {

      beforeEach(async () => {
        result = await token.transferFrom(deployer, receiver, amount, { from: exchange })
      })

      it('transfers token balances', async () => {
        let balanceOf
        balanceOf = await token.balanceOf(deployer)
        balanceOf.toString().should.equal(tokens(999900).toString())
        balanceOf = await token.balanceOf(receiver)
        balanceOf.toString().should.equal(tokens(100).toString())
      })

      it('resets the allowance', async () => {
        const allowance = await token.allowance(deployer, exchange)
        allowance.toString().should.equal('0')
      })

      it('emits a Transfer event', async () => {
        const log = result.logs[0]
        log.event.should.equal('Transfer')
        const events = log.args
        events.from.toString().should.equal(deployer, 'from is correct')
        events.to.should.equal(receiver, 'to is correct')
        events.value.toString().should.equal(amount.toString(), 'value is correct')
      })
    })

    describe('failure', async () => {

      it('rejects insufficient balance', async () => {
        let invalidAmount
        invalidAmount = tokens(100000000) // 100 million is greater than total supply
        await token.transferFrom(deployer, receiver, invalidAmount, { from: exchange }).should.be.rejectedWith(EVM_REVERT);

        //Attempt to transfer with no balance
        invalidAmount = tokens(10)
        await token.transferFrom(receiver, deployer, invalidAmount, { from: exchange }).should.be.rejectedWith(EVM_REVERT);
      })

      it('rejects invalid recipients', async () => {
        await token.transferFrom(deployer, 0x0, amount, { from: exchange }).should.be.rejected
      })
    })
  })
})
