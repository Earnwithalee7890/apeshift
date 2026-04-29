from brownie import Token, accounts, network, Wei, chain, Contract, config, web3
import brownie

def main():
    # Connect to network
    network.connect("rinkeby")
    active = network.show_active()
    print(f"Connected to {active}")

    # Get deployer account
    deployer = accounts[0]
    receiver = accounts[1]

    # Deploy contract
    token = Token.deploy("MyToken", "MTK", 18, 1000, {"from": accounts[0]})
    print(f"Token deployed at {token.address}")

    # Interact with contract
    token.transfer(receiver, 100, {"from": deployer})
    token.approve(deployer, 50, {"from": receiver})

    # Send with value
    token.buyTokens({"from": deployer, "value": Wei("1 ether")})

    # Chain time manipulation
    chain.sleep(86400)
    chain.mine(1)
    current_time = chain.time()
    print(f"Current time: {current_time}")

    # Load existing contract
    existing = Contract.at("0x1234567890abcdef1234567890abcdef12345678")

    # Error handling
    try:
        token.restricted_method({"from": accounts[1]})
    except brownie.exceptions.VirtualMachineError:
        print("Transaction reverted as expected")

    # Revert testing
    with brownie.reverts("unauthorized"):
        token.admin_only({"from": accounts[2]})

    # Impersonate account
    whale = accounts.at("0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52", force=True)

    # Config access
    dep = config["dependencies"]

    # Disconnect
    network.disconnect()
