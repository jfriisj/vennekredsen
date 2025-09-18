"""Basic API tests."""


def test_health_check(client):
    """Test basic application startup."""
    # This is a placeholder test
    assert True


def test_application_submission(client):
    """Test application submission endpoint."""
    data = {
        "navn": "Test Person",
        "email": "test@example.com",
        "belob": 1000,
        "beskrivelse": "Test project",
    }

    response = client.post("/api/ansoegning", json=data)
    assert response.status_code == 201
