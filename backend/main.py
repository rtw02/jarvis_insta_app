import logging
import os
import time

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from scraper import scrape_profile

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("jarvis")

# Suppress noisy urllib3/instaloader retry chatter
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("instaloader").setLevel(logging.WARNING)

app = FastAPI(title="JARVIS Instagram Analyzer")

# Allow all origins in dev — fixes preflight 400 when origin doesn't exactly match
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    log.info(f"→ {request.method} {request.url.path} | origin={request.headers.get('origin', '-')}")
    response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000
    log.info(f"← {request.method} {request.url.path} | {response.status_code} | {ms:.0f}ms")
    return response


class ScrapeRequest(BaseModel):
    username: str
    session_id: str = ""


@app.get("/health")
async def health():
    return {"status": "ONLINE", "system": "RYAN.AI"}


@app.post("/scrape")
async def scrape(req: ScrapeRequest):
    username = req.username.lstrip("@").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username required")

    session_id = req.session_id.strip() or None
    log.info(f"[SCRAPE] target=@{username} authenticated={bool(session_id)}")
    try:
        result = scrape_profile(username, session_id=session_id)
        posts = result["posts"]
        profile_pic_url = result.get("profile_pic_url")
        log.info(f"[SCRAPE] @{username} → {len(posts)} posts fetched")
    except ValueError as e:
        log.warning(f"[SCRAPE] @{username} failed: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.error(f"[SCRAPE] @{username} error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scrape failed: {str(e)}")

    return {"username": username, "total": len(posts), "posts": posts, "profile_pic_url": profile_pic_url}


@app.get("/proxy")
async def proxy_image(url: str):
    log.debug(f"[PROXY] {url[:80]}...")
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        ),
        "Referer": "https://www.instagram.com/",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    }

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            log.debug(f"[PROXY] {r.status_code} {len(r.content)} bytes")
            content_type = r.headers.get("content-type", "image/jpeg")
            return Response(
                content=r.content,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=86400",
                    "Access-Control-Allow-Origin": "*",
                },
            )
    except Exception as e:
        log.error(f"[PROXY] failed: {e}")
        raise HTTPException(status_code=502, detail=f"Image proxy failed: {str(e)}")


@app.get("/auth/instagram")
async def auth_instagram():
    """
    Opens a real Chromium window so the user can log into Instagram normally.
    Captures the sessionid cookie automatically and returns it.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise HTTPException(status_code=500, detail="Playwright not installed. Run: pip install playwright && playwright install chromium")

    log.info("[AUTH] Opening Instagram login window...")
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                args=["--window-size=500,700", "--window-position=100,100"],
            )
            context = await browser.new_context(viewport={"width": 500, "height": 700})
            page = await context.new_page()

            await page.goto("https://www.instagram.com/accounts/login/")

            log.info("[AUTH] Waiting for user to log in (120s timeout)...")
            # Wait until sessionid cookie appears (set after successful login)
            try:
                await page.wait_for_function(
                    """() => document.cookie.includes('sessionid') ||
                       window.location.pathname === '/'""",
                    timeout=120_000,
                )
            except Exception:
                await browser.close()
                raise HTTPException(status_code=408, detail="Login timed out — took longer than 120 seconds")

            # Extra wait for cookies to fully propagate
            await page.wait_for_timeout(1500)

            cookies = await context.cookies("https://www.instagram.com")
            session = next((c["value"] for c in cookies if c["name"] == "sessionid"), None)
            await browser.close()

            if not session:
                raise HTTPException(status_code=401, detail="Login appeared to succeed but sessionid cookie not found")

            log.info("[AUTH] Session captured successfully")
            return {"session_id": session, "status": "AUTHENTICATED"}

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"[AUTH] Playwright error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Auth failed: {str(e)}")


@app.get("/imessage")
async def get_imessage():
    try:
        from imessage import get_contacts
        contacts = get_contacts()
        log.info(f"[iMESSAGE] {len(contacts)} contacts returned")
        return {"contacts": contacts}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        log.error(f"[iMESSAGE] error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/birthdays")
async def get_birthdays(days: int = 90):
    try:
        from birthdays import get_upcoming_birthdays
        bdays = get_upcoming_birthdays(days_ahead=days)
        log.info(f"[BIRTHDAYS] {len(bdays)} upcoming in {days} days")
        return {"birthdays": bdays}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        log.error(f"[BIRTHDAYS] error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
