import glob
import os
import sqlite3
from datetime import datetime, timezone

MAC_EPOCH = 978307200  # seconds between Unix epoch and Mac epoch (2001-01-01)


def mac_to_unix(mac_date: int | float) -> float:
    if mac_date > 1_000_000_000_000:
        return mac_date / 1_000_000_000 + MAC_EPOCH
    return float(mac_date) + MAC_EPOCH


def normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits[0] == "1":
        return f"+{digits}"
    if digits:
        return f"+{digits}"
    return ""


def format_phone(contact_id: str) -> str:
    digits = "".join(c for c in contact_id if c.isdigit())
    if len(digits) == 11 and digits[0] == "1":
        d = digits[1:]
        return f"({d[:3]}) {d[3:6]}-{d[6:]}"
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return contact_id


def build_contacts_map() -> dict[str, str]:
    """Read macOS Contacts DB → {normalized_phone_or_email: display_name}"""
    pattern = os.path.expanduser(
        "~/Library/Application Support/AddressBook/Sources/*/AddressBook-v22.abcddb"
    )
    db_paths = glob.glob(pattern)
    if not db_paths:
        return {}

    result: dict[str, str] = {}

    for db_path in db_paths:
        try:
            con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            con.row_factory = sqlite3.Row

            # Build pk → name map
            names: dict[int, str] = {}
            for row in con.execute(
                "SELECT Z_PK, ZFIRSTNAME, ZLASTNAME, ZORGANIZATION FROM ZABCDRECORD"
            ):
                first = (row["ZFIRSTNAME"] or "").strip()
                last = (row["ZLASTNAME"] or "").strip()
                org = (row["ZORGANIZATION"] or "").strip()
                name = f"{first} {last}".strip() or org
                if name:
                    names[row["Z_PK"]] = name

            # Phone numbers — try common column names across macOS versions
            for col in ("ZFULLNUMBER", "ZPHONENUMBER", "ZNUMBER"):
                try:
                    for row in con.execute(
                        f"SELECT ZOWNER, {col} FROM ZABCDPHONENUMBER WHERE {col} IS NOT NULL"
                    ):
                        name = names.get(row["ZOWNER"])
                        if not name:
                            continue
                        normalized = normalize_phone(row[col])
                        if normalized:
                            result[normalized] = name
                    break  # found the right column
                except sqlite3.OperationalError:
                    continue

            # Email addresses
            for col in ("ZADDRESS", "ZEMAIL"):
                try:
                    for row in con.execute(
                        f"SELECT ZOWNER, {col} FROM ZABCDEMAILADDRESS WHERE {col} IS NOT NULL"
                    ):
                        name = names.get(row["ZOWNER"])
                        if name:
                            result[row[col].lower()] = name
                    break
                except sqlite3.OperationalError:
                    continue

            con.close()
        except Exception:
            continue

    return result


def resolve_name(contact_id: str, contacts_map: dict[str, str]) -> str:
    """Try to resolve a phone/Apple ID to a real name."""
    if not contact_id:
        return contact_id

    # Email / Apple ID
    if "@" in contact_id:
        return contacts_map.get(contact_id.lower()) or contact_id

    # Phone number — normalize then look up
    normalized = normalize_phone(contact_id)
    if normalized and normalized in contacts_map:
        return contacts_map[normalized]

    # Also try the raw value
    if contact_id in contacts_map:
        return contacts_map[contact_id]

    return format_phone(contact_id)


