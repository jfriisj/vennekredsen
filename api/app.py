import hashlib
import os
from datetime import datetime, timedelta
from functools import wraps

import jwt
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
CORS(app)  # Allow API requests from the website

# Get database connection details from environment variables
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


# Define models
class Ansoegning(db.Model):
    __tablename__ = "ansoegninger"
    id = db.Column(db.Integer, primary_key=True)
    navn = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    belob = db.Column(db.Float, nullable=False)
    beskrivelse = db.Column(db.Text, nullable=False)
    oprettet = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default="pending")  # pending, approved, rejected


class Admin(db.Model):
    __tablename__ = "admins"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

    def check_password(self, password):
        return self.password_hash == hashlib.sha256(password.encode()).hexdigest()


# Middleware for JWT authentication
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]  # Remove 'Bearer ' prefix

        if not token:
            return jsonify({"message": "Authentication token is missing!"}), 401

        try:
            data = jwt.decode(token, app.config["JWT_SECRET_KEY"], algorithms=["HS256"])
            current_user = Admin.query.filter_by(username=data["username"]).first()

            if current_user is None:
                return jsonify({"message": "User not found!"}), 401

        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token is expired!"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token!"}), 401

        return f(current_user, *args, **kwargs)

    return decorated


# Routes


# Application submission
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


# Admin login
@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"message": "Missing username or password"}), 400

    admin = Admin.query.filter_by(username=username).first()

    if not admin or not admin.check_password(password):
        return jsonify({"message": "Invalid credentials"}), 401

    # Generate token with expiration (24 hours)
    token = jwt.encode(
        {"username": admin.username, "exp": datetime.utcnow() + timedelta(hours=24)},
        app.config["JWT_SECRET_KEY"],
        algorithm="HS256",
    )

    return jsonify({"token": token}), 200


# Admin - Get all applications (includes personal info for admin only)
@app.route("/api/admin/ansoegninger", methods=["GET"])
@token_required
def admin_hent_ansoegninger(current_user):
    # IMPORTANT: This endpoint includes personal information (navn, email)
    # and is protected by JWT authentication - only for admin use
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


# Admin - Update application status
@app.route("/api/admin/ansoegning/<int:id>/status", methods=["PUT"])
@token_required
def admin_update_status(current_user, id):
    data = request.json
    status = data.get("status")

    if not status or status not in ["pending", "approved", "rejected"]:
        return jsonify({"message": "Invalid status value"}), 400

    ansogning = Ansoegning.query.get(id)

    if not ansogning:
        return jsonify({"message": "Application not found"}), 404

    ansogning.status = status
    db.session.commit()

    return jsonify({"message": f"Application {id} status updated to {status}"}), 200


# Admin - Delete rejected application
@app.route("/api/admin/ansoegning/<int:id>", methods=["DELETE"])
@token_required
def admin_delete_application(current_user, id):
    ansogning = Ansoegning.query.get(id)

    if not ansogning:
        return jsonify({"message": "Application not found"}), 404

    # Only allow deletion of rejected applications
    if ansogning.status != "rejected":
        return jsonify({"message": "Only rejected applications can be deleted"}), 400

    # Store application info for response before deletion
    application_info = {
        "id": ansogning.id,
        "navn": ansogning.navn,
        "status": ansogning.status,
    }

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


# Admin - Get all admin users
@app.route("/api/admin/users", methods=["GET"])
@token_required
def admin_get_users(current_user):
    users = Admin.query.all()
    return jsonify(
        [
            {
                "id": user.id,
                "username": user.username,
            }
            for user in users
        ]
    )


# Admin - Create new admin user
@app.route("/api/admin/users", methods=["POST"])
@token_required
def admin_create_user(current_user):
    data = request.json
    username = data.get("username", "").strip()
    password = data.get("password", "")

    # Validation
    if not username or len(username) < 3:
        return jsonify({"message": "Brugernavn skal være mindst 3 tegn langt"}), 400

    if not password or len(password) < 6:
        return jsonify({"message": "Adgangskode skal være mindst 6 tegn lang"}), 400

    # Check if username already exists
    existing_admin = Admin.query.filter_by(username=username).first()
    if existing_admin:
        return jsonify({"message": "Brugernavn er allerede i brug"}), 409

    # Create new admin
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    new_admin = Admin(username=username, password_hash=password_hash)

    try:
        db.session.add(new_admin)
        db.session.commit()
        return jsonify({"message": f"Admin bruger '{username}' er oprettet"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Fejl ved oprettelse af bruger"}), 500


# Admin - Delete admin user
@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
@token_required
def admin_delete_user(current_user, user_id):
    # Check if there are multiple admin users
    total_admins = Admin.query.count()
    if total_admins <= 1:
        return jsonify({"message": "Kan ikke slette den sidste admin bruger"}), 400

    # Prevent self-deletion
    if current_user.id == user_id:
        return jsonify({"message": "Du kan ikke slette din egen bruger"}), 400

    # Find and delete user
    user_to_delete = Admin.query.get(user_id)
    if not user_to_delete:
        return jsonify({"message": "Bruger ikke fundet"}), 404

    try:
        username = user_to_delete.username
        db.session.delete(user_to_delete)
        db.session.commit()
        return jsonify({"message": f"Admin bruger '{username}' er slettet"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Fejl ved sletning af bruger"}), 500


# Admin - Change password
@app.route("/api/admin/change-password", methods=["PUT"])
@token_required
def admin_change_password(current_user):
    data = request.json
    current_password = data.get("currentPassword", "")
    new_password = data.get("newPassword", "")

    # Validation
    if not current_password:
        return jsonify({"message": "Nuværende adgangskode er påkrævet"}), 400

    if not new_password or len(new_password) < 6:
        return jsonify({"message": "Ny adgangskode skal være mindst 6 tegn lang"}), 400

    # Verify current password
    if not current_user.check_password(current_password):
        return jsonify({"message": "Nuværende adgangskode er forkert"}), 401

    # Update password
    try:
        current_user.password_hash = hashlib.sha256(new_password.encode()).hexdigest()
        db.session.commit()
        return jsonify({"message": "Adgangskode er ændret"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Fejl ved ændring af adgangskode"}), 500


# Public - Get approved projects (no personal info)
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
    # Initialize database tables (no admin creation - handled in init.sql)
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000)  # nosec B104: Intended for Docker development
