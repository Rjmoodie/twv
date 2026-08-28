#!/usr/bin/env python3
"""
SomaTech Discord Options Trading Bot
Integrates with Supabase for persistent storage and website dashboard
"""

import asyncio
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable, Optional

import discord
import httpx
from dateutil import tz
from dateutil.parser import parse as parse_date
from discord import app_commands

from dotenv import load_dotenv
from supabase import create_client


# ---------------------------------------------------------------------------
# Configuration & Logging
# ---------------------------------------------------------------------------

load_dotenv()


def _configure_logging() -> logging.Logger:
    """Configure a module-level logger once."""

    level_name = os.getenv("OPTIONS_BOT_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    root_logger = logging.getLogger()
    if not root_logger.handlers:
        logging.basicConfig(
            level=level,
            format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        )
    logger = logging.getLogger("somatech.options_bot")
    logger.setLevel(level)
    return logger


logger = _configure_logging()


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        logger.warning("Invalid integer for %s: %s – using %s", name, value, default)
        return default


@dataclass(slots=True)
class BotConfig:
    supabase_url: str
    supabase_key: str
    discord_token: str
    signals_channel_id: int
    plays_channel_id: int
    timezone: tz.tzfile
    daily_report_hour: int
    daily_report_minute: int
    weekly_report_hour: int
    weekly_report_minute: int
    alpha_vantage_key: Optional[str]
    supabase_workers: int = 4

    @classmethod
    def from_env(cls) -> "BotConfig":
        tz_name = os.getenv("OPTIONS_BOT_TIMEZONE", "America/New_York")
        timezone = tz.gettz(tz_name)
        if timezone is None:
            logger.warning("Unknown timezone %s – falling back to America/New_York", tz_name)
            timezone = tz.gettz("America/New_York")

        return cls(
            supabase_url=os.getenv("SUPABASE_URL", ""),
            supabase_key=os.getenv("SUPABASE_KEY", ""),
            discord_token=os.getenv("DISCORD_BOT_TOKEN", ""),
            signals_channel_id=_env_int("SIGNALS_CHANNEL_ID", 0),
            plays_channel_id=_env_int("PLAYS_CHANNEL_ID", 0),
            timezone=timezone,
            daily_report_hour=_env_int("DAILY_REPORT_HOUR", 16),
            daily_report_minute=_env_int("DAILY_REPORT_MINUTE", 0),
            weekly_report_hour=_env_int("WEEKLY_REPORT_HOUR", 16),
            weekly_report_minute=_env_int("WEEKLY_REPORT_MINUTE", 10),
            alpha_vantage_key=os.getenv("ALPHA_VANTAGE_API_KEY"),
            supabase_workers=_env_int("SUPABASE_MAX_WORKERS", 4),
        )


CONFIG = BotConfig.from_env()

SUPABASE_URL = CONFIG.supabase_url
SUPABASE_KEY = CONFIG.supabase_key
DISCORD_BOT_TOKEN = CONFIG.discord_token
SIGNALS_CHANNEL_ID = CONFIG.signals_channel_id
PLAYS_CHANNEL_ID = CONFIG.plays_channel_id

TZ = CONFIG.timezone
DAILY_REPORT_HOUR = CONFIG.daily_report_hour
DAILY_REPORT_MIN = CONFIG.daily_report_minute
WEEKLY_REPORT_HOUR = CONFIG.weekly_report_hour
WEEKLY_REPORT_MIN = CONFIG.weekly_report_minute

# Initialize Supabase client
supabase = None
supabase_repo: Optional["SupabaseRepository"] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client configured (URL provided: %s)", bool(SUPABASE_URL))
    except Exception as exc:
        logger.exception("Failed to initialize Supabase client: %s", exc)
        supabase = None


class SupabaseRepository:
    """Thin async wrapper to execute Supabase SDK calls on a dedicated pool."""

    def __init__(self, client, max_workers: int = 4) -> None:
        self._client = client
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="supabase")

    async def _run(self, fn: Callable[[], Any]):
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, fn)

    async def insert_play(self, row: dict):
        def _op():
            return self._client.table("plays").insert(row).execute()

        return await self._run(_op)

    async def update_play(self, play_id: int, patch: dict):
        def _op():
            return self._client.table("plays").update(patch).eq("id", play_id).execute()

        return await self._run(_op)

    async def select(self, builder: Callable):
        return await self._run(builder)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False)


if supabase:
    supabase_repo = SupabaseRepository(supabase, max_workers=max(CONFIG.supabase_workers, 1))

# Discord intents
INTENTS = discord.Intents.default()
INTENTS.message_content = True
INTENTS.guilds = True

# Regex patterns for parsing
OPEN_PAT = re.compile(
    r"\bopen(?:ed)?\b\s*([A-Za-z]{1,5})[^0-9A-Za-z]*"
    r"(\d+(?:\.\d+)?)\s*([cCpP])[sS]?\b"
    r"[^A-Za-z0-9]*([A-Za-z]{3,}\s+\d{1,2}|[A-Za-z]{3,}|[0-9]{1,2}[/-][0-9]{1,2}|[0-9]{4}-[0-9]{2}-[0-9]{2})",
    re.IGNORECASE
)
# Note: ADD_PAT and CLOSE_PAT are now handled inline with more specific patterns

def normalize_expiry(txt: str) -> str:
    """Normalize expiry date to ISO format"""
    now = datetime.now(tz=TZ)
    txt = txt.replace("sept", "sep").replace("Sept", "Sep")
    
    # Handle common formats
    if re.match(r"^[A-Za-z]{3}\s+\d{1,2}$", txt.strip()):
        # Format: "Sep 12" or "Dec 25"
        try:
            dt = parse_date(txt, default=now.replace(month=1, day=1))
            # If the date is in the past, assume next year
            if dt.year == now.year and dt.date() < now.date():
                dt = dt.replace(year=now.year + 1)
            return dt.date().isoformat()
        except Exception:
            pass
    
    try:
        dt = parse_date(txt, default=now.replace(month=1, day=1))
        if dt.year == now.year and dt.date() < now.date() and re.search(r"\d{4}", txt) is None:
            dt = dt.replace(year=now.year + 1)
        return dt.date().isoformat()
    except Exception:
        # If all else fails, return a default date (next Friday)
        next_friday = now + timedelta(days=(4 - now.weekday()) % 7)
        return next_friday.date().isoformat()

def play_title(ticker, strike, opt_type, expiry_iso, status="OPEN"):
    """Generate play title for Discord thread with status indicator"""
    if float(strike).is_integer():
        strike = int(float(strike))
    
    # Convert ISO date to more readable format
    try:
        dt = datetime.strptime(expiry_iso, "%Y-%m-%d")
        readable_date = dt.strftime("%b %d")
    except:
        readable_date = expiry_iso
    
    # Add status emoji
    status_emoji = {
        "OPEN": "🟢",
        "ADDED": "🟡", 
        "CLOSED": "🔴"
    }.get(status, "⚪")
    
    return f"{status_emoji} {ticker.upper()} {strike}{opt_type.upper()} {readable_date}"

