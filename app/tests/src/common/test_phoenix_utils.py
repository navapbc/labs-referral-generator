import pytest

from src.app_config import config
from src.common.phoenix_utils import which_prompt_version


@pytest.fixture(autouse=True)
def add_test_prompt_versions():
    config.PROMPT_VERSIONS["test_prompt1"] = "TESTversion1"
    config.PROMPT_VERSIONS["test_prompt2"] = "TESTversion2"
    yield
    del config.PROMPT_VERSIONS["test_prompt1"]
    del config.PROMPT_VERSIONS["test_prompt2"]


def test_which_prompt_version__nonlocal():
    config.environment = "non-local"
    assert which_prompt_version("test_prompt1") == {"prompt_version_id": "TESTversion1"}
    assert which_prompt_version("test_prompt2") == {"prompt_version_id": "TESTversion2"}

    with pytest.raises(KeyError):
        which_prompt_version("unregistered_prompt")


def test_which_prompt_version__local():
    config.environment = "local"
    assert which_prompt_version("test_prompt1") == {"prompt_identifier": "test_prompt1"}
    assert which_prompt_version("test_prompt2") == {"prompt_identifier": "test_prompt2"}
    assert which_prompt_version("new_local_prompt") == {"prompt_identifier": "new_local_prompt"}
