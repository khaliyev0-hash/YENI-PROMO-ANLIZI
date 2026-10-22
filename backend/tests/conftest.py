import os
import shutil
import tempfile
import pytest

@pytest.fixture(autouse=True, scope="session")
def isolate_test_campaign_data():
    """
    Prevents tests from writing test dummy campaigns into the live
    backend/data/campaigns directory or overwriting backend/data/active_campaign.json.
    """
    temp_dir = tempfile.mkdtemp(prefix="test_tamstore_data_")
    import app.main as main_mod

    orig_campaigns_dir = main_mod.CAMPAIGNS_DIR
    orig_active_file = main_mod.ACTIVE_CAMPAIGN_FILE

    test_campaigns_dir = os.path.join(temp_dir, "campaigns")
    test_active_file = os.path.join(temp_dir, "active_campaign.json")
    os.makedirs(test_campaigns_dir, exist_ok=True)

    main_mod.CAMPAIGNS_DIR = test_campaigns_dir
    main_mod.ACTIVE_CAMPAIGN_FILE = test_active_file

    yield

    main_mod.CAMPAIGNS_DIR = orig_campaigns_dir
    main_mod.ACTIVE_CAMPAIGN_FILE = orig_active_file
    shutil.rmtree(temp_dir, ignore_errors=True)
