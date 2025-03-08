from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime, timedelta
import os
import jwt
from functools import wraps
import hashlib

app = Flask(__name__)
CORS(app)  # Allow API requests from the website

app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://vennekredsen:hemmeligkode@db/vennekredsen_db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET", "vennekredsen_meget_hemmelig_nogle")

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
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected

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
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]  # Remove 'Bearer ' prefix
        
        if not token:
            return jsonify({'message': 'Authentication token is missing!'}), 401
        
        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=["HS256"])
            current_user = Admin.query.filter_by(username=data['username']).first()
            
            if current_user is None:
                return jsonify({'message': 'User not found!'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token is expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token!'}), 401
            
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
        beskrivelse=data["beskrivelse"]
    )
    db.session.add(ansogning)
    db.session.commit()
    return jsonify({"message": "Ansøgning modtaget!"}), 201

# Admin login
@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'message': 'Missing username or password'}), 400
    
    admin = Admin.query.filter_by(username=username).first()
    
    if not admin or not admin.check_password(password):
        return jsonify({'message': 'Invalid credentials'}), 401
    
    # Generate token with expiration (24 hours)
    token = jwt.encode({
        'username': admin.username,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }, app.config['JWT_SECRET_KEY'], algorithm="HS256")
    
    return jsonify({'token': token}), 200

# Admin - Get all applications
@app.route("/api/admin/ansoegninger", methods=["GET"])
@token_required
def admin_hent_ansoegninger(current_user):
    ansogninger = Ansoegning.query.all()
    return jsonify([
        {
            "id": ansogning.id,
            "belob": ansogning.belob,
            "beskrivelse": ansogning.beskrivelse,
            "oprettet": ansogning.oprettet.strftime("%Y-%m-%d %H:%M:%S") if ansogning.oprettet else None,
            "status": ansogning.status
        }
        for ansogning in ansogninger
    ])

# Admin - Update application status
@app.route("/api/admin/ansoegning/<int:id>/status", methods=["PUT"])
@token_required
def admin_update_status(current_user, id):
    data = request.json
    status = data.get('status')
    
    if not status or status not in ['pending', 'approved', 'rejected']:
        return jsonify({'message': 'Invalid status value'}), 400
    
    ansogning = Ansoegning.query.get(id)
    
    if not ansogning:
        return jsonify({'message': 'Application not found'}), 404
    
    ansogning.status = status
    db.session.commit()
    
    return jsonify({'message': f'Application {id} status updated to {status}'}), 200


# Public - Get approved projects (no personal info)
@app.route("/api/approved-projects", methods=["GET"])
def get_approved_projects():
    approved = Ansoegning.query.filter_by(status="approved").all()
    return jsonify([
        {
            "id": application.id,
            "belob": application.belob,
            "beskrivelse": application.beskrivelse,
            "godkendt_dato": application.oprettet.strftime("%Y-%m-%d") if application.oprettet else None
        }
        for application in approved
    ])


if __name__ == "__main__":
    # Initialize database tables (no admin creation - handled in init.sql)
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000)