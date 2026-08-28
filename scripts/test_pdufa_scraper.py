#!/usr/bin/env python3
"""
Quick test script for the PDUFA scraper system.
"""

import asyncio
import sys
from pathlib import Path

# Add the scripts directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from pdufa.sources import fda_press, company_rss
from pdufa.pipeline import merge_and_score
from pdufa.export import to_md, to_json


async def test_scraper():
    """Test the PDUFA scraper with a small subset of sources."""
    print("🧠 Testing Smarter PDUFA Scraper...")
    print("=" * 50)
    
    try:
        # Test FDA press releases
        print("📰 Fetching FDA press releases...")
        fda_items = await fda_press.parse()
        print(f"   Found {len(fda_items)} FDA press releases")
        
        # Test company RSS feeds (limited to 2 companies for speed)
        print("🏢 Fetching company RSS feeds...")
        limited_feeds = {
            "PFE": "https://www.pfizer.com/news/press-releases/rss.xml",
            "BMY": "https://news.bms.com/cpress/rss/index.xml"
        }
        rss_items = await company_rss.parse(limited_feeds)
        print(f"   Found {len(rss_items)} company RSS items")
        
        # Merge and score
        print("🔄 Processing and scoring items...")
        all_items = fda_items + rss_items
        result = merge_and_score(all_items)
        
        print(f"   Raw items: {result.raw_count}")
        print(f"   Deduplicated: {result.deduped_count}")
        print(f"   Confidence range: {min(i.confidence for i in result.items):.2f} - {max(i.confidence for i in result.items):.2f}")
        
        # Show top 5 items
        print("\n📊 Top 5 Items by Confidence:")
        print("-" * 50)
        for i, item in enumerate(result.items[:5], 1):
            print(f"{i}. [{item.confidence:.2f}] {item.headline[:60]}...")
            print(f"   Source: {item.source.value} | Date: {item.event_date or 'N/A'}")
            print()
        
        # Export test files
        print("💾 Exporting test files...")
        to_md(result, "test_pdufa_output.md")
        to_json(result, "test_pdufa_output.json")
        print("   ✅ Exported to test_pdufa_output.md and test_pdufa_output.json")
        
        print("\n🎉 PDUFA Scraper test completed successfully!")
        print("   Run 'python -m scripts.pdufa.cli run' for the full experience")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_scraper())

