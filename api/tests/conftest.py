"""Test configuration and fixtures."""

import os

# Set test environment before importing app
os.environ["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

import pytest

from app import app, db


@pytest.fixture
def client():
    """Create a test client."""
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.drop_all()


@pytest.fixture
def auth_headers():
    """Create authentication headers for admin tests."""
    # This would need to be implemented based on your JWT setup
    return {"Authorization": "Bearer test-token"}
