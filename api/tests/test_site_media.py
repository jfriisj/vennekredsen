"""Tests for managed homepage images and hero video configuration."""

from io import BytesIO

from sqlalchemy import create_engine, inspect, text

from migrate_site_media import migrate_engine

PNG_BYTES = b"\x89PNG\r\n\x1a\nmanaged-media-test"
JPEG_BYTES = b"\xff\xd8\xffmanaged-media-test"


def _upload(client, headers, media_key, filename, data):
    return client.put(
        f"/api/admin/site-media/{media_key}",
        headers=headers,
        data={"file": (BytesIO(data), filename)},
        content_type="multipart/form-data",
    )


def test_admin_can_upload_replace_and_remove_public_logo(client, admin_headers):
    upload = _upload(client, admin_headers, "logo", "logo.png", PNG_BYTES)
    assert upload.status_code == 200
    assert upload.get_json()["media"]["content_type"] == "image/png"
    assert (
        client.get("/api/site-settings").get_json()["media"]["logo_available"] is True
    )

    public = client.get("/api/site-media/logo")
    assert public.status_code == 200
    assert public.content_type == "image/png"
    assert public.data == PNG_BYTES

    replace = _upload(client, admin_headers, "logo", "logo.jpg", JPEG_BYTES)
    assert replace.status_code == 200
    assert client.get("/api/site-media/logo").content_type == "image/jpeg"

    remove = client.delete("/api/admin/site-media/logo", headers=admin_headers)
    assert remove.status_code == 204
    assert client.get("/api/site-media/logo").status_code == 404
    assert (
        client.get("/api/site-settings").get_json()["media"]["logo_available"] is False
    )


def test_member_cannot_manage_site_media(client, member_headers):
    upload = _upload(client, member_headers, "hero-background", "hero.png", PNG_BYTES)
    assert upload.status_code == 403

    remove = client.delete(
        "/api/admin/site-media/hero-background", headers=member_headers
    )
    assert remove.status_code == 403


def test_site_media_rejects_invalid_type_unknown_key_and_large_file(
    client, admin_headers
):
    invalid = _upload(client, admin_headers, "logo", "logo.txt", b"not an image")
    assert invalid.status_code == 400

    unknown = _upload(client, admin_headers, "other", "logo.png", PNG_BYTES)
    assert unknown.status_code == 404

    too_large = _upload(
        client,
        admin_headers,
        "hero-background",
        "hero.png",
        b"\x89PNG\r\n\x1a\n" + b"x" * (5 * 1024 * 1024),
    )
    assert too_large.status_code == 413


def test_admin_can_configure_direct_hero_video(client, admin_headers):
    update = client.put(
        "/api/admin/site-video",
        headers=admin_headers,
        json={
            "hero_video_url": "https://cdn.example.com/hero.mp4?version=2",
            "hero_video_enabled": True,
        },
    )
    assert update.status_code == 200
    assert update.get_json()["media"]["hero_video_enabled"] is True

    public = client.get("/api/site-settings")
    assert public.status_code == 200
    assert public.get_json()["media"] == {
        "hero_video_url": "https://cdn.example.com/hero.mp4?version=2",
        "hero_video_enabled": True,
        "hero_video_type": "direct",
        "hero_video_embed_url": "",
        "logo_available": False,
        "hero_background_available": False,
    }


def test_admin_can_configure_vimeo_hero_video(client, admin_headers):
    update = client.put(
        "/api/admin/site-video",
        headers=admin_headers,
        json={
            "hero_video_url": "https://vimeo.com/123456789",
            "hero_video_enabled": True,
        },
    )
    assert update.status_code == 200

    media = update.get_json()["media"]
    assert media["hero_video_type"] == "vimeo"
    assert media["hero_video_embed_url"].startswith(
        "https://player.vimeo.com/video/123456789?"
    )
    assert "background=1" in media["hero_video_embed_url"]
    assert "autoplay=1" in media["hero_video_embed_url"]
    assert "muted=1" in media["hero_video_embed_url"]
    assert "loop=1" in media["hero_video_embed_url"]

    player_update = client.put(
        "/api/admin/site-video",
        headers=admin_headers,
        json={
            "hero_video_url": "https://player.vimeo.com/video/987654321?h=abc123",
            "hero_video_enabled": True,
        },
    )
    assert player_update.status_code == 200
    player_media = player_update.get_json()["media"]
    assert player_media["hero_video_type"] == "vimeo"
    assert "video/987654321?" in player_media["hero_video_embed_url"]
    assert "h=abc123" in player_media["hero_video_embed_url"]


def test_hero_video_validation_rejects_unsupported_url(client, admin_headers):
    invalid = client.put(
        "/api/admin/site-video",
        headers=admin_headers,
        json={
            "hero_video_url": "https://www.youtube.com/watch?v=test",
            "hero_video_enabled": True,
        },
    )
    assert invalid.status_code == 400
    assert "hero_video_url" in invalid.get_json()["errors"]

    invalid_vimeo = client.put(
        "/api/admin/site-video",
        headers=admin_headers,
        json={
            "hero_video_url": "https://vimeo.com/channels/staffpicks",
            "hero_video_enabled": True,
        },
    )
    assert invalid_vimeo.status_code == 400

    missing = client.put(
        "/api/admin/site-video",
        headers=admin_headers,
        json={"hero_video_url": "", "hero_video_enabled": True},
    )
    assert missing.status_code == 400


def test_site_media_migration_adds_video_columns_idempotently():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE site_settings ("
                "id INTEGER PRIMARY KEY, "
                "hero_heading VARCHAR(120) NOT NULL, "
                "hero_subheading VARCHAR(500) NOT NULL, "
                "intro_text VARCHAR(1000) NOT NULL, "
                "announcement_text VARCHAR(500) NOT NULL DEFAULT '', "
                "announcement_visible BOOLEAN NOT NULL DEFAULT FALSE)"
            )
        )

    migrate_engine(engine)
    migrate_engine(engine)

    columns = {
        column["name"] for column in inspect(engine).get_columns("site_settings")
    }
    assert "hero_video_url" in columns
    assert "hero_video_enabled" in columns
