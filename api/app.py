from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Tillad API-requests fra hjemmesiden

app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://vennekredsen:hemmeligkode@db/vennekredsen_db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

class Ansoegning(db.Model):
    __tablename__ = "ansoegninger"
    id = db.Column(db.Integer, primary_key=True)
    navn = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    belob = db.Column(db.Float, nullable=False)
    beskrivelse = db.Column(db.Text, nullable=False)
    oprettet = db.Column(db.DateTime, default=datetime.utcnow)

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

@app.route("/api/ansoegninger", methods=["GET"])
def hent_ansoegninger():
    ansogninger = Ansoegning.query.all()
    return jsonify([
        {
            "id": ansogning.id,
            "navn": ansogning.navn,
            "email": ansogning.email,
            "belob": ansogning.belob,
            "beskrivelse": ansogning.beskrivelse,
            "oprettet": ansogning.oprettet.strftime("%Y-%m-%d %H:%M:%S") if ansogning.oprettet else None
        }
        for ansogning in ansogninger
    ])

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(host="0.0.0.0", port=5000)