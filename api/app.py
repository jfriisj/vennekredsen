import hashlib
import hmac
import os
from datetime import datetime, timedelta
from functools import wraps

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

from inventory import register_inventory
from site_settings import register_site_settings

app = Flask(__name__)
CORS(app)

# Allow full DB URI override for tests and non-standard deployments.
database_uri_override = os.environ.get("SQLALCHEMY_DATABASE_URI")
if database_uri_override:
    app.config["SQLALCHEMY_DATABASE_URI"] = database_uri_override
else:
    db_user = os.environ.get("POSTGRES_USER", "postgres")
    db_password = os.environ.get("POSTGRES_PASSWORD", "password")
    db_name = os.environ.get("POSTGRES_DB", "postgres")
    db_host = os.environ.get("DB_HOST", "db")
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        f"postgresql://{db_user}:{db_password}@{db_host}/{db_name}"
    )
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET", "secret_key")

db = SQLAlchemy(app)
password_hasher = PasswordHasher()

VALID_ROLES = {"member", "admin"}

DEFAULT_EVENT_DATES = {
    "sommerfest": datetime(2026, 9, 18, 18, 0),
    "julefest": datetime(2026, 11, 27, 17, 30),
    "fastelavn": datetime(2027, 2, 5, 17, 30),
}


class Ansoegning(db.Model):  # type: ignore
    __tablename__ = "ansoegninger"
    id = db.Column(db.Integer, primary_key=True)
    navn = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    belob = db.Column(db.Float, nullable=False)
    beskrivelse = db.Column(db.Text, nullable=False)
    oprettet = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default="pending")


class User(db.Model):  # type: ignore
    """Authenticated Vennekredsen user.

    The physical table remains named ``admins`` for this MVP so existing
    self-hosted installations can be upgraded without a destructive rename.
    """

    __tablename__ = "admins"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="member")
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    def set_password(self, password: str) -> None:
        """Store a password using Argon2id."""
        self.password_hash = password_hasher.hash(password)

    def check_password(self, password: str) -> bool:
        """Verify password and transparently upgrade a legacy SHA-256 hash.

        Legacy SHA-256 verification exists only as a one-time migration path.
        Any successful legacy login immediately replaces the stored value with
        an Argon2id hash.
        """
        if self.password_hash.startswith("$argon2"):
            try:
                valid = password_hasher.verify(self.password_hash, password)
                if valid and password_hasher.check_needs_rehash(self.password_hash):
                    self.set_password(password)
                return valid
            except (VerifyMismatchError, InvalidHashError):
                return False

        if len(self.password_hash) == 64:
            legacy_hash = hashlib.sha256(
                password.encode(), usedforsecurity=False
            ).hexdigest()
            if hmac.compare_digest(self.password_hash, legacy_hash):
                self.set_password(password)
                return True

        return False


# Backwards-compatible import name while callers are migrated to User.
Admin = User


class EventDate(db.Model):  # type: ignore
    __tablename__ = "event_dates"
    event_key = db.Column(db.String(50), primary_key=True)
    event_datetime = db.Column(db.DateTime, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


def _get_bearer_token():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _get_bearer_token()
        if not token:
            return jsonify({"message": "Authentication token is missing!"}), 401

        try:
            data = jwt.decode(token, app.config["JWT_SECRET_KEY"], algorithms=["HS256"])
            current_user = User.query.filter_by(id=data.get("user_id")).first()
            if current_user is None:
                return jsonify({"message": "User not found!"}), 401
            if not current_user.is_active:
                return jsonify({"message": "User is inactive!"}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token is expired!"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token!"}), 401

        return f(current_user, *args, **kwargs)

    return decorated


def admin_required(f):
    @wraps(f)
    @token_required
    def decorated(current_user, *args, **kwargs):
        if current_user.role != "admin":
            return jsonify({"message": "Admin access required!"}), 403
        return f(current_user, *args, **kwargs)

    return decorated


InventoryItem = register_inventory(app, db, token_required)
SiteSettings = register_site_settings(app, db, admin_required)


