from datetime import datetime

from flask import jsonify, request

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

FIELD_LIMITS = {
    "hero_heading": 120,
    "hero_subheading": 500,
    "intro_text": 1000,
    "announcement_text": 500,
}


def register_site_settings(app, db, admin_required):
    class SiteSettings(db.Model):  # type: ignore
        __tablename__ = "site_settings"

        id = db.Column(db.Integer, primary_key=True)
        hero_heading = db.Column(db.String(120), nullable=False)
        hero_subheading = db.Column(db.String(500), nullable=False)
        intro_text = db.Column(db.String(1000), nullable=False)
        announcement_text = db.Column(db.String(500), nullable=False, default="")
        announcement_visible = db.Column(db.Boolean, nullable=False, default=False)
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

    @app.route("/api/site-settings", methods=["GET"])
    def public_site_settings():
        settings = db.session.get(SiteSettings, 1)
        return jsonify({"settings": serialize(settings)}), 200

    @app.route("/api/admin/site-settings", methods=["GET"])
    @admin_required
    def admin_get_site_settings(current_user):
        settings = db.session.get(SiteSettings, 1)
        return jsonify({"settings": serialize(settings)}), 200

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

        settings = db.session.get(SiteSettings, 1)
        if settings is None:
            settings = SiteSettings(id=1)
            db.session.add(settings)

        for field in FIELD_LIMITS:
            setattr(settings, field, payload[field].strip())

        settings.announcement_visible = payload["announcement_visible"]
        db.session.commit()

        return jsonify({"settings": serialize(settings)}), 200

    return SiteSettings
