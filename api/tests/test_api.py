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


def test_event_dates_endpoint(client):
    """Test public event date configuration endpoint."""
    response = client.get("/api/events")
    assert response.status_code == 200

    payload = response.get_json()
    assert payload is not None
    assert "events" in payload

    for event_key in ["sommerfest", "julefest", "fastelavn"]:
        assert event_key in payload["events"]