async def update_thread_name(thread, play):
    """Update thread name to reflect current status"""
    try:
        new_name = play_title(play['ticker'], play['strike'], play['option_type'], play['expiry'], play['status'])
        await thread.edit(name=new_name)
    except Exception as e:
        logger.warning("Could not update thread name for thread %s: %s", getattr(thread, "id", "?"), e)

def play_embed(play: dict) -> discord.Embed:
    """Create Discord embed for play with status-based colors"""
    status = play.get('status', 'OPEN')
    
    # Status-based colors
    color_map = {
        'OPEN': 0x00ff00,    # Green
        'ADDED': 0xffaa00,   # Orange/Yellow  
        'CLOSED': 0xff0000   # Red
    }
    
    e = discord.Embed(
        title=play_title(play['ticker'], play['strike'], play['option_type'], play['expiry'], status),
        description=f"**Status:** {status}",
        timestamp=datetime.now(tz=TZ),
        color=color_map.get(status, 0x808080)  # Default gray
    )
    e.add_field(name="Ticker", value=play['ticker'].upper(), inline=True)
    e.add_field(name="Strike", value=str(play['strike']), inline=True)
    e.add_field(name="Type", value=play['option_type'].upper(), inline=True)
    
    # Format expiry date for display
    try:
        dt = datetime.strptime(play['expiry'], "%Y-%m-%d")
        display_expiry = dt.strftime("%b %d, %Y")
    except:
        display_expiry = play['expiry']
    
    e.add_field(name="Expiry", value=display_expiry, inline=True)
    if play.get("entries"):
        e.add_field(name="Adds/Entries", value=play['entries'], inline=False)
    if play.get("pnl"):
        e.add_field(name="PnL", value=play['pnl'], inline=True)
    
    opened = play.get("opened_at")
    closed = play.get("closed_at")
    footer = f"Opened: {opened}" if opened else ""
    if closed:
        footer += f" | Closed: {closed}"
    if footer:
        e.set_footer(text=footer)
    
    return e

# Alpha Vantage integration for PnL calculation
async def get_options_price_at_time(ticker: str, strike: float, option_type: str, expiry: str, timestamp: str):
    """Get options contract price at a specific time using Alpha Vantage"""
    api_key = CONFIG.alpha_vantage_key
    if not api_key:
        logger.warning("Alpha Vantage API key missing; skipping price lookup")
        return None

    try:
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    except ValueError:
        logger.warning("Invalid timestamp provided for price lookup: %s", timestamp)
        return None

    params = {
        "function": "OPTIONS_CHAIN",
        "symbol": ticker.upper(),
        "apikey": api_key,
        "datadate": dt.strftime("%Y-%m-%d"),
    }

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0, read=10.0),
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        ) as client:
            response = await client.get("https://www.alphavantage.co/query", params=params)
    except httpx.HTTPError as exc:
        logger.warning("Alpha Vantage request failed: %s", exc)
        return None

    if response.status_code != 200:
        logger.warning("Alpha Vantage returned non-200 status: %s", response.status_code)
        return None

    try:
        data = response.json()
    except ValueError:
        logger.error("Alpha Vantage response could not be decoded as JSON")
        return None

    if "Error Message" in data:
        logger.error("Alpha Vantage API error: %s", data["Error Message"])
        return None

    if "Note" in data:
        logger.warning("Alpha Vantage note received (likely throttled): %s", data["Note"])
        return None

    contracts = data.get("data") or []
    for option_data in contracts:
        option_strike = option_data.get("strike")
        option_type_api = option_data.get("option_type")
        option_expiry = option_data.get("expiration_date")

        if (
            option_strike == str(strike)
            and option_type_api == option_type.upper()
            and option_expiry == expiry
        ):
            bid_price = float(option_data.get("bid", 0) or 0)
            ask_price = float(option_data.get("ask", 0) or 0)
            price = bid_price if bid_price > 0 else ask_price if ask_price > 0 else None
            if price is None:
                logger.debug(
                    "Contract %s %s%s %s found but missing bid/ask data",
                    ticker,
                    strike,
                    option_type,
                    expiry,
                )
            return price

    logger.info(
        "Options contract not found for %s %s%s %s (contracts returned: %s)",
        ticker,
        strike,
        option_type,
        expiry,
        len(contracts),
    )
    return None

# Supabase helper functions
def _ensure_repo() -> "SupabaseRepository":
    if not supabase_repo:
        raise RuntimeError("Supabase repository not configured")
    return supabase_repo


async def sb_insert_play(row: dict):
    """Insert new play into Supabase"""
    repo = _ensure_repo()
    return await repo.insert_play(row)


async def sb_update_play(play_id: int, patch: dict):
    """Update play in Supabase"""
    repo = _ensure_repo()
    return await repo.update_play(play_id, patch)


async def sb_get_recent_play_by_thread(thread_id: int):
    """Get most recent play by thread ID"""
    repo = _ensure_repo()

    def _builder():
        return (
            supabase.table("plays")
            .select("*")
            .eq("thread_id", thread_id)
            .order("id", desc=True)
            .limit(1)
            .execute()
        )

    resp = await repo.select(_builder)
    data = resp.data or []
    return data[0] if data else None


async def sb_get_recent_play_by_keys(ticker: str, strike: float, opt_type: str, expiry: str | None = None):
    """Get most recent play by ticker, strike, and option type"""
    repo = _ensure_repo()

    def _builder():
        query = (
            supabase.table("plays")
            .select("*")
            .eq("ticker", ticker)
            .eq("strike", strike)
            .eq("option_type", opt_type)
            .neq("status", "CLOSED")
        )
        if expiry:
            query = query.eq("expiry", expiry)
        return query.order("id", desc=True).limit(1).execute()

    resp = await repo.select(_builder)
    data = resp.data or []
    return data[0] if data else None


async def sb_get_recent_open_any():
    """Get most recent open play"""
    repo = _ensure_repo()

    def _builder():
        return (
            supabase.table("plays")
            .select("*")
            .neq("status", "CLOSED")
            .order("id", desc=True)
            .limit(1)
            .execute()
        )

    resp = await repo.select(_builder)
    data = resp.data or []
    return data[0] if data else None


async def sb_query_report(start_iso: str):
    """Query plays for reports"""
    repo = _ensure_repo()

    def _builder():
        return (
            supabase.table("plays")
            .select("ticker,strike,option_type,expiry,status,entries,pnl,opened_at,closed_at")
            .or_(f"opened_at.gte.{start_iso},closed_at.gte.{start_iso}")
            .order("ticker", desc=False)
            .order("expiry", desc=False)
            .order("strike", desc=False)
            .execute()
        )

    resp = await repo.select(_builder)
    return resp.data or []

