export const ETHER_ADDRESS = '0x0000000000000000000000000000000000000000'

export const EVM_REVERT = 'VM Exception while processing transaction: revert'

export const ether = (n) => {
  return new web3.utils.BN(
    web3.utils.toWei(n.toString(), 'ether')
  )
}

export const tokens = (n) => ether(n)

export const depositEtherEvent = async () => {
  const log = result.logs[0]
  log.event.should.equal('Deposit')
  const events = log.args
  events.token.should.equal(ETHER_ADDRESS, 'Ether is incorrect')
  events.user.should.equal(user1, 'user address is incorrect')
  events.amount.toString().should.equal(amount.toString(), 'amount is incorrect')
  events.balance.toString().should.equal(amount.toString(), 'balance is incorrect')
}

export const depositTokenEvent = async () => {
  const log = result.logs[0]
  log.event.should.equal('Deposit')
  const events = log.args
  events.token.should.equal(token.address, 'token is incorrect')
  events.user.should.equal(user1, 'user address is incorrect')
  events.amount.toString().should.equal(amount.toString(), 'amount is incorrect')
  events.balance.toString().should.equal(amount.toString(), 'balance is incorrect')
}