def _format_event_dates_payload():
    saved_dates = {
        event.event_key: event.event_datetime
        for event in EventDate.query.filter(
            EventDate.event_key.in_(list(DEFAULT_EVENT_DATES.keys()))
        ).all()
    }

    return {
        event_key: saved_dates.get(event_key, default_date).isoformat(
            timespec="seconds"
        )
        for event_key, default_date in DEFAULT_EVENT_DATES.items()
    }


def _parse_event_datetime(raw_value):
    if not isinstance(raw_value, str) or not raw_value.strip():
        return None

    try:
        parsed_datetime = datetime.fromisoformat(raw_value)
    except ValueError:
        return None

    if parsed_datetime.tzinfo is not None:
        parsed_datetime = parsed_datetime.astimezone().replace(tzinfo=None)

    return parsed_datetime.replace(second=0, microsecond=0)


def _issue_token(user):
    return jwt.encode(
        {
            "user_id": user.id,
            "role": user.role,
            "exp": datetime.utcnow() + timedelta(hours=24),
        },
        app.config["JWT_SECRET_KEY"],
        algorithm="HS256",
    )


def _authenticate_credentials(username, password):
    user = User.query.filter_by(username=username).first()
    if not user or not user.is_active or not user.check_password(password):
        return None

    # Persist an automatic Argon2 rehash after successful legacy login or when
    # Argon2 parameters are upgraded.
    if db.session.is_modified(user):
        db.session.commit()
    return user


def _active_admin_count(exclude_user_id=None):
    query = User.query.filter(User.role == "admin", User.is_active.is_(True))
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    return query.count()


@app.route("/api/ansoegning", methods=["POST"])
def modtag_ansoegning():
    data = request.json
    ansogning = Ansoegning(
        navn=data["navn"],
        email=data["email"],
        belob=data["belob"],
        beskrivelse=data["beskrivelse"],
    )
    db.session.add(ansogning)
    db.session.commit()
    return jsonify({"message": "Ansøgning modtaget!"}), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.json or {}
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"message": "Missing username or password"}), 400

    user = _authenticate_credentials(username, password)
    if user is None:
        return jsonify({"message": "Invalid credentials"}), 401

    return (
        jsonify(
            {
                "token": _issue_token(user),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "role": user.role,
                },
            }
        ),
        200,
    )


# Backwards-compatible admin login used by the legacy admin frontend.
@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.json or {}
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        return jsonify({"message": "Missing username or password"}), 400

    user = _authenticate_credentials(username, password)
    if user is None or user.role != "admin":
        return jsonify({"message": "Invalid credentials"}), 401

    return jsonify({"token": _issue_token(user)}), 200


@app.route("/api/me", methods=["GET"])
@token_required
def current_user(current_user):
    return (
        jsonify(
            {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "role": current_user.role,
            }
        ),
        200,
    )


@app.route("/api/member/resources", methods=["GET"])
@token_required
def member_resources(current_user):
    resources = [
        {
            "id": "purchase-calculator",
            "title": "Indkøbsberegner",
            "description": "Beregn indkøb dynamisk ud fra deltagere, lager og festtype.",
            "href": "purchase-calculator.html",
            "available": True,
        },
        {
            "id": "inventory",
            "title": "Lager",
            "description": "Administrér varekatalog og optæl lager efter arrangementer.",
            "href": "inventory.html",
            "available": True,
        },
        {
            "id": "applications",
            "title": "Ansøgninger",
            "description": "Behandl ansøgninger og administrér støttede projekter.",
            "href": "member.html#applications",
            "available": True,
        },
        {
            "id": "events",
            "title": "Arrangementer",
            "description": "Opdater datoer for Vennekredsens arrangementer.",
            "href": "member.html#events",
            "available": True,
        },
    ]

    if current_user.role == "admin":
        resources.extend(
            [
                {
                    "id": "users",
                    "title": "Brugere",
                    "description": "Administrér brugere, roller og aktiv status.",
                    "href": "member.html#users",
                    "available": True,
                },
                {
                    "id": "website",
                    "title": "Hjemmeside",
                    "description": "Redigér de centrale tekster på forsiden.",
                    "href": "member.html#website",
                    "available": True,
                },
            ]
        )

    return jsonify({"resources": resources}), 200