class OptionsBot(discord.Client):
    def __init__(self):
        super().__init__(intents=INTENTS)
        self.tree = app_commands.CommandTree(self)
        self.processed_messages = set()  # Track processed messages to prevent duplicates
        self.recent_plays = {}  # Track recent plays to prevent duplicates

    async def setup_hook(self):
        # Don't copy global commands to guild=None, just sync globally
        await self.tree.sync()
        # Start scheduler
        self.loop.create_task(self.scheduler())

    async def on_ready(self):
        logger.info("SomaTech Options Bot logged in as %s", self.user)
        logger.info("Connected to %s server(s)", len(self.guilds))
        logger.info("Supabase connected: %s", bool(supabase))

    async def on_message(self, message: discord.Message):
        if message.author.bot:
            return
        
        # Prevent duplicate processing with better tracking
        message_key = f"{message.author.id}_{message.channel.id}_{message.content.strip()}"
        if message_key in self.processed_messages:
            logger.debug("Skipping duplicate message from %s in %s", message.author.id, message.channel.id)
            return

        # Check if we're already processing this exact message
        if hasattr(self, 'processing_messages') and message_key in self.processing_messages:
            logger.debug("Already processing message %s", message_key)
            return
        
        # Mark as processing
        if not hasattr(self, 'processing_messages'):
            self.processing_messages = set()
        self.processing_messages.add(message_key)
        self.processed_messages.add(message_key)
        
        # Clean up old processed messages (keep only last 100)
        if len(self.processed_messages) > 100:
            self.processed_messages = set(list(self.processed_messages)[-50:])
        if len(self.processing_messages) > 50:
            self.processing_messages = set(list(self.processing_messages)[-25:])
        
        in_signals = (message.channel.id == SIGNALS_CHANNEL_ID)
        in_plays_thread = isinstance(message.channel, discord.Thread) and getattr(message.channel, "parent_id", None) == PLAYS_CHANNEL_ID
        
        if not in_signals and not in_plays_thread:
            return

        text = message.content.strip()
        logger.debug("Processing message %s from %s", message.id, message.author.id)

        # OPEN only from #signals
        if in_signals:
            m = OPEN_PAT.search(text)
            if m:
                ticker, strike, opt_type, expiry_raw = m.groups()
                expiry_iso = normalize_expiry(expiry_raw)
                opened_at = datetime.utcnow().isoformat()
                play_key = f"{ticker.upper()}_{strike}_{opt_type.upper()}_{expiry_iso}"

                # 1) Try to INSERT FIRST (no thread yet). This is the race-safe step.
                row = {
                    "ticker": ticker.upper(),
                    "strike": float(strike),
                    "option_type": opt_type.upper(),
                    "expiry": expiry_iso,
                    "status": "OPEN",
                    "thread_id": None,
                    "main_msg_id": None,
                    "opened_at": opened_at,
                    "entries": "",
                    "pnl": "",
                    "source_message_id": int(message.id),
                }

                try:
                    # This insert will fail with a unique-violation if a non-closed play already exists
                    ins = await asyncio.to_thread(lambda: supabase.table("plays").insert(row).execute())
                    play = ins.data[0]  # newly created row

                except Exception as e:
                    # Check if it's a uniqueness error (duplicate open OR same message)
                    err_txt = str(e).lower()
                    if "duplicate key" in err_txt or "unique" in err_txt:
                        # Fetch the existing open play for this contract
                        existing = await sb_get_recent_play_by_keys(ticker.upper(), float(strike), opt_type.upper(), expiry_iso)
                        if existing:
                            # Point to the existing thread
                            thread = message.guild.get_thread(int(existing["thread_id"])) if existing.get("thread_id") else None
                            if thread:
                                # Try to add reaction, but don't fail if rate limited
                                try:
                                    await message.add_reaction("🔁")
                                except Exception:
                                    pass  # Ignore reaction errors due to rate limits
                                await message.reply(
                                    f"Play already open here → {thread.mention}",
                                    mention_author=False
                                )
                            else:
                                # Try to add reaction, but don't fail if rate limited
                                try:
                                    await message.add_reaction("🔁")
                                except Exception:
                                    pass  # Ignore reaction errors due to rate limits
                                await message.reply("Play already open (thread pending).", mention_author=False)
                            if hasattr(self, 'processing_messages'):
                                self.processing_messages.discard(message_key)
                            return
                        else:
                            # Fallback: someone closed it between checks; let the user retry.
                            # Try to add reaction, but don't fail if rate limited
                            try:
                                await message.add_reaction("⚠️")
                            except Exception:
                                pass  # Ignore reaction errors due to rate limits
                            await message.reply("Couldn't open: conflict detected. Try again.", mention_author=False)
                            if hasattr(self, 'processing_messages'):
                                self.processing_messages.discard(message_key)
                            return
                    else:
                        # Other DB error
                        # Try to add reaction, but don't fail if rate limited
                        try:
                            await message.add_reaction("❌")
                        except Exception:
                            pass  # Ignore reaction errors due to rate limits
                        await message.reply("DB error creating play. Check Supabase.", mention_author=False)
                        if hasattr(self, 'processing_messages'):
                            self.processing_messages.discard(message_key)
                        return

                # 2) Only now create the Discord thread (we are the winner of the race).
                plays_channel = self.get_channel(PLAYS_CHANNEL_ID)
                if not plays_channel:
                    await message.add_reaction("❌")
                    await message.reply("Can't find #option-plays. Check PLAYS_CHANNEL_ID.", mention_author=False)
                    if hasattr(self, 'processing_messages'):
                        self.processing_messages.discard(message_key)
                    return

                thread_name = play_title(ticker, strike, opt_type, expiry_iso, "OPEN")
                thread = await plays_channel.create_thread(name=thread_name, type=discord.ChannelType.public_thread)

                # 3) Post the embed and update the DB with thread/message IDs
                embed = play_embed(play)
                main_msg = await thread.send(embed=embed)

                await sb_update_play(play["id"], {
                    "thread_id": int(thread.id),
                    "main_msg_id": int(main_msg.id)
                })

                # Try to add success reaction, but don't fail if rate limited
                try:
                    await message.add_reaction("✅")
                except Exception:
                    pass  # Ignore reaction errors due to rate limits
                logger.info("Opened play %s", play_title(ticker, strike, opt_type, expiry_iso))
                if hasattr(self, 'processing_messages'):
                    self.processing_messages.discard(message_key)
                return

        # ADD - Only process in play threads with explicit trading context
        if in_plays_thread:
            # Check for explicit add commands with more context
            add_patterns = [
                r"\b(?:add|added)\s+(?:to\s+)?(?:position|play)?\s*(?:at\s*)?@?(\d+(?:\.\d+)?)?\b",
                r"\b(?:scale|scaling)\s+(?:up\s+)?(?:at\s*)?@?(\d+(?:\.\d+)?)?\b",
                r"\b(?:buy|buying)\s+(?:more\s+)?(?:at\s*)?@?(\d+(?:\.\d+)?)?\b"
            ]
            
            for pattern in add_patterns:
                m = re.search(pattern, text, re.IGNORECASE)
                if m:
                    price = m.group(1)
                    await self._update_recent_in_thread(message, action="ADD", detail=price)
                    return

        # CLOSE - Only process in play threads with explicit trading context  
        if in_plays_thread:
            logger.debug("Processing message in plays thread: %s", text)
            
            # Additional check: Only process if the message starts with close/closed and has the right structure
            if not text.lower().startswith(('close ', 'closed ')):
                logger.debug("Message does not start with close/closed: %s", text)
                return

            # Extra safety: Only process if the message has at least 5 space-separated parts (close + ticker + strike + type + expiry)
            parts = text.strip().split()
            logger.debug("Message parts for close detection: %s", parts)
            if len(parts) < 5:
                logger.debug("Close command too short: %s", text)
                return
            
            # Simplified close command - must have EXACT format: "closed TICKER STRIKE TYPE EXPIRY"
            # This pattern requires ALL 4 components in the correct order and must be the ONLY content
            close_pattern = re.compile(
                r"^(?:close|closed)\s+([A-Za-z]{1,5})\s+(\d+(?:\.\d+)?)\s*([cCpP])[sS]?\s+([A-Za-z]{3,}\s+\d{1,2}|[A-Za-z]{3,}|[0-9]{1,2}[/-][0-9]{1,2}|[0-9]{4}-[0-9]{2}-[0-9]{2})\s*$",
                re.IGNORECASE
            )
            
            m = close_pattern.search(text)
            if m:
                ticker, strike, opt_type, expiry_raw = m.groups()
                logger.debug("Close command matched for %s %s%s %s", ticker, strike, opt_type, expiry_raw)
                await self._update_recent_in_thread(message, action="CLOSE", detail=(ticker, strike, opt_type, expiry_raw))
                return
            else:
                # Debug: only log when "close" is mentioned as a potential command (not in regular conversation)
                if re.search(r"^(?:close|closed)\b", text, re.IGNORECASE):
                    logger.debug("Close mentioned but pattern did not match: %s", text)

    async def _update_recent_in_thread(self, message: discord.Message, action: str, detail):
        """Update recent play in thread"""
        target_thread_id = message.channel.id if (isinstance(message.channel, discord.Thread) and getattr(message.channel, "parent_id", None) == PLAYS_CHANNEL_ID) else None

        # Try to extract ticker info from message
        ticker = None; strike = None; opt_type = None
        hint = re.search(r"\b([A-Za-z]{1,5})\s+(\d+(?:\.\d+)?)([cCpP])\b", message.content)
        if hint:
            ticker, strike, opt_type = hint.groups()
            ticker = ticker.upper(); opt_type = opt_type.upper(); strike = float(strike)

        # Find the play to update
        if target_thread_id:
            play = await sb_get_recent_play_by_thread(target_thread_id)
        elif ticker and strike and opt_type:
            play = await sb_get_recent_play_by_keys(ticker, strike, opt_type)
        else:
            play = await sb_get_recent_open_any()

        if not play:
            await message.reply("❌ Couldn't find an open play to update. Try using `/add` or `/close` in the play thread.", mention_author=False)
            return

        try:
            # Update database first (this is the critical part)
            if action == "ADD":
                price = detail
                timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
                new_entries = ((play.get("entries") or "") + "; " if play.get("entries") else "") + (f"@{price} ({timestamp} UTC)" if price else f"add ({timestamp} UTC)")
                await sb_update_play(play["id"], {"status":"ADDED", "entries": new_entries})
                play["status"] = "ADDED"; play["entries"] = new_entries
                logger.info("Added to play %s %s%s", play['ticker'], play['strike'], play['option_type'])

            elif action == "CLOSE":
                # Handle simplified close command
                if isinstance(detail, tuple) and len(detail) == 4:
                    # New format: (ticker, strike, option_type, expiry)
                    ticker, strike, opt_type, expiry_raw = detail
                    closed_at = datetime.utcnow().isoformat()
                    
                    # Calculate PnL using Alpha Vantage
                    try:
                        logger.debug("Calculating PnL for %s %s%s", play['ticker'], play['strike'], play['option_type'])
                        pnl_percentage = await self._calculate_pnl_with_alpha_vantage(play)
                        if pnl_percentage is not None:
                            new_pnl = f"{pnl_percentage:+.1f}%"
                            logger.info("Calculated PnL for %s %s%s: %s", play['ticker'], play['strike'], play['option_type'], new_pnl)
                        else:
                            # If Alpha Vantage fails, use a fallback calculation or manual entry
                            # For now, set to "Manual Entry Required" so user knows to add PnL manually
                            new_pnl = "Manual Entry Required"
                            logger.warning("Alpha Vantage failed, setting PnL to manual entry for %s %s%s", play['ticker'], play['strike'], play['option_type'])
                    except Exception as e:
                        logger.exception("Error calculating PnL for %s %s%s: %s", play['ticker'], play['strike'], play['option_type'], e)
                        new_pnl = "Manual Entry Required"
                    
                    await sb_update_play(play["id"], {"status":"CLOSED", "closed_at": closed_at, "pnl": new_pnl})
                    play["status"] = "CLOSED"; play["closed_at"] = closed_at; play["pnl"] = new_pnl
                    logger.info("Closed play %s %s%s with PnL %s", play['ticker'], play['strike'], play['option_type'], new_pnl)
                else:
                    # Legacy format: (price, pnl)
                    price, pnl = detail
                    closed_at = datetime.utcnow().isoformat()
                    new_pnl = pnl or (f"@{price}" if price else "")
                    await sb_update_play(play["id"], {"status":"CLOSED", "closed_at": closed_at, "pnl": new_pnl})
                    play["status"] = "CLOSED"; play["closed_at"] = closed_at; play["pnl"] = new_pnl
                    logger.info("Closed play %s %s%s with PnL %s", play['ticker'], play['strike'], play['option_type'], new_pnl)
            
            # Add confirmation reaction immediately (this usually works even with rate limits)
            try:
                await message.add_reaction("✅")
            except Exception:
                pass  # Ignore reaction errors
            
            # Try to update Discord thread (but don't fail if this doesn't work due to rate limits)
            try:
                thread = message.guild.get_thread(int(play["thread_id"]))
                if thread:
                    # Add delay to avoid rate limits
                    await asyncio.sleep(1)
                    
                    # Update thread name to reflect new status
                    await update_thread_name(thread, play)
                    
                    if action == "ADD":
                        await thread.send(f"📈 Added position {('at $'+price) if price else ''}.")
                        # Try to update main message embed
                        try:
                            main_msg = await thread.fetch_message(int(play["main_msg_id"]))
                            await main_msg.edit(embed=play_embed(play))
                        except Exception:
                            pass  # If embed update fails, just ignore it
                    
                    elif action == "CLOSE":
                        await thread.send(f"🔒 Closed. {('Exit '+price) if price else ''} {pnl or ''}")
                        # Try to update main message embed
                        try:
                            main_msg = await thread.fetch_message(int(play["main_msg_id"]))
                            await main_msg.edit(embed=play_embed(play))
                        except Exception:
                            pass  # If embed update fails, just ignore it
                            
            except Exception as discord_error:
                # Discord update failed, but database was updated successfully
                logger.warning("Discord update failed (likely rate limited): %s", discord_error)
                # Don't show error to user since the important part (database) succeeded

        except Exception as e:
            logger.exception("Error updating play %s: %s", play.get('id'), e)
            # Only show error to user if database update failed
            if "database" in str(e).lower() or "supabase" in str(e).lower():
                await message.add_reaction("❌")
            await message.reply("❌ Error updating play.", mention_author=False)

    # Report generation
    async def build_report_text(self, scope: str = "daily") -> str:
        """Build report text for daily/weekly summaries"""
        now_et = datetime.now(tz=TZ)
        if scope == "daily":
            start = now_et.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            start = (now_et - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
        start_iso = start.astimezone(tz=tz.UTC).isoformat()

        rows = await sb_query_report(start_iso)
        header = f"📊 **SomaTech Options Plays Summary** – {now_et.strftime('%Y-%m-%d')} ({'Daily' if scope=='daily' else 'Weekly'})"
        
        if not rows:
            return f"{header}\n\n_No plays to report._"

        def pad(s, w):
            ss = str(s)
            return ss + ' '*(w - len(ss)) if len(ss) < w else ss[:w]
        
        cols = ["TICKER","STRIKE","TYPE","EXPIRY","STATUS","ENTRIES","PNL"]
        widths = [6,7,4,12,7,20,8]

        lines = []
        lines.append("```")
        lines.append("".join(pad(c,w)+"  " for c,w in zip(cols, widths)).rstrip())
        
        for r in rows:
            strike_disp = int(r["strike"]) if float(r["strike"]).is_integer() else r["strike"]
            line = [
                pad(r["ticker"], widths[0]),
                pad(strike_disp, widths[1]),
                pad(r["option_type"], widths[2]),
                pad(r["expiry"], widths[3]),
                pad(r["status"], widths[4]),
                pad((r.get("entries") or "").replace(";", ", "), widths[5]),
                pad(r.get("pnl") or "", widths[6]),
            ]
            lines.append("  ".join(str(x) for x in line))
        
        lines.append("```")
        body = "\n".join(lines)

        # Calculate win/loss for both daily and weekly reports
        wins = 0
        losses = 0
        closed = 0
        
        for r in rows:
            if r["status"] == "CLOSED":
                closed += 1
                pnl_str = (r.get("pnl") or "").strip()
                if pnl_str:
                    # Check for various PnL formats: +50%, -25%, +$100, -$50, etc.
                    if pnl_str.startswith("+") or ("+" in pnl_str and "%" in pnl_str):
                        wins += 1
                    elif pnl_str.startswith("-") or ("-" in pnl_str and "%" in pnl_str):
                        losses += 1
                    # Also check for positive/negative numbers
                    elif re.match(r"^\d+(\.\d+)?[%$]?$", pnl_str):
                        try:
                            # Extract number from PnL string
                            pnl_num = re.search(r"[\d.-]+", pnl_str)
                            if pnl_num:
                                num = float(pnl_num.group())
                                if num > 0:
                                    wins += 1
                                elif num < 0:
                                    losses += 1
                        except:
                            pass
        
        if scope == "weekly":
            stats = f"\n**📈 Closed:** {closed} | **🎯 W/L:** {wins}/{losses}"
        else:
            stats = f"\n**📈 Closed:** {closed} | **🎯 W/L:** {wins}/{losses}"

        return f"{header}\n\n{body}{stats}"

    async def post_or_update_daily_pin(self, text: str):
        """Post or update daily pinned report"""
        channel = self.get_channel(PLAYS_CHANNEL_ID)
        try:
            pins = await channel.pins()
        except Exception:
            pins = []
        
        target = None
        for m in pins:
            if m.author.id == self.user.id and "Options Plays Summary" in (m.content or "") and "(Daily)" in (m.content or ""):
                target = m
                break
        
        if target:
            await target.edit(content=text)
            return target
        else:
            msg = await channel.send(text)
            try:
                await msg.pin()
            except Exception:
                pass
            return msg

    async def post_weekly_report(self, text: str):
        """Post weekly report"""
        channel = self.get_channel(PLAYS_CHANNEL_ID)
        return await channel.send(text)

    async def _calculate_pnl_with_alpha_vantage(self, play):
        """Calculate PnL using Alpha Vantage API"""
        try:
            logger.debug(
                "Starting PnL calculation for %s %s%s %s",
                play['ticker'],
                play['strike'],
                play['option_type'],
                play['expiry'],
            )
            
            # Get entry price from entries field or use a default calculation
            import re
            entry_match = re.search(r'@(\d+\.?\d*)', play.get("entries", ""))
            if entry_match:
                entry_price = float(entry_match[1])
                logger.debug("Found entry price in entries: %s", entry_price)
            else:
                logger.debug("No entry price provided in entries for play %s", play['id'])
                # If no entry price recorded, try to get it from Alpha Vantage at open time
                logger.debug("Fetching entry price from Alpha Vantage at %s", play['opened_at'])
                entry_price = await get_options_price_at_time(
                    play["ticker"],
                    play["strike"],
                    play["option_type"],
                    play["expiry"],
                    play["opened_at"]
                )
                if entry_price is None:
                    logger.warning("Could not get entry price from Alpha Vantage for play %s", play['id'])
                    return None
                logger.debug("Received entry price from Alpha Vantage: %s", entry_price)

            # Get current price from Alpha Vantage
            logger.debug("Fetching current option price from Alpha Vantage for play %s", play['id'])
            current_price = await get_options_price_at_time(
                play["ticker"],
                play["strike"],
                play["option_type"],
                play["expiry"],
                datetime.utcnow().isoformat()
            )

            if entry_price and current_price:
                pnl_percentage = ((current_price - entry_price) / entry_price) * 100
                logger.debug(
                    "Calculated PnL for play %s: entry %s current %s pnl %.2f",
                    play['id'],
                    entry_price,
                    current_price,
                    pnl_percentage,
                )
                return pnl_percentage
            else:
                logger.warning(
                    "Missing prices while calculating PnL for play %s (entry=%s current=%s)",
                    play['id'],
                    entry_price,
                    current_price,
                )
                return None
            
        except Exception as e:
            logger.exception("Error calculating PnL with Alpha Vantage for play %s: %s", play.get('id'), e)
            return None

    async def scheduler(self):
        """Handle scheduled reports"""
        last_daily_date = None
        last_weekly_key = None
        
        while not self.is_closed():
            now = datetime.now(tz=TZ)
            wd = now.isoweekday()
            
            # Daily report (weekdays at 4 PM ET)
            if wd in (1,2,3,4,5) and now.hour == DAILY_REPORT_HOUR and now.minute == DAILY_REPORT_MIN:
                key = now.date().isoformat()
                if key != last_daily_date:
                    try:
                        text = await self.build_report_text("daily")
                        await self.post_or_update_daily_pin(text)
                        last_daily_date = key
                        logger.info("Posted daily report for %s", key)
                    except Exception as e:
                        logger.exception("Daily report error: %s", e)
            
            # Weekly report (Fridays at 4:10 PM ET)
            if wd == 5 and now.hour == WEEKLY_REPORT_HOUR and now.minute == WEEKLY_REPORT_MIN:
                iso_year, iso_week, _ = now.isocalendar()
                week_key = f"{iso_year}-W{iso_week}"
                if week_key != last_weekly_key:
                    try:
                        text = await self.build_report_text("weekly")
                        await self.post_weekly_report(text)
                        last_weekly_key = week_key
                        logger.info("Posted weekly report for %s", week_key)
                    except Exception as e:
                        logger.exception("Weekly report error: %s", e)
            
            await asyncio.sleep(30)

# Slash commands
client = OptionsBot()

@client.tree.command(description="Open a new option play")
@app_commands.describe(
    ticker="Stock ticker (e.g., AMD)", 
    strike="Strike price (e.g., 164)", 
    option_type="C for Call, P for Put", 
    expiry="Expiry date (e.g., 2025-09-12 or Sep 12)", 
    note="Optional note"
)
async def open(interaction: discord.Interaction, ticker: str, strike: float, option_type: str, expiry: str, note: str = ""):
    """Open a new options play"""
    expiry_iso = normalize_expiry(expiry)
    opened_at = datetime.utcnow().isoformat()
    
    plays_channel = interaction.client.get_channel(PLAYS_CHANNEL_ID)
    if plays_channel is None:
        await interaction.response.send_message("❌ PLAYS_CHANNEL_ID is invalid.", ephemeral=True)
        return
    
    # Try to insert first (race-safe approach)
    row = {
        "ticker": ticker.upper(),
        "strike": float(strike),
        "option_type": option_type.upper(),
        "expiry": expiry_iso,
        "status": "OPEN",
        "thread_id": None,
        "main_msg_id": None,
        "opened_at": opened_at,
        "entries": note or "",
        "pnl": "",
        "source_message_id": None  # Slash commands don't have a message ID
    }
    
    try:
        play_resp = await sb_insert_play(row)
        play = play_resp.data[0]
    except Exception as e:
        if "duplicate key" in str(e).lower() or "unique" in str(e).lower():
            existing = await sb_get_recent_play_by_keys(ticker.upper(), float(strike), option_type.upper(), expiry_iso)
            if existing and existing.get("thread_id"):
                thread = interaction.guild.get_thread(int(existing["thread_id"]))
                if thread:
                    await interaction.response.send_message(
                        f"Already open here → {thread.mention}",
                        ephemeral=True
                    )
                else:
                    await interaction.response.send_message("Already open (thread not found).", ephemeral=True)
                return
            await interaction.response.send_message("Already open.", ephemeral=True)
            return
        raise
    
    # Create thread and update the play
    thread_name = play_title(ticker, strike, option_type, expiry_iso, "OPEN")
    thread = await plays_channel.create_thread(name=thread_name, type=discord.ChannelType.public_thread)
    
    # Post the embed and update the DB with thread/message IDs
    embed = play_embed(play)
    main_msg = await thread.send(embed=embed)
    
    await sb_update_play(play["id"], {
        "thread_id": int(thread.id),
        "main_msg_id": int(main_msg.id)
    })
    
    await interaction.response.send_message(f"✅ Opened play in thread {thread.mention}", ephemeral=True)
    logger.info("Opened play via slash command: %s", play_title(ticker, strike, option_type, expiry_iso))

@client.tree.command(description="Add/scale to an existing play")
@app_commands.describe(
    ticker="Stock ticker (e.g., AMD)", 
    strike="Strike price (e.g., 164)", 
    option_type="C for Call, P for Put", 
    price="Optional fill price"
)
async def add(interaction: discord.Interaction, ticker: str, strike: float, option_type: str, price: float | None = None):
    """Add to an existing play"""
    await _manual_update(interaction, ticker, strike, option_type, action="ADD", detail=(str(price) if price is not None else None))

@client.tree.command(description="Close an existing play")
@app_commands.describe(
    ticker="Stock ticker (e.g., AMD)", 
    strike="Strike price (e.g., 164)", 
    option_type="C for Call, P for Put", 
    expiry="Expiry date (e.g., 2025-09-12 or Sep 12)"
)
async def close(interaction: discord.Interaction, ticker: str, strike: float, option_type: str, expiry: str):
    """Close an existing play (PnL will be calculated automatically)"""
    await _manual_update(interaction, ticker, strike, option_type, action="CLOSE", detail=(ticker, strike, option_type, expiry))

@client.tree.command(description="Post an options plays report")
@app_commands.describe(scope="daily or weekly")
async def report(interaction: discord.Interaction, scope: str = "daily"):
    """Post a report of options plays"""
    scope = scope.lower()
    if scope not in ("daily","weekly"):
        await interaction.response.send_message("❌ Use scope: daily or weekly", ephemeral=True)
        return
    
    try:
        text = await interaction.client.build_report_text(scope)
        channel = interaction.client.get_channel(PLAYS_CHANNEL_ID)
        await channel.send(text)
        await interaction.response.send_message(f"📊 Report posted in {channel.mention}.", ephemeral=True)
        logger.info("Manual report posted: %s", scope)
    except Exception as e:
        logger.exception("Error posting manual report: %s", e)
        await interaction.response.send_message("❌ Error posting report.", ephemeral=True)

@client.tree.command(description="Close all open positions")
async def close_all(interaction: discord.Interaction, exit_price: float | None = None, pnl: str | None = None):
    """Close all open positions"""
    try:
        # Get all open positions
        resp = await asyncio.to_thread(lambda: supabase.table("plays").select("*").in_("status", ["OPEN", "ADDED"]).order("created_at", desc=True).execute())
        plays = resp.data or []
        
        if not plays:
            await interaction.response.send_message("📊 **No open positions to close.**", ephemeral=True)
            return
        
        # Confirm the action
        await interaction.response.send_message(f"🔒 **Closing {len(plays)} positions...**", ephemeral=True)
        
        closed_count = 0
        errors = []
        
        for play in plays:
            try:
                # Update the play to closed
                closed_at = datetime.utcnow().isoformat()
                new_pnl = pnl or (f"@{exit_price}" if exit_price else "")
                
                await sb_update_play(play["id"], {
                    "status": "CLOSED", 
                    "closed_at": closed_at, 
                    "pnl": new_pnl
                })
                
                # Update the thread if it exists (with better error handling)
                if play.get("thread_id"):
                    try:
                        thread = interaction.guild.get_thread(int(play["thread_id"]))
                        if thread and play.get("main_msg_id"):
                            # Check if message is recent enough to edit (less than 1 hour old)
                            try:
                                main_msg = await thread.fetch_message(int(play["main_msg_id"]))
                                message_age = datetime.utcnow() - main_msg.created_at.replace(tzinfo=None)
                                
                                if message_age.total_seconds() < 3600:  # Less than 1 hour
                                    play["status"] = "CLOSED"
                                    play["closed_at"] = closed_at
                                    play["pnl"] = new_pnl
                                    await main_msg.edit(embed=play_embed(play))
                                else:
                                    # Message too old to edit, just send new message
                                    await thread.send(f"🔒 **Position Closed** - {play['ticker']} {play['strike']}{play['option_type']} {('Exit '+(str(exit_price) if exit_price else '')) if exit_price else ''} {pnl or ''}")
                            except Exception as edit_error:
                                # If edit fails, just send a new message
                                await thread.send(f"🔒 **Position Closed** - {play['ticker']} {play['strike']}{play['option_type']} {('Exit '+(str(exit_price) if exit_price else '')) if exit_price else ''} {pnl or ''}")
                    except Exception as e:
                        logger.warning("Could not update thread for play %s: %s", play['id'], e)
                
                closed_count += 1
                logger.info("Closed play %s %s%s via close_all with PnL %s", play['ticker'], play['strike'], play['option_type'], new_pnl)
                
                # Add small delay to avoid rate limiting
                await asyncio.sleep(0.5)
                
            except Exception as e:
                error_msg = f"Play {play['id']} ({play['ticker']} {play['strike']}{play['option_type']}): {str(e)}"
                errors.append(error_msg)
                logger.exception("Error closing play %s: %s", play['id'], e)
        
        # Send summary
        summary = f"✅ **Closed {closed_count} of {len(plays)} positions**"
        if errors:
            summary += f"\n❌ **{len(errors)} errors occurred:**\n" + "\n".join(errors[:5])  # Show first 5 errors
            if len(errors) > 5:
                summary += f"\n... and {len(errors) - 5} more errors"
        
        # Send follow-up message (with timeout handling)
        try:
            await interaction.followup.send(summary, ephemeral=True)
        except Exception as followup_error:
            logger.warning("Could not send follow-up message: %s", followup_error)
            # Try to send a regular message instead
            try:
                await interaction.channel.send(f"🔒 **Close All Complete**: {summary}")
            except:
                logger.error("Could not send any response message after close_all")

        logger.info("Closed %s positions via close_all command", closed_count)

    except Exception as e:
        logger.exception("Error in close_all command: %s", e)
        # Only try to respond if we haven't already
        if not interaction.response.is_done():
            try:
                await interaction.response.send_message("❌ Error closing positions.", ephemeral=True)
            except Exception as response_error:
                logger.error("Could not send error response: %s", response_error)
        else:
            try:
                await interaction.followup.send("❌ Error closing positions.", ephemeral=True)
            except Exception as followup_error:
                logger.error("Could not send follow-up error: %s", followup_error)

@client.tree.command(description="Update PnL for a closed position")
@app_commands.describe(
    ticker="Stock ticker (e.g., AMD)", 
    strike="Strike price (e.g., 164)", 
    option_type="Call or Put (C or P)",
    expiry="Expiry date (e.g., 2025-10-03)",
    pnl_percentage="PnL percentage (e.g., 25.5 for +25.5%)"
)
async def pnl(interaction: discord.Interaction, ticker: str, strike: float, option_type: str, expiry: str, pnl_percentage: float):
    """Update PnL for a closed position"""
    try:
        # Find the play
        play = await sb_get_recent_play_by_keys(ticker.upper(), strike, option_type.upper(), expiry)
        if not play:
            await interaction.response.send_message(f"❌ Couldn't find play: {ticker} {strike}{option_type} {expiry}", ephemeral=True)
            return
        
        if play["status"] != "CLOSED":
            await interaction.response.send_message(f"❌ Play is not closed: {ticker} {strike}{option_type} {expiry}", ephemeral=True)
            return
        
        # Update PnL
        new_pnl = f"{pnl_percentage:+.1f}%"
        await sb_update_play(play["id"], {"pnl": new_pnl})
        
        # Update thread if possible
        try:
            thread = interaction.guild.get_thread(int(play["thread_id"]))
            if thread:
                await thread.send(f"📊 PnL updated: {new_pnl}")
        except Exception:
            pass  # Ignore thread update errors
        
        await interaction.response.send_message(f"✅ PnL updated: {new_pnl}", ephemeral=True)
        logger.info("PnL updated: %s %s%s %s -> %s", ticker, strike, option_type, expiry, new_pnl)

    except Exception as e:
        logger.exception("Error updating PnL for %s %s%s %s: %s", ticker, strike, option_type, expiry, e)
        await interaction.response.send_message("❌ Error updating PnL", ephemeral=True)

@client.tree.command(description="List all open positions")
async def positions(interaction: discord.Interaction):
    """List all open positions (robust + safe limits)"""
    # 1) Defer immediately so we don't hit the 3s timeout.
    try:
        await interaction.response.defer(ephemeral=True)
    except Exception as e:
        # If defer fails (interaction expired), try to send a direct response
        try:
            await interaction.response.send_message("❌ Command timed out. Please try again.", ephemeral=True)
        except Exception:
            # If even that fails, the interaction is completely dead
            logger.error("Interaction completely expired: %s", e)
            return

    try:
        # 2) Select only what we need and sort newest first.
        def fetch_open():
            return (
                supabase.table("plays")
                .select("id,ticker,strike,option_type,expiry,status,entries,pnl,opened_at,created_at")
                .in_("status", ["OPEN", "ADDED"])
                .order("created_at", desc=True)
                .execute()
            )

        resp = await _ensure_repo().select(fetch_open)
        plays = resp.data or []

        if not plays:
            await interaction.followup.send("📊 **No open positions found.**", ephemeral=True)
            return

        # 3) Build a compact, safe embed (cap field sizes; max 10 fields).
        embed = discord.Embed(
            title="📊 Open Positions",
            description=f"Found {len(plays)} open position(s)",
            color=0x00ff00,
            timestamp=datetime.now(tz=TZ),
        )

        def trunc(s: str, limit: int) -> str:
            if not s: return ""
            s = str(s)
            return (s[:limit-1] + "…") if len(s) > limit else s

        shown = 0
        for play in plays:
            if shown >= 10:  # keep under 25 fields & keep embed tidy
                break

            # Format expiry + strike
            try:
                dt = datetime.strptime(play['expiry'], "%Y-%m-%d")
                display_expiry = dt.strftime("%b %d, %Y")
            except Exception:
                display_expiry = str(play['expiry'])

            strike_display = int(play['strike']) if float(play['strike']).is_integer() else play['strike']

            # Field name must be <= 256
            field_name = trunc(f"Position #{play['id']}", 256)

            # Build field body; each field value must be <= 1024
            parts = [
                f"**{play['ticker']} {strike_display}{play['option_type']} {display_expiry}**",
                f"Status: {play['status']}",
            ]
            if play.get('entries'):
                parts.append(f"Entries: {trunc(play['entries'], 300)}")  # cap long strings
            if play.get('pnl'):
                parts.append(f"PnL: {trunc(play['pnl'], 50)}")

            try:
                opened_dt = datetime.fromisoformat(str(play['opened_at']).replace('Z', '+00:00'))
                parts.append(f"Opened: {opened_dt.strftime('%m/%d %H:%M')}")
            except Exception:
                parts.append(f"Opened: {trunc(str(play['opened_at']), 40)}")

            field_value = trunc("\n".join(parts), 1024)

            embed.add_field(name=field_name, value=field_value, inline=True)
            shown += 1

        if len(plays) > shown:
            embed.set_footer(text=f"Showing first {shown} of {len(plays)} positions")

        # 4) Try sending the embed; if Discord rejects (size), fall back to text table.
        try:
            await interaction.followup.send(embed=embed, ephemeral=True)
        except Exception as e:
            # Fallback: compact monospace table
            cols = ["TICKER","STRK","T","EXPIRY","STATUS"]
            widths = [6,5,1,11,7]
            def pad(s,w): s=str(s); return s[:w] if len(s)>w else s + " "*(w-len(s))
            lines = ["```\n" + "  ".join(pad(c,w) for c,w in zip(cols,widths))]
            for p in plays[:15]:
                try:
                    dt = datetime.strptime(p['expiry'], "%Y-%m-%d")
                    dexp = dt.strftime("%Y-%m-%d")
                except: dexp = str(p['expiry'])
                strike_disp = int(p['strike']) if float(p['strike']).is_integer() else p['strike']
                line = [
                    pad(p['ticker'], widths[0]),
                    pad(strike_disp, widths[1]),
                    pad(p['option_type'], widths[2]),
                    pad(dexp, widths[3]),
                    pad(p['status'], widths[4]),
                ]
                lines.append("  ".join(line))
            lines.append("```")
            await interaction.followup.send("\n".join(lines), ephemeral=True)

    except Exception as e:
        # If anything went wrong, send one clean error once.
        await interaction.followup.send("❌ Error retrieving positions.", ephemeral=True)
        logger.exception("Error retrieving positions: %s", e)

async def _manual_update(interaction, ticker, strike, option_type, action, detail):
    """Handle manual updates via slash commands"""
    play = await sb_get_recent_play_by_keys(ticker.upper(), float(strike), option_type.upper())
    if not play:
        await interaction.response.send_message("❌ No open play found.", ephemeral=True)
        return
    
    try:
        thread = interaction.guild.get_thread(int(play["thread_id"]))
        if thread is None:
            await interaction.response.send_message("❌ Thread not found.", ephemeral=True)
            return
        
        main_msg = await thread.fetch_message(int(play["main_msg_id"]))

        if action == "ADD":
            price = detail
            timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
            new_entries = ((play.get("entries") or "") + "; " if play.get("entries") else "") + (f"@{price} ({timestamp} UTC)" if price else f"add ({timestamp} UTC)")
            await sb_update_play(play["id"], {"status":"ADDED", "entries": new_entries})
            play["status"] = "ADDED"; play["entries"] = new_entries
            await main_msg.edit(embed=play_embed(play))
            await thread.send(f"📈 Added position {('at $'+price) if price else ''}.")
            await interaction.response.send_message("✅ Updated.", ephemeral=True)
            logger.info("Added to play via slash command: %s %s%s", play['ticker'], play['strike'], play['option_type'])

        elif action == "CLOSE":
            if isinstance(detail, tuple) and len(detail) == 4:
                # New format: (ticker, strike, option_type, expiry)
                ticker, strike, option_type, expiry = detail
                closed_at = datetime.utcnow().isoformat()
                
                # Calculate PnL using Alpha Vantage
                pnl_percentage = await interaction.client._calculate_pnl_with_alpha_vantage(play)
                if pnl_percentage is not None:
                    new_pnl = f"{pnl_percentage:+.1f}%"
                else:
                    # If Alpha Vantage fails, use a fallback calculation or manual entry
                    new_pnl = "Manual Entry Required"
                
                await sb_update_play(play["id"], {"status":"CLOSED", "closed_at": closed_at, "pnl": new_pnl})
                play["status"] = "CLOSED"; play["closed_at"] = closed_at; play["pnl"] = new_pnl
                await main_msg.edit(embed=play_embed(play))
                await thread.send(f"🔒 Closed. PnL: {new_pnl}")
                await interaction.response.send_message(f"✅ Position closed! PnL: {new_pnl}", ephemeral=True)
                logger.info(
                    "Closed play via slash command: %s %s%s with PnL %s",
                    play['ticker'],
                    play['strike'],
                    play['option_type'],
                    new_pnl,
                )
            else:
                # Legacy format: (price, pnl)
                price, pnl = detail
                closed_at = datetime.utcnow().isoformat()
                new_pnl = pnl or (f"@{price}" if price else "")
                await sb_update_play(play["id"], {"status":"CLOSED", "closed_at": closed_at, "pnl": new_pnl})
                play["status"] = "CLOSED"; play["closed_at"] = closed_at; play["pnl"] = new_pnl
                await main_msg.edit(embed=play_embed(play))
                await thread.send(f"🔒 Closed. {('Exit '+(price or '')) if price else ''} {pnl or ''}")
                await interaction.response.send_message("✅ Position closed successfully!", ephemeral=True)
                logger.info(
                    "Closed play via legacy slash command: %s %s%s with PnL %s",
                    play['ticker'],
                    play['strike'],
                    play['option_type'],
                    new_pnl,
                )
    except Exception as e:
        logger.exception("Error in manual update for %s %s%s: %s", ticker, strike, option_type, e)
        await interaction.response.send_message("❌ Error updating play.", ephemeral=True)

if __name__ == "__main__":
    # Validate configuration
    if not DISCORD_BOT_TOKEN or not SIGNALS_CHANNEL_ID or not PLAYS_CHANNEL_ID:
        logger.error("Missing DISCORD_BOT_TOKEN or channel IDs.")
        logger.error("Required environment variables: DISCORD_BOT_TOKEN, SIGNALS_CHANNEL_ID, PLAYS_CHANNEL_ID")
        raise SystemExit(1)

    if not supabase:
        logger.error("Missing Supabase configuration (SUPABASE_URL/SUPABASE_KEY)")
        raise SystemExit(1)

    logger.info("Starting SomaTech Options Bot…")
    logger.info("Supabase URL configured: %s", bool(SUPABASE_URL))
    logger.info("Signals Channel: %s", SIGNALS_CHANNEL_ID)
    logger.info("Plays Channel: %s", PLAYS_CHANNEL_ID)

    try:
        client.run(DISCORD_BOT_TOKEN)
    except Exception as e:
        logger.exception("Bot startup error: %s", e)
        raise SystemExit(1)
