"""API tests for public endpoints and MVP authentication."""

import hashlib

from app import User, app, db


def test_application_submission(client):
    response = client.post(
        "/api/ansoegning",
        json={
            "navn": "Test Person",
            "email": "test@example.com",
            "belob": 1000,
            "beskrivelse": "Test project",
        },
    )
    assert response.status_code == 201


def test_event_dates_endpoint(client):
    response = client.get("/api/events")
    assert response.status_code == 200
    payload = response.get_json()
    assert "events" in payload
    for event_key in ["sommerfest", "julefest", "fastelavn"]:
        assert event_key in payload["events"]


def test_admin_login_returns_token(client, admin_user):
    response = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "AdminPass123!"},
    )
    assert response.status_code == 200
    assert response.get_json()["token"]


def test_member_can_use_general_login(client, member_user):
    response = client.post(
        "/api/login",
        json={"username": "member", "password": "MemberPass123!"},
    )
    assert response.status_code == 200
    assert response.get_json()["user"]["role"] == "member"


def test_member_cannot_use_admin_login(client, member_user):
    response = client.post(
        "/api/admin/login",
        json={"username": "member", "password": "MemberPass123!"},
    )
    assert response.status_code == 401


def test_invalid_credentials_are_rejected(client, admin_user):
    response = client.post(
        "/api/login",
        json={"username": "admin", "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_inactive_user_cannot_login(client, inactive_user):
    response = client.post(
        "/api/login",
        json={"username": "inactive", "password": "InactivePass123!"},
    )
    assert response.status_code == 401


def test_member_cannot_access_admin_endpoint(client, member_headers):
    response = client.get("/api/admin/users", headers=member_headers)
    assert response.status_code == 403


def test_admin_can_access_admin_endpoint(client, admin_headers):
    response = client.get("/api/admin/users", headers=admin_headers)
    assert response.status_code == 200


def test_authenticated_user_can_read_me(client, member_headers):
    response = client.get("/api/me", headers=member_headers)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["username"] == "member"
    assert payload["role"] == "member"


def test_inactive_user_token_is_rejected(client, member_headers, member_user):
    with app.app_context():
        user = db.session.get(User, member_user)
        user.is_active = False
        db.session.commit()

    response = client.get("/api/me", headers=member_headers)
    assert response.status_code == 401


def test_admin_can_create_member(client, admin_headers):
    response = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={
            "username": "newmember",
            "email": "newmember@example.com",
            "password": "NewMemberPass123!",
            "role": "member",
        },
    )
    assert response.status_code == 201

    login_response = client.post(
        "/api/login",
        json={"username": "newmember", "password": "NewMemberPass123!"},
    )
    assert login_response.status_code == 200
    assert login_response.get_json()["user"]["role"] == "member"


def test_password_hash_is_argon2(client, admin_user):
    with app.app_context():
        user = db.session.get(User, admin_user)
        assert user.password_hash.startswith("$argon2")
        assert "AdminPass123!" not in user.password_hash


def test_legacy_sha256_is_rehashed_after_successful_login(client):
    with app.app_context():
        legacy = User(
            username="legacyadmin",
            email="legacy@example.com",
            role="admin",
            is_active=True,
            password_hash=hashlib.sha256(
                b"LegacyPass123!", usedforsecurity=False
            ).hexdigest(),
        )
        db.session.add(legacy)
        db.session.commit()
        legacy_id = legacy.id

    response = client.post(
        "/api/admin/login",
        json={"username": "legacyadmin", "password": "LegacyPass123!"},
    )
    assert response.status_code == 200

    with app.app_context():
        migrated = db.session.get(User, legacy_id)
        assert migrated.password_hash.startswith("$argon2")
        assert len(migrated.password_hash) > 64
