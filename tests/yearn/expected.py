import pytest
from ape import config
from ape import project, Contract


@pytest.fixture
def gov(accounts):
    yield accounts.impersonate_account("0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52")


@pytest.fixture
def user(accounts):
    yield accounts.test_accounts[0]


@pytest.fixture
def rewards(accounts):
    yield accounts.test_accounts[1]


@pytest.fixture
def token():
    token_address = "0x6b175474e89094c44da98b954eedeac495271d0f"
    yield Contract(token_address)


@pytest.fixture
def amount(accounts, token, user):
    amount = 10_000 * 10 ** token.decimals()
    reserve = accounts.impersonate_account("0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643")
    token.transfer(user, amount, sender=reserve)
    yield amount


@pytest.fixture
def vault(pm, gov, rewards, guardian, management, token):
    Vault = pm(config["dependencies"]  # TODO(ApeShift): migrate to ape-config.yaml[0]).Vault
    vault = guardian.deploy(Vault)
    vault.initialize(token, gov, rewards, "", "", guardian, management)
    vault.setDepositLimit(2**256 - 1, sender=gov)
    vault.setManagement(management, sender=gov)
    yield vault


@pytest.fixture(scope="function", autouse=True)
def shared_setup(fn_isolation  # TODO(ApeShift): Ape handles test isolation natively via ape-test plugin):
    pass