@app.route("/api/member/applications", methods=["GET"])
@app.route("/api/admin/ansoegninger", methods=["GET"])
@token_required
def member_get_applications(current_user):
    ansogninger = Ansoegning.query.all()
    return jsonify(
        [
            {
                "id": ansogning.id,
                "navn": ansogning.navn,
                "email": ansogning.email,
                "belob": ansogning.belob,
                "beskrivelse": ansogning.beskrivelse,
                "oprettet": (
                    ansogning.oprettet.strftime("%Y-%m-%d %H:%M:%S")
                    if ansogning.oprettet
                    else None
                ),
                "status": ansogning.status,
            }
            for ansogning in ansogninger
        ]
    )


@app.route("/api/member/applications/<int:id>/status", methods=["PUT"])
@app.route("/api/admin/ansoegning/<int:id>/status", methods=["PUT"])
@token_required
def member_update_application_status(current_user, id):
    data = request.json or {}
    status = data.get("status")
    if not status or status not in ["pending", "approved", "rejected"]:
        return jsonify({"message": "Invalid status value"}), 400

    ansogning = Ansoegning.query.get(id)
    if not ansogning:
        return jsonify({"message": "Application not found"}), 404

    ansogning.status = status
    db.session.commit()
    return jsonify({"message": f"Application {id} status updated to {status}"}), 200


@app.route("/api/member/applications/<int:id>", methods=["DELETE"])
@app.route("/api/admin/ansoegning/<int:id>", methods=["DELETE"])
@token_required
def member_delete_application(current_user, id):
    ansogning = Ansoegning.query.get(id)
    if not ansogning:
        return jsonify({"message": "Application not found"}), 404
    if ansogning.status != "rejected":
        return jsonify({"message": "Only rejected applications can be deleted"}), 400

    application_info = {"id": ansogning.id, "navn": ansogning.navn}
    db.session.delete(ansogning)
    db.session.commit()
    return (
        jsonify(
            {
                "message": f"Rejected application {id} ({application_info['navn']}) has been deleted successfully"
            }
        ),
        200,
    )


@app.route("/api/admin/users", methods=["GET"])
@admin_required
def admin_get_users(current_user):
    users = User.query.order_by(User.username).all()
    return jsonify(
        [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
            }
            for user in users
        ]
    )


@app.route("/api/admin/users", methods=["POST"])
@admin_required
def admin_create_user(current_user):
    data = request.json or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    role = data.get("role", "admin")

    if not username or len(username) < 3:
        return jsonify({"message": "Brugernavn skal være mindst 3 tegn langt"}), 400
    if not email or "@" not in email:
        return jsonify({"message": "Gyldig email er påkrævet"}), 400
    if not password or len(password) < 8:
        return jsonify({"message": "Adgangskode skal være mindst 8 tegn lang"}), 400
    if role not in VALID_ROLES:
        return jsonify({"message": "Ugyldig brugerrolle"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"message": "Brugernavn er allerede i brug"}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email er allerede i brug"}), 409

    new_user = User(username=username, email=email, role=role, is_active=True)
    new_user.set_password(password)

    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": f"Bruger '{username}' er oprettet"}), 201
    except Exception:
        db.session.rollback()
        return jsonify({"message": "Fejl ved oprettelse af bruger"}), 500


@app.route("/api/admin/users/<int:user_id>", methods=["PATCH"])
@admin_required
def admin_update_user(current_user, user_id):
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify({"message": "Bruger ikke fundet"}), 404

    data = request.get_json(silent=True) or {}
    requested_role = data.get("role", user.role)
    requested_active = data.get("is_active", user.is_active)

    if requested_role not in VALID_ROLES:
        return jsonify({"message": "Ugyldig brugerrolle"}), 400
    if not isinstance(requested_active, bool):
        return jsonify({"message": "is_active skal være true eller false"}), 400

    if user.id == current_user.id and (
        requested_role != "admin" or requested_active is False
    ):
        return (
            jsonify(
                {
                    "message": (
                        "Du kan ikke deaktivere eller fjerne admin-rollen fra "
                        "din egen bruger"
                    )
                }
            ),
            400,
        )

    removes_active_admin = (
        user.role == "admin"
        and user.is_active
        and (requested_role != "admin" or requested_active is False)
    )
    if removes_active_admin and _active_admin_count(exclude_user_id=user.id) == 0:
        return jsonify({"message": "Systemet skal have mindst én aktiv admin"}), 400

    user.role = requested_role
    user.is_active = requested_active
    db.session.commit()

    return (
        jsonify(
            {
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "is_active": user.is_active,
                }
            }
        ),
        200,
    )


