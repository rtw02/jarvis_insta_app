import datetime
import glob
import os
import sqlite3

MAC_EPOCH = 978307200  # seconds between Unix epoch (1970) and Mac epoch (2001)


def get_upcoming_birthdays(days_ahead: int = 14) -> list[dict]:
    pattern = os.path.expanduser(
        "~/Library/Application Support/AddressBook/Sources/*/AddressBook-v22.abcddb"
    )
    paths = glob.glob(pattern)
    if not paths:
        raise FileNotFoundError("AddressBook database not found")

    today = datetime.date.today()
    results: list[dict] = []

    for db_path in paths:
        try:
            conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            cur = conn.cursor()
            cur.execute("""
                SELECT ZFIRSTNAME, ZLASTNAME, ZBIRTHDAY
                FROM ZABCDRECORD
                WHERE ZBIRTHDAY IS NOT NULL
                  AND (ZFIRSTNAME IS NOT NULL OR ZLASTNAME IS NOT NULL)
            """)
            for first, last, bday_mac in cur.fetchall():
                try:
                    bday_unix = float(bday_mac) + MAC_EPOCH
                    bday = datetime.date.fromtimestamp(bday_unix)

                    # Replace with this year's date (handle Feb 29)
                    try:
                        this_year = bday.replace(year=today.year)
                    except ValueError:
                        this_year = datetime.date(today.year, bday.month, 28)

                    days_until = (this_year - today).days
                    # If already passed this year, check next year
                    if days_until < 0:
                        try:
                            next_year = bday.replace(year=today.year + 1)
                        except ValueError:
                            next_year = datetime.date(today.year + 1, bday.month, 28)
                        days_until = (next_year - today).days

                    if 0 <= days_until <= days_ahead:
                        name = f"{first or ''} {last or ''}".strip()
                        if not name:
                            continue
                        birth_year = bday.year
                        # Some entries use placeholder years (e.g. 1604) — skip age calc
                        age = today.year - birth_year if birth_year > 1800 else None
                        results.append({
                            "name": name,
                            "days_until": days_until,
                            "age": age,
                        })
                except Exception:
                    continue
            conn.close()
        except Exception:
            continue

    # Deduplicate by name, keep closest
    seen: dict[str, dict] = {}
    for r in results:
        key = r["name"].lower()
        if key not in seen or r["days_until"] < seen[key]["days_until"]:
            seen[key] = r

    return sorted(seen.values(), key=lambda x: x["days_until"])
