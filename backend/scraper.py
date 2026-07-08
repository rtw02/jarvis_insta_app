import instaloader
from datetime import datetime, timedelta, timezone


def scrape_profile(username: str, max_posts: int = 300) -> list[dict]:
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        quiet=True,
    )

    try:
        profile = instaloader.Profile.from_username(L.context, username)
    except instaloader.exceptions.ProfileNotExistsException:
        raise ValueError(f"Profile '{username}' not found or is private")
    except Exception as e:
        raise ValueError(f"Could not fetch profile: {str(e)}")

    if profile.is_private:
        raise ValueError(f"Profile '{username}' is private")

    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=730)
    posts = []

    try:
        for post in profile.get_posts():
            post_date = post.date_utc.replace(tzinfo=timezone.utc)
            if post_date < cutoff:
                break
            if len(posts) >= max_posts:
                break

            if post.typename == "GraphSidecar":
                # Carousel: get all images, score each independently
                try:
                    for node in post.get_sidecar_nodes():
                        if not node.is_video:
                            posts.append({
                                "id": f"{post.shortcode}_{len(posts)}",
                                "url": node.display_url,
                                "timestamp": post_date.isoformat(),
                                "caption": (post.caption or "")[:200],
                                "likes": post.likes,
                                "post_url": f"https://www.instagram.com/p/{post.shortcode}/",
                                "is_carousel": True,
                            })
                except Exception:
                    # Fallback to post thumbnail
                    posts.append(_post_to_dict(post))
            elif post.typename == "GraphImage":
                posts.append(_post_to_dict(post))
            # Skip GraphVideo entirely

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
    }
