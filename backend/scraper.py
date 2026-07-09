import time
import instaloader
from datetime import datetime, timedelta, timezone


def _load_session(L: instaloader.Instaloader, session_id: str | None) -> None:
    """Try saved session file first, fall back to cookie string."""
    # 1. Try saved instaloader session files (~/.config/instaloader/session-*)
    import glob, os
    session_files = glob.glob(os.path.expanduser("~/.config/instaloader/session-*"))
    if session_files:
        # Use most recently modified session file
        latest = max(session_files, key=os.path.getmtime)
        ig_username = os.path.basename(latest).replace("session-", "")
        try:
            L.load_session_from_file(ig_username, latest)
            return
        except Exception:
            pass

    # 2. Fall back to cookie string passed from frontend
    if session_id:
        L.context._session.cookies.update({"sessionid": session_id})
        L.context.username = "authenticated"
        return

    raise ValueError(
        "No saved session found. Either:\n"
        "  A) Run: instaloader --login=YOUR_USERNAME  (one-time setup)\n"
        "  B) Paste your sessionid cookie from browser DevTools"
    )


def scrape_profile(username: str, session_id: str | None = None, max_posts: int = 300) -> list[dict]:
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        quiet=True,
    )

    _load_session(L, session_id)

    try:
        profile = instaloader.Profile.from_username(L.context, username)
    except instaloader.exceptions.ProfileNotExistsException:
        raise ValueError(f"Profile '{username}' not found or is private")
    except Exception as e:
        raise ValueError(f"Could not fetch profile: {str(e)}")

    if profile.is_private:
        raise ValueError(f"Profile '{username}' is private")

    for days in (180, 548):  # 6 months → fallback 1.5 years
        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=days)
        posts = _collect_posts(profile, cutoff, max_posts)
        if posts:
            break

    return posts


def _collect_posts(profile, cutoff, max_posts: int) -> list[dict]:
    posts = []
    try:
        for post in profile.get_posts():
            post_date = post.date_utc.replace(tzinfo=timezone.utc)
            if post_date < cutoff:
                break
            if len(posts) >= max_posts:
                break

            time.sleep(0.5)  # avoid Instagram escalating 403-retries to hard rate-limit

            if post.typename == "GraphSidecar":
                try:
                    for node in post.get_sidecar_nodes():
                        # Photos: use display_url. Video nodes: use display_url (thumbnail)
                        posts.append({
                            "id": f"{post.shortcode}_{len(posts)}",
                            "url": node.display_url,
                            "timestamp": post_date.isoformat(),
                            "caption": (post.caption or "")[:200],
                            "likes": post.likes,
                            "post_url": f"https://www.instagram.com/p/{post.shortcode}/",
                            "is_carousel": True,
                            "is_video": node.is_video,
                        })
                except Exception:
                    posts.append(_post_to_dict(post))
            elif post.typename == "GraphImage":
                posts.append(_post_to_dict(post))
            elif post.typename == "GraphVideo":
                # Reels / video posts — use thumbnail_url (cover JPEG)
                thumbnail = getattr(post, "thumbnail_url", None) or post.url
                posts.append({
                    "id": post.shortcode,
                    "url": thumbnail,
                    "timestamp": post_date.isoformat(),
                    "caption": (post.caption or "")[:200],
                    "likes": post.likes,
                    "post_url": f"https://www.instagram.com/p/{post.shortcode}/",
                    "is_carousel": False,
                    "is_video": True,
                })

    except Exception as e:
        if not posts:
            raise ValueError(f"Error fetching posts: {str(e)}")

    return posts


def _post_to_dict(post) -> dict:
    return {
        "id": post.shortcode,
        "url": post.url,
        "timestamp": post.date_utc.replace(tzinfo=timezone.utc).isoformat(),
        "caption": (post.caption or "")[:200],
        "likes": post.likes,
        "post_url": f"https://www.instagram.com/p/{post.shortcode}/",
        "is_carousel": False,
        "is_video": False,
    }
