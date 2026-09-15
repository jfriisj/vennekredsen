"""Test configuration and fixtures."""

import os

os.environ["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret"

import pytest

from app import User, app, db


@pytest.fixture
def client():
    app.config["TESTING"] = True

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.session.remove()
            db.drop_all()


def _create_user(username, email, password, role="member", is_active=True):
    user = User(
        username=username,
        email=email,
        role=role,
        is_active=is_active,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def admin_user(client):
    with app.app_context():
        user = _create_user(
            "admin",
            "admin@example.com",
            "AdminPass123!",
            role="admin",
        )
        return user.id


@pytest.fixture
def member_user(client):
    with app.app_context():
        user = _create_user(
            "member",
            "member@example.com",
            "MemberPass123!",
            role="member",
        )
        return user.id


@pytest.fixture
def inactive_user(client):
    with app.app_context():
        user = _create_user(
            "inactive",
            "inactive@example.com",
            "InactivePass123!",
            role="member",
            is_active=False,
        )
        return user.id


@pytest.fixture
def admin_headers(client, admin_user):
    response = client.post(
        "/api/login",
        json={"username": "admin", "password": "AdminPass123!"},
    )
    token = response.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def member_headers(client, member_user):
    response = client.post(
        "/api/login",
        json={"username": "member", "password": "MemberPass123!"},
    )
    token = response.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}
