import pytest
import os
from app.main import (
    save_campaign_archive,
    set_active_campaign_id,
    list_campaign_metadata,
    get_campaigns,
    get_campaign,
    activate_campaign,
    get_current_analysis,
    CAMPAIGNS_DIR
)

def test_campaign_archive_and_list():
    archive_data = {
        "insert_name": "Test Sentyabr 1",
        "beg_date": "2026-09-03",
        "end_date": "2026-09-07",
        "item_count": 15,
        "mapping": {},
        "quality_report": {},
        "analytics": {"kpi_cards": {"total_sales": 100}}
    }
    
    cid = save_campaign_archive("Test Sentyabr 1", "2026-09-03", "2026-09-07", archive_data)
    assert cid == "Test_Sentyabr_1_2026-09-03_2026-09-07"
    
    campaigns = get_campaigns()
    assert len(campaigns) >= 1
    found = [c for c in campaigns if c["id"] == cid]
    assert len(found) == 1
    assert found[0]["insert_name"] == "Test Sentyabr 1"
    assert found[0]["is_active"] is True

def test_get_campaign_by_id():
    archive_data = {
        "insert_name": "Test Oktyabr 2",
        "beg_date": "2026-10-01",
        "end_date": "2026-10-05",
        "item_count": 20,
        "mapping": {},
        "quality_report": {},
        "analytics": {"kpi_cards": {"total_sales": 500}}
    }
    cid = save_campaign_archive("Test Oktyabr 2", "2026-10-01", "2026-10-05", archive_data)
    
    json_data = get_campaign(cid)
    assert json_data["insert_name"] == "Test Oktyabr 2"
    assert json_data["item_count"] == 20

def test_activate_campaign():
    c1 = save_campaign_archive("Insert A", "2026-09-01", "2026-09-05", {"insert_name": "Insert A", "analytics": {"kpi_cards": {"total_sales": 10}}})
    c2 = save_campaign_archive("Insert B", "2026-09-10", "2026-09-15", {"insert_name": "Insert B", "analytics": {"kpi_cards": {"total_sales": 20}}})

    
    res = activate_campaign(c1)
    assert res["active_campaign_id"] == c1
    
    campaigns = get_campaigns()
    c1_meta = [c for c in campaigns if c["id"] == c1][0]
    assert c1_meta["is_active"] is True

def test_get_current_analysis():
    res = get_current_analysis()
    assert isinstance(res, dict)