@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
@admin_required
def admin_delete_user(current_user, user_id):
    if current_user.id == user_id:
        return jsonify({"message": "Du kan ikke slette din egen bruger"}), 400

    user_to_delete = User.query.get(user_id)
    if not user_to_delete:
        return jsonify({"message": "Bruger ikke fundet"}), 404

    if user_to_delete.role == "admin" and user_to_delete.is_active:
        if _active_admin_count(exclude_user_id=user_id) == 0:
            return (
                jsonify({"message": "Kan ikke slette den sidste aktive admin bruger"}),
                400,
            )

    try:
        username = user_to_delete.username
        db.session.delete(user_to_delete)
        db.session.commit()
        return jsonify({"message": f"Bruger '{username}' er slettet"}), 200
    except Exception:
        db.session.rollback()
        return jsonify({"message": "Fejl ved sletning af bruger"}), 500


@app.route("/api/admin/change-password", methods=["PUT"])
@admin_required
def admin_change_password(current_user):
    data = request.json or {}
    current_password = data.get("currentPassword", "")
    new_password = data.get("newPassword", "")
    if not current_password:
        return jsonify({"message": "Nuværende adgangskode er påkrævet"}), 400
    if not new_password or len(new_password) < 8:
        return jsonify({"message": "Ny adgangskode skal være mindst 8 tegn lang"}), 400
    if not current_user.check_password(current_password):
        return jsonify({"message": "Nuværende adgangskode er forkert"}), 401

    try:
        current_user.set_password(new_password)
        db.session.commit()
        return jsonify({"message": "Adgangskode er ændret"}), 200
    except Exception:
        db.session.rollback()
        return jsonify({"message": "Fejl ved ændring af adgangskode"}), 500


@app.route("/api/events", methods=["GET"])
def get_event_dates():
    return jsonify({"events": _format_event_dates_payload()}), 200


@app.route("/api/member/events", methods=["GET"])
@app.route("/api/admin/events", methods=["GET"])
@token_required
def member_get_event_dates(current_user):
    return jsonify({"events": _format_event_dates_payload()}), 200


@app.route("/api/member/events", methods=["PUT"])
@app.route("/api/admin/events", methods=["PUT"])
@token_required
def member_update_event_dates(current_user):
    data = request.json
    if not isinstance(data, dict):
        return jsonify({"message": "Invalid payload"}), 400

    updates = {}
    for event_key in DEFAULT_EVENT_DATES:
        raw_value = data.get(event_key)
        if raw_value is None:
            continue
        parsed_datetime = _parse_event_datetime(raw_value)
        if parsed_datetime is None:
            return jsonify({"message": f"Invalid datetime for '{event_key}'"}), 400
        updates[event_key] = parsed_datetime

    if not updates:
        return jsonify({"message": "No event dates provided"}), 400

    try:
        for event_key, event_datetime in updates.items():
            event_date = EventDate.query.filter_by(event_key=event_key).first()
            if event_date is None:
                db.session.add(
                    EventDate(event_key=event_key, event_datetime=event_datetime)
                )
            else:
                event_date.event_datetime = event_datetime

        db.session.commit()
        return (
            jsonify(
                {
                    "message": "Event dates updated",
                    "events": _format_event_dates_payload(),
                }
            ),
            200,
        )
    except Exception:
        db.session.rollback()
        return jsonify({"message": "Failed to update event dates"}), 500


@app.route("/api/approved-projects", methods=["GET"])
def get_approved_projects():
    approved = Ansoegning.query.filter_by(status="approved").all()
    return jsonify(
        [
            {
                "id": application.id,
                "belob": application.belob,
                "beskrivelse": application.beskrivelse,
                "godkendt_dato": (
                    application.oprettet.strftime("%Y-%m-%d")
                    if application.oprettet
                    else None
                ),
            }
            for application in approved
        ]
    )


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000)  # nosec B104: Intended for Docker development
