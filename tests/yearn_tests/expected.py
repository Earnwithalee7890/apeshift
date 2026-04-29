import ape
from ape import project, Contract
import pytest


def test_operation(
    chain, accounts, token, vault, strategy, user, strategist, amount, RELATIVE_APPROX
):
    # Deposit to the vault
    user_balance_before = token.balanceOf(user)
    token.approve(vault.address, amount, sender=user)
    vault.deposit(amount, sender=user)
    assert token.balanceOf(vault.address) == amount

    # harvest
    chain.pending_timestamp += 1
    strategy.harvest()
    assert pytest.approx(strategy.estimatedTotalAssets(), rel=RELATIVE_APPROX) == amount

    # withdrawal
    vault.withdraw(sender=user)
    assert (
        pytest.approx(token.balanceOf(user), rel=RELATIVE_APPROX) == user_balance_before
    )


def test_profitable_harvest(
    chain, accounts, token, vault, strategy, user, strategist, amount, RELATIVE_APPROX
):
    # Deposit to the vault
    token.approve(vault.address, amount, sender=user)
    vault.deposit(amount, sender=user)
    assert token.balanceOf(vault.address) == amount

    # Harvest 1: Send funds through the strategy
    chain.pending_timestamp += 1
    strategy.harvest()

    # Harvest 2: Realize profit
    chain.pending_timestamp += 1
    strategy.harvest()
    chain.pending_timestamp += 3600 * 6  # 6 hrs needed for profits to unlock
    chain.mine(num_blocks=1)
    profit = token.balanceOf(vault.address)


def test_change_debt(
    chain, gov, token, vault, strategy, user, strategist, amount, RELATIVE_APPROX
):
    # Deposit to the vault and harvest
    token.approve(vault.address, amount, sender=user)
    vault.deposit(amount, sender=user)
    vault.updateStrategyDebtRatio(strategy.address, 5_000, sender=gov)
    chain.pending_timestamp += 1
    strategy.harvest()

    vault.updateStrategyDebtRatio(strategy.address, 10_000, sender=gov)
    chain.pending_timestamp += 1
    strategy.harvest()


def test_sweep(gov, vault, strategy, token, user, amount, weth, weth_amount):
    # Strategy want token doesn't work
    token.transfer(strategy, amount, sender=user)
    assert token.address == strategy.want()
    assert token.balanceOf(strategy) > 0
    with ape.reverts("!want"):
        strategy.sweep(token, sender=gov)

    # Vault share token doesn't work
    with ape.reverts("!shares"):
        strategy.sweep(vault.address, sender=gov)

    before_balance = weth.balanceOf(gov)
    weth.transfer(strategy, weth_amount, sender=user)
    assert weth.address != strategy.want()
    assert weth.balanceOf(user) == 0
    strategy.sweep(weth, sender=gov)
    assert weth.balanceOf(gov) == weth_amount + before_balance
