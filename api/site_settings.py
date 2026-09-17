from datetime import datetime
from urllib.parse import parse_qs, urlencode, urlparse

from flask import Response, jsonify, request
from werkzeug.utils import secure_filename

DEFAULT_SITE_SETTINGS = {
    "hero_heading": "Vi gør gode idéer mulige.",
    "hero_subheading": (
        "Vennekredsen samler midler og frivillige kræfter, så børnene på "
        "Hashøjskolen får flere oplevelser, stærkere fællesskaber og bedre "
        "rammer i hverdagen."
    ),
    "intro_text": (
        "Vennekredsen arbejder for, at økonomi ikke bliver en barriere "
        "for børnenes deltagelse i oplevelser og aktiviteter omkring skolen."
    ),
    "announcement_text": "",
    "announcement_visible": False,
}
DEFAULT_MEDIA_SETTINGS = {
    "hero_video_url": "",
    "hero_video_enabled": False,
}

FIELD_LIMITS = {
    "hero_heading": 120,
    "hero_subheading": 500,
    "intro_text": 1000,
    "announcement_text": 500,
}
MEDIA_KEYS = {"logo", "hero-background"}
MAX_MEDIA_BYTES = 5 * 1024 * 1024
VIMEO_HOSTS = {"vimeo.com", "www.vimeo.com", "player.vimeo.com"}


def _detect_image_content_type(data):
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _vimeo_video_details(parsed):
    host = (parsed.hostname or "").casefold()
    if host not in VIMEO_HOSTS:
        return None

    parts = [part for part in parsed.path.split("/") if part]
    video_id = None
    privacy_hash = None

    if host == "player.vimeo.com":
        if len(parts) >= 2 and parts[0].casefold() == "video" and parts[1].isdigit():
            video_id = parts[1]
    elif parts and parts[0].isdigit():
        video_id = parts[0]
        if len(parts) >= 2 and parts[1].isalnum():
            privacy_hash = parts[1]

    if not video_id:
        return None

    query = parse_qs(parsed.query)
    if query.get("h"):
        privacy_hash = query["h"][0]

    parameters = {
        "background": "1",
        "autoplay": "1",
        "muted": "1",
        "loop": "1",
        "autopause": "0",
        "title": "0",
        "byline": "0",
        "portrait": "0",
    }
    if privacy_hash:
        parameters["h"] = privacy_hash

    return {
        "type": "vimeo",
        "embed_url": (
            f"https://player.vimeo.com/video/{video_id}?{urlencode(parameters)}"
        ),
    }


def _video_details(value):
    if not value:
        return {"type": "", "embed_url": ""}

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None

    path = parsed.path.casefold()
    if path.endswith(".mp4") or path.endswith(".webm"):
        return {"type": "direct", "embed_url": ""}

    return _vimeo_video_details(parsed)


