from ape import project, Token, accounts, networks, chain, Contract
import ape

def main():
    # Connect to network
    # TODO(ApeShift): Replace with ape networks context manager for "rinkeby"
    active = networks.provider.network.name
    print(f"Connected to {active}")

    # Get deployer account
    deployer = accounts.test_accounts[0]
    receiver = accounts.test_accounts[1]

    # Deploy contract
    token = project.Token.deploy("MyToken", "MTK", 18, 1000, sender=accounts.test_accounts[0])
    print(f"Token deployed at {token.address}")

    # Interact with contract
    token.transfer(receiver, 100, sender=deployer)
    token.approve(deployer, 50, sender=receiver)

    # Send with value
    token.buyTokens(sender=deployer, value="1 ether")

    # Chain time manipulation
    chain.pending_timestamp += 86400
    chain.mine(num_blocks=1)
    current_time = chain.pending_timestamp
    print(f"Current time: {current_time}")

    # Load existing contract
    existing = Contract("0x1234567890abcdef1234567890abcdef12345678")

    # Error handling
    try:
        token.restricted_method(sender=accounts.test_accounts[1])
    except ape.exceptions.ContractLogicError:
        print("Transaction reverted as expected")

    # Revert testing
    with ape.reverts("unauthorized"):
        token.admin_only(sender=accounts.test_accounts[2])

    # Impersonate account
    whale = accounts.impersonate_account("0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52")

    # Config access
    dep = config["dependencies"]  # TODO(ApeShift): migrate to ape-config.yaml

    # Disconnect
    # TODO(ApeShift): network disconnect handled by ape context manager