def get_contacts(days_regular: int = 90, days_lapsed: int = 7) -> list[dict]:
    db = os.path.expanduser("~/Library/Messages/chat.db")
    if not os.path.exists(db):
        raise FileNotFoundError("chat.db not found at ~/Library/Messages/chat.db")

    now_ts = datetime.now(timezone.utc).timestamp()

    def to_mac_ns(days_ago: int) -> float:
        return (now_ts - MAC_EPOCH - days_ago * 86400) * 1_000_000_000

    cutoff_regular = to_mac_ns(days_regular)
    cutoff_lapsed = to_mac_ns(days_lapsed)
    cutoff_1y = to_mac_ns(365)

    try:
        con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    except sqlite3.OperationalError as e:
        raise PermissionError(
            "Cannot read chat.db — grant Full Disk Access to Terminal in "
            "System Settings → Privacy & Security → Full Disk Access"
        ) from e

    # Build name lookup before querying messages
    contacts_map = build_contacts_map()

    con.row_factory = sqlite3.Row
    try:
        rows = con.execute(
            """
            WITH individual_chats AS (
                SELECT c.ROWID  AS chat_id,
                       c.chat_identifier,
                       c.display_name,
                       COUNT(DISTINCT chj.handle_id) AS n_handles
                FROM   chat c
                JOIN   chat_handle_join chj ON c.ROWID = chj.chat_id
                GROUP  BY c.ROWID
                HAVING n_handles = 1
            ),
            last_msg AS (
                SELECT cmj.chat_id, MAX(m.ROWID) AS last_rowid
                FROM   chat_message_join cmj
                JOIN   message m ON cmj.message_id = m.ROWID
                GROUP  BY cmj.chat_id
            ),
            msg_counts AS (
                SELECT cmj.chat_id,
                    SUM(CASE WHEN m.date > ? THEN 1 ELSE 0 END) AS count_90d,
                    SUM(CASE WHEN m.date > ? THEN 1 ELSE 0 END) AS count_7d
                FROM   chat_message_join cmj
                JOIN   message m ON cmj.message_id = m.ROWID
                GROUP  BY cmj.chat_id
            )
            SELECT ic.chat_identifier,
                   ic.display_name,
                   m_last.date          AS last_date,
                   m_last.is_from_me    AS last_is_from_me,
                   m_last.text          AS last_text,
                   COALESCE(mc.count_90d, 0) AS count_90d,
                   COALESCE(mc.count_7d,  0) AS count_7d
            FROM   individual_chats ic
            JOIN   last_msg lm ON ic.chat_id = lm.chat_id
            JOIN   message m_last ON lm.last_rowid = m_last.ROWID
            LEFT   JOIN msg_counts mc ON ic.chat_id = mc.chat_id
            WHERE  m_last.date > ?
            ORDER  BY m_last.date DESC
            LIMIT  300
            """,
            (cutoff_regular, cutoff_lapsed, cutoff_1y),
        ).fetchall()
    finally:
        con.close()

    results = []
    for row in rows:
        contact_id = row["chat_identifier"] or ""

        # Skip short codes (5-6 digit marketing/SMS lists)
        digits = "".join(c for c in contact_id if c.isdigit())
        if digits and len(digits) <= 6:
            continue

        unix_ts = mac_to_unix(row["last_date"])
        days_since = max(0, int((now_ts - unix_ts) / 86400))
        count_90d = row["count_90d"] or 0
        is_regular = count_90d >= 4
        needs_response = not bool(row["last_is_from_me"])

        # Skip if no matching contact name (unresolved = spam/unknown)
        chat_display = row["display_name"]
        if not chat_display:
            if "@" in contact_id:
                resolved = contacts_map.get(contact_id.lower())
            else:
                resolved = contacts_map.get(normalize_phone(contact_id)) or contacts_map.get(contact_id)
            if not resolved:
                continue
            chat_display = resolved

        display = chat_display

        results.append({
            "contact_id": contact_id,
            "display_name": display,
            "last_date": datetime.fromtimestamp(unix_ts, tz=timezone.utc).isoformat(),
            "days_since": days_since,
            "last_is_from_me": bool(row["last_is_from_me"]),
            "needs_response": needs_response,
            "count_90d": count_90d,
            "count_7d": row["count_7d"] or 0,
            "is_regular": is_regular,
            "lapsed": is_regular and days_since >= days_lapsed,
            "last_preview": (row["last_text"] or "")[:60],
        })

    return results
