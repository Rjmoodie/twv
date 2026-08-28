"""
Basic tests for PDUFA scraper parsers.
"""

import asyncio
import pytest
from scripts.pdufa.sources import fda_press, company_rss
from scripts.pdufa.models import Item, Source, DecisionType
from scripts.pdufa.pipeline import merge_and_score


def test_fda_press_parser():
    """Test FDA press release parser."""
    items = asyncio.run(fda_press.parse())
    assert isinstance(items, list)
    assert all(isinstance(item, Item) for item in items)
    assert all(item.source == Source.FDA_PRESS for item in items)
    assert all(hasattr(item, "headline") for item in items)
    assert all(hasattr(item, "url") for item in items)


def test_company_rss_parser():
    """Test company RSS parser."""
    items = asyncio.run(company_rss.parse())
    assert isinstance(items, list)
    assert all(isinstance(item, Item) for item in items)
    assert all(item.source == Source.COMPANY_RSS for item in items)
    assert all(hasattr(item, "headline") for item in items)
    assert all(hasattr(item, "url") for item in items)


def test_pipeline_merge_and_score():
    """Test pipeline merge and scoring functionality."""
    from datetime import datetime, date
    
    # Create test items
    items = [
        Item(
            id="test-1",
            source=Source.FDA_PRESS,
            captured_at=datetime.utcnow(),
            event_date=date.today(),
            headline="FDA Approves New Drug",
            url="https://example.com/1",
            decision_type=DecisionType.APPROVAL,
            confidence=0.8
        ),
        Item(
            id="test-2",
            source=Source.COMPANY_RSS,
            captured_at=datetime.utcnow(),
            event_date=date.today(),
            headline="Company Announces FDA Approval",
            url="https://example.com/2",
            ticker="PFE",
            decision_type=DecisionType.APPROVAL,
            confidence=0.6
        )
    ]
    
    result = merge_and_score(items)
    
    assert isinstance(result, type(items[0].__class__.__bases__[0].__bases__[0]))  # Result type
    assert result.deduped_count <= len(items)
    assert result.raw_count == len(items)
    assert all(isinstance(item, Item) for item in result.items)


def test_item_model():
    """Test Item model validation."""
    from datetime import datetime, date
    
    item = Item(
        id="test-item",
        source=Source.FDA_PRESS,
        captured_at=datetime.utcnow(),
        event_date=date.today(),
        headline="Test Headline",
        url="https://example.com",
        decision_type=DecisionType.APPROVAL,
        confidence=0.8
    )
    
    assert item.id == "test-item"
    assert item.source == Source.FDA_PRESS
    assert item.headline == "Test Headline"
    assert item.confidence == 0.8
    assert item.decision_type == DecisionType.APPROVAL


if __name__ == "__main__":
    pytest.main([__file__])