def register_site_settings(app, db, admin_required):
    class SiteSettings(db.Model):  # type: ignore
        __tablename__ = "site_settings"

        id = db.Column(db.Integer, primary_key=True)
        hero_heading = db.Column(db.String(120), nullable=False)
        hero_subheading = db.Column(db.String(500), nullable=False)
        intro_text = db.Column(db.String(1000), nullable=False)
        announcement_text = db.Column(db.String(500), nullable=False, default="")
        announcement_visible = db.Column(db.Boolean, nullable=False, default=False)
        hero_video_url = db.Column(db.String(1000), nullable=False, default="")
        hero_video_enabled = db.Column(db.Boolean, nullable=False, default=False)
        updated_at = db.Column(
            db.DateTime,
            nullable=False,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
        )

    class SiteMedia(db.Model):  # type: ignore
        __tablename__ = "site_media"

        media_key = db.Column(db.String(40), primary_key=True)
        filename = db.Column(db.String(255), nullable=False)
        content_type = db.Column(db.String(50), nullable=False)
        data = db.Column(db.LargeBinary, nullable=False)
        updated_at = db.Column(
            db.DateTime,
            nullable=False,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
        )

    def serialize(settings):
        if settings is None:
            return dict(DEFAULT_SITE_SETTINGS)

        return {
            "hero_heading": settings.hero_heading,
            "hero_subheading": settings.hero_subheading,
            "intro_text": settings.intro_text,
            "announcement_text": settings.announcement_text,
            "announcement_visible": settings.announcement_visible,
        }

    def serialize_media_settings(settings):
        if settings is None:
            media_settings = dict(DEFAULT_MEDIA_SETTINGS)
        else:
            media_settings = {
                "hero_video_url": settings.hero_video_url,
                "hero_video_enabled": settings.hero_video_enabled,
            }

        video_details = _video_details(media_settings["hero_video_url"])
        media_settings.update(
            {
                "hero_video_type": video_details["type"] if video_details else "",
                "hero_video_embed_url": (
                    video_details["embed_url"] if video_details else ""
                ),
            }
        )

        existing_media = {
            media_key
            for (media_key,) in db.session.query(SiteMedia.media_key)
            .filter(SiteMedia.media_key.in_(MEDIA_KEYS))
            .all()
        }
        media_settings.update(
            {
                "logo_available": "logo" in existing_media,
                "hero_background_available": "hero-background" in existing_media,
            }
        )
        return media_settings

    def validate(payload):
        errors = {}

        for field, max_length in FIELD_LIMITS.items():
            value = payload.get(field)
            if not isinstance(value, str):
                errors[field] = "Skal være tekst"
                continue

            value = value.strip()
            if len(value) > max_length:
                errors[field] = f"Må højst være {max_length} tegn"

            if field != "announcement_text" and not value:
                errors[field] = "Må ikke være tom"

        if not isinstance(payload.get("announcement_visible"), bool):
            errors["announcement_visible"] = "Skal være true eller false"

        return errors

    def validate_video(payload):
        errors = {}
        video_url = payload.get("hero_video_url", "")
        video_enabled = payload.get("hero_video_enabled", False)

        if not isinstance(video_url, str):
            errors["hero_video_url"] = "Skal være tekst"
        elif len(video_url.strip()) > 1000:
            errors["hero_video_url"] = "Må højst være 1000 tegn"
        elif _video_details(video_url.strip()) is None:
            errors["hero_video_url"] = (
                "Skal være et direkte HTTP(S) MP4/WebM-link eller et Vimeo-link"
            )

        if not isinstance(video_enabled, bool):
            errors["hero_video_enabled"] = "Skal være true eller false"
        elif video_enabled and (
            not isinstance(video_url, str) or not video_url.strip()
        ):
            errors["hero_video_url"] = "Video-URL er påkrævet når video er slået til"

        return errors

    def get_or_create_settings():
        settings = db.session.get(SiteSettings, 1)
        if settings is None:
            settings = SiteSettings(
                id=1, **DEFAULT_SITE_SETTINGS, **DEFAULT_MEDIA_SETTINGS
            )
            db.session.add(settings)
        return settings

    def media_or_404(media_key):
        if media_key not in MEDIA_KEYS:
            return None, (jsonify({"message": "Ukendt medietype"}), 404)

        media = db.session.get(SiteMedia, media_key)
        if media is None:
            return None, (jsonify({"message": "Mediet findes ikke"}), 404)
        return media, None

    @app.route("/api/site-settings", methods=["GET"])
    def public_site_settings():
        settings = db.session.get(SiteSettings, 1)
        return (
            jsonify(
                {
                    "settings": serialize(settings),
                    "media": serialize_media_settings(settings),
                }
            ),
            200,
        )

    @app.route("/api/site-media/<media_key>", methods=["GET"])
    def public_site_media(media_key):
        media, error = media_or_404(media_key)
        if error:
            return error

        response = Response(media.data, mimetype=media.content_type)
        response.headers["Cache-Control"] = "no-cache"
        return response

    @app.route("/api/admin/site-settings", methods=["GET"])
    @admin_required
    def admin_get_site_settings(current_user):
        settings = db.session.get(SiteSettings, 1)
        return (
            jsonify(
                {
                    "settings": serialize(settings),
                    "media": serialize_media_settings(settings),
                }
            ),
            200,
        )

    @app.route("/api/admin/site-settings", methods=["PUT"])
    @admin_required
    def admin_update_site_settings(current_user):
        payload = request.get_json(silent=True) or {}
        errors = validate(payload)

        if errors:
            return (
                jsonify(
                    {
                        "message": "Ugyldige hjemmesideindstillinger",
                        "errors": errors,
                    }
                ),
                400,
            )

        settings = get_or_create_settings()
        for field in FIELD_LIMITS:
            setattr(settings, field, payload[field].strip())
        settings.announcement_visible = payload["announcement_visible"]
        db.session.commit()

        return jsonify({"settings": serialize(settings)}), 200

    @app.route("/api/admin/site-video", methods=["PUT"])
    @admin_required
    def admin_update_site_video(current_user):
        payload = request.get_json(silent=True) or {}
        errors = validate_video(payload)
        if errors:
            return (
                jsonify({"message": "Ugyldige videoindstillinger", "errors": errors}),
                400,
            )

        settings = get_or_create_settings()
        settings.hero_video_url = payload.get("hero_video_url", "").strip()
        settings.hero_video_enabled = payload.get("hero_video_enabled", False)
        db.session.commit()
        return jsonify({"media": serialize_media_settings(settings)}), 200

    @app.route("/api/admin/site-media/<media_key>", methods=["PUT"])
    @admin_required
    def admin_upload_site_media(current_user, media_key):
        if media_key not in MEDIA_KEYS:
            return jsonify({"message": "Ukendt medietype"}), 404

        uploaded = request.files.get("file")
        if uploaded is None or not uploaded.filename:
            return jsonify({"message": "Vælg en billedfil"}), 400

        data = uploaded.stream.read(MAX_MEDIA_BYTES + 1)
        if len(data) > MAX_MEDIA_BYTES:
            return jsonify({"message": "Billedet må højst fylde 5 MB"}), 413

        content_type = _detect_image_content_type(data)
        if content_type is None:
            return jsonify({"message": "Kun PNG, JPEG og WebP understøttes"}), 400

        media = db.session.get(SiteMedia, media_key)
        if media is None:
            media = SiteMedia(media_key=media_key)
            db.session.add(media)

        media.filename = secure_filename(uploaded.filename) or f"{media_key}.img"
        media.content_type = content_type
        media.data = data
        db.session.commit()

        return (
            jsonify(
                {
                    "media": {
                        "key": media.media_key,
                        "filename": media.filename,
                        "content_type": media.content_type,
                        "size": len(media.data),
                    }
                }
            ),
            200,
        )

    @app.route("/api/admin/site-media/<media_key>", methods=["DELETE"])
    @admin_required
    def admin_delete_site_media(current_user, media_key):
        if media_key not in MEDIA_KEYS:
            return jsonify({"message": "Ukendt medietype"}), 404

        media = db.session.get(SiteMedia, media_key)
        if media is not None:
            db.session.delete(media)
            db.session.commit()

        return "", 204

    return SiteSettings
