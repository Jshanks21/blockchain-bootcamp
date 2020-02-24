import { tokens, ether, depositEtherEvent, depositTokenEvent, EVM_REVERT, ETHER_ADDRESS } from './helpers'

const Token = artifacts.require('./Token')
const Exchange = artifacts.require('./Exchange')

require('chai')
  .use(require('chai-as-promised'))
  .should()

contract('Exchange', ([deployer, feeAccount, user1, user2]) => {
  let token
  let exchange
  const feePercent = 10

  beforeEach(async () => {
    // Deploy token
    token = await Token.new()

    // Transfer tokens to user1
    token.transfer(user1, tokens(100), { from: deployer })

    // Deploy exchange
    exchange = await Exchange.new(feeAccount, feePercent)
  })

  describe('deployment', () => {

    it('tracks the fee account', async () => {
      const result = await exchange.feeAccount()
      result.should.equal(feeAccount)
    })

    it('tracks the fee percent', async () => {
      const result = await exchange.feePercent()
      result.toString().should.equal(feePercent.toString())
    })
  })

  describe('fallback', () => {

    it('reverts when Ether is sent', async () => {
      await exchange.sendTransaction({ value: 1, from: user1 }).should.be.rejectedWith(EVM_REVERT)
    })
  })

  describe('depositing Ether', () => {
    let result
    let amount

    beforeEach(async () => {
      amount = ether(1)
      result = await exchange.depositEther({ from: user1, value: amount })
    })

    it('tracks the Ether deposit', async () => {
      const balance = await exchange.tokens(ETHER_ADDRESS, user1)
      balance.toString().should.equal(amount.toString())
    })

    // Refactor this in helpers.js
    it('emits a Deposit event', () => {
      depositEtherEvent()
    })

  })

  describe('withdrawing Ether', () => {
    let result
    let amount

    beforeEach(async () => {
      amount = ether(1)
      await exchange.depositEther({ from: user1, value: amount })
    })

    describe('success', async () => {

      beforeEach(async () => {
        result = await exchange.withdrawEther(amount, { from: user1 })
      })

      it('withdraws Ether funds', async () => {
        const balance = await exchange.tokens(ETHER_ADDRESS, user1)
        balance.toString().should.equal('0')
      })

      it('emits a "Withdraw" event', async () => {
        const log = result.logs[0]
        log.event.should.equal('Withdraw')
        const events = log.args
        events.token.should.equal(ETHER_ADDRESS, 'Ether is incorrect')
        events.user.should.equal(user1, 'user address is incorrect')
        events.amount.toString().should.equal(amount.toString(), 'amount is incorrect')
        events.balance.toString().should.equal('0', 'balance is incorrect')
      })
    })

    describe('failure', async () => {

      it('fails to withdraw insufficient balances', async () => {
        await exchange.withdrawEther(ether(2), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
      })
    })
  })

  describe('depositing tokens', () => {
    let result
    let amount

    describe('success', () => {

      beforeEach(async () => {
        amount = tokens(10)
        await token.approve(exchange.address, amount, { from: user1 })
        result = await exchange.depositToken(token.address, amount, { from: user1 })
      })

      it('tracks the token deposit', async () => {
        // Check exchange token balance
        let balance
        balance = await token.balanceOf(exchange.address)
        balance.toString().should.equal(amount.toString())
        // Check tokens on exchange
        balance = await exchange.tokens(token.address, user1)
        balance.toString().should.equal(amount.toString())
      })

      it('emits a Deposit event', () => {
        depositTokenEvent()
      })
    })

    describe('failure', () => {

      it('rejects Ether deposits', async () => {
        await exchange.depositToken(ETHER_ADDRESS, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
      })

      it('fails when no tokens are approved', async () => {
        // Don't approve tokens before depositing
        await exchange.depositToken(token.address, amount, { from: user1 }).should.be.rejectedWith(EVM_REVERT)
      })
    })
  })

  describe('withdrawing tokens', () => {
    let result
    let amount

    describe('success', async () => {

      beforeEach(async () => {
        // Deposit tokens first
        amount = tokens(10)
        await token.approve(exchange.address, amount, { from: user1 })
        await exchange.depositToken(token.address, amount, { from: user1 })

        // Withdraw tokens
        result = await exchange.withdrawToken(token.address, amount, { from: user1 })
      })

      it('withdraws token funds', async () => {
        const balance = await exchange.tokens(token.address, user1)
        balance.toString().should.equal('0')
      })

      it('emits a "Withdraw" event', async () => {
        const log = result.logs[0]
        log.event.should.equal('Withdraw')
        const events = log.args
        events.token.should.equal(token.address, 'token address is incorrect')
        events.user.should.equal(user1, 'user address is incorrect')
        events.amount.toString().should.equal(amount.toString(), 'amount is incorrect')
        events.balance.toString().should.equal('0', 'balance is incorrect')
      })
    })

    describe('failure', async () => {

      beforeEach(async () => {
        // Deposit tokens first
        amount = tokens(10)
        await token.approve(exchange.address, amount, { from: user1 })
        await exchange.depositToken(token.address, tokens(5), { from: user1 })
      })

      it('fails to withdraw insufficient balances', async () => {
        await exchange.withdrawToken(token.address, amount, { from: user1 }).should.be.rejectedWith(EVM_REVERT)
      })

      it('rejects Ether withdrawals', async () => {
        await exchange.withdrawToken(ETHER_ADDRESS, amount, { from: user1 }).should.be.rejectedWith(EVM_REVERT)
      })
    })
  })

  describe('checking balances', () => {
    let result

    beforeEach(async () => {
      exchange.depositEther({ from: user1, value: ether(1) })
      await token.approve(exchange.address, tokens(10), { from: user1 })
      await exchange.depositToken(token.address, tokens(10), { from: user1 })
    })

    it('returns user balance', async () => {
      result = await exchange.balanceOf(ETHER_ADDRESS, user1)
      result.toString().should.equal(ether(1).toString())
    })

    it('returns user balance', async () => {
      result = await exchange.balanceOf(token.address, user1)
      result.toString().should.equal(tokens(10).toString())
    })
  })

  describe('making orders', () => {
    let result

    beforeEach(async () => {
      result = await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), { from: user1 })
    })

    it('tracks newly created orders', async () => {
      const orderCount = await exchange.orderCount()
      orderCount.toString().should.equal('1')
      const order = await exchange.orders('1')
      order.id.toString().should.equal('1', 'id is incorrect')
      order.user.should.equal(user1, 'user is incorrect')
      order.tokenGet.should.equal(token.address, 'tokenGet is incorrect')
      order.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is incorrect')
      order.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is incorrect')
      order.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is incorrect')
      order.timestamp.length.should.be.at.least(1, 'timestamp is not present')
    })

    it('emits an "Order" event', async () => {
      const log = result.logs[0]
      log.event.should.equal('Order')
      const events = log.args
      events.id.toString().should.equal('1', 'id is incorrect')
      events.user.should.equal(user1, 'user is incorrect')
      events.tokenGet.should.equal(token.address, 'tokenGet is incorrect')
      events.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is incorrect')
      events.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is incorrect')
      events.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is incorrect')
      events.timestamp.length.should.be.at.least(1, 'timestamp is not present')
    })

  })

  describe('order actions', () => {

    beforeEach(async () => {
      // user1 deposits Ether only
      await exchange.depositEther({ from: user1, value: ether(1) })
      // give tokens to user2
      await token.transfer(user2, tokens(100), { from: deployer })
      // user2 deposits tokens only
      await token.approve(exchange.address, tokens(2), { from: user2 })
      await exchange.depositToken(token.address, tokens(2),  { from: user2 })
      // user1 makes an order to buy tokens with Ether
      await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), { from: user1 })
    })

    describe('filling orders', async () => {
      let result

      describe('success', async () => {

        beforeEach(async () => {
          // user2 fills order
          result = await exchange.fillOrder('1', { from: user2 })
        })

        it('executes the trade and charges fees', async () => {
          let balance
          balance = await exchange.balanceOf(token.address, user1)
          balance.toString().should.equal(tokens(1).toString(), 'user1 did not receive tokens')
          balance = await exchange.balanceOf(ETHER_ADDRESS, user2)
          balance.toString().should.equal(ether(1).toString(), 'user2 did not receive Ether')
          balance = await exchange.balanceOf(ETHER_ADDRESS, user1)
          balance.toString().should.equal('0', 'user1 Ether was not deducted')
          balance = await exchange.balanceOf(token.address, user2)
          balance.toString().should.equal(tokens(0.9).toString(), 'user2 tokens were not correctly deducted with fee applied')
          const feeAccount = await exchange.feeAccount()
          balance = await exchange.balanceOf(token.address, feeAccount)
          balance.toString().should.equal(tokens(0.1).toString(), 'feeAccount did not receive fee')
        })

        it('updates filled orders', async () => {
          const orderFilled = await exchange.orderFilled(1)
          orderFilled.should.equal(true)
        })

        it('emits a "Trade" event', async () => {
          const log = result.logs[0]
          log.event.should.equal('Trade')
          const events = log.args
          events.id.toString().should.equal('1', 'id is incorrect')
          events.user.should.equal(user1, 'user address is incorrect')
          events.tokenGet.should.equal(token.address, 'tokenGet is incorrect')
          events.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is incorrect')
          events.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is incorrect')
          events.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is incorrect')
          events.userFill.should.equal(user2, 'userFill address is incorrect')
          events.timestamp.length.should.be.at.least(1, 'timestamp is not present')
        })
      })

      describe('failure', async () => {

        it('rejects invalid order ids', async () => {
          await exchange.fillOrder(9999, { from: user2 }).should.be.rejectedWith(EVM_REVERT)
        })

        it('rejects orders that have already been filled', async () => {
          // Fill the order
          await exchange.fillOrder('1', { from: user2 }).should.be.fulfilled
          // Try to fill it again
          await exchange.fillOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
        })

        it('rejects cancelled orders', async () => {
          // Cancel the order
          await exchange.cancelOrder('1', { from: user1 }).should.be.fulfilled
          // Try to fill the order
          await exchange.fillOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
        })
      })
    })

    describe('cancelling orders', async () => {
      let result

      describe('success', async () => {

        beforeEach(async () => {
          result = await exchange.cancelOrder('1', { from: user1 })
        })

        it('updates cancelled orders', async () => {
          const orderCancelled = await exchange.orderCancelled(1)
          orderCancelled.should.equal(true)
        })

        it('emits a "Cancel" event', async () => {
          const log = result.logs[0]
          log.event.should.equal('Cancel')
          const events = log.args
          events.id.toString().should.equal('1', 'id is incorrect')
          events.user.should.equal(user1, 'user is incorrect')
          events.tokenGet.should.equal(token.address, 'tokenGet is incorrect')
          events.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is incorrect')
          events.tokenGive.should.equal(ETHER_ADDRESS, 'tokenGive is incorrect')
          events.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is incorrect')
          events.timestamp.length.should.be.at.least(1, 'timestamp is not present')
        })
      })

      describe('failure', async () => {

        it('rejects invalid order ids', async () => {
          await exchange.cancelOrder(9999, { from: user1 }).should.be.rejectedWith(EVM_REVERT)
        })

        it('rejects unauthorized cancellations', async () => {
          await exchange.cancelOrder(1, { from: user2 }).should.be.rejectedWith(EVM_REVERT)
        })
      })
    })
  })
})
