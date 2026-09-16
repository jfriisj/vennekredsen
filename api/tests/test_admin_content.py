"""Tests for MVP 5 user administration and editable homepage content."""

from app import Ansoegning, User, app, db


VALID_SETTINGS = {
    "hero_heading": "Sammen gør vi mere",
    "hero_subheading": "Vi skaber oplevelser og muligheder for børnene.",
    "intro_text": "Vennekredsen støtter fællesskab og deltagelse.",
    "announcement_text": "Tilmelding til sommerfest er åben.",
    "announcement_visible": True,
}


def test_public_site_settings_have_defaults_without_database_row(client):
    response = client.get("/api/site-settings")
    assert response.status_code == 200

    settings = response.get_json()["settings"]
    assert settings["hero_heading"] == "Vi gør gode idéer mulige."
    assert settings["announcement_text"] == ""
    assert settings["announcement_visible"] is False


def test_member_cannot_read_or_update_admin_site_settings(client, member_headers):
    read_response = client.get("/api/admin/site-settings", headers=member_headers)
    assert read_response.status_code == 403

    update_response = client.put(
        "/api/admin/site-settings",
        headers=member_headers,
        json=VALID_SETTINGS,
    )
    assert update_response.status_code == 403


def test_admin_can_update_site_settings_and_public_endpoint_reflects_them(
    client, admin_headers
):
    response = client.put(
        "/api/admin/site-settings",
        headers=admin_headers,
        json=VALID_SETTINGS,
    )
    assert response.status_code == 200
    assert response.get_json()["settings"] == VALID_SETTINGS

    public_response = client.get("/api/site-settings")
    assert public_response.status_code == 200
    assert public_response.get_json()["settings"] == VALID_SETTINGS


def test_announcement_can_be_hidden_without_losing_text(client, admin_headers):
    assert (
        client.put(
            "/api/admin/site-settings",
            headers=admin_headers,
            json=VALID_SETTINGS,
        ).status_code
        == 200
    )

    hidden_settings = dict(VALID_SETTINGS)
    hidden_settings["announcement_visible"] = False
    response = client.put(
        "/api/admin/site-settings",
        headers=admin_headers,
        json=hidden_settings,
    )

    assert response.status_code == 200
    settings = response.get_json()["settings"]
    assert settings["announcement_visible"] is False
    assert settings["announcement_text"] == VALID_SETTINGS["announcement_text"]


def test_site_settings_validate_types_required_values_and_lengths(
    client, admin_headers
):
    invalid = dict(VALID_SETTINGS)
    invalid["hero_heading"] = "x" * 121
    invalid["hero_subheading"] = ""
    invalid["announcement_visible"] = "yes"

    response = client.put(
        "/api/admin/site-settings",
        headers=admin_headers,
        json=invalid,
    )
    assert response.status_code == 400

    errors = response.get_json()["errors"]
    assert "hero_heading" in errors
    assert "hero_subheading" in errors
    assert "announcement_visible" in errors


def test_admin_user_list_does_not_expose_password_hash_or_secrets(
    client, admin_headers
):
    response = client.get("/api/admin/users", headers=admin_headers)
    assert response.status_code == 200

    user = response.get_json()[0]
    assert set(user) == {"id", "username", "email", "role", "is_active"}
    assert "password_hash" not in user
    assert "token" not in user


def test_admin_can_deactivate_and_reactivate_member(
    client, admin_headers, member_headers, member_user
):
    deactivate = client.patch(
        f"/api/admin/users/{member_user}",
        headers=admin_headers,
        json={"role": "member", "is_active": False},
    )
    assert deactivate.status_code == 200
    assert deactivate.get_json()["user"]["is_active"] is False

    existing_token_response = client.get("/api/me", headers=member_headers)
    assert existing_token_response.status_code == 401

    login_response = client.post(
        "/api/login",
        json={"username": "member", "password": "MemberPass123!"},
    )
    assert login_response.status_code == 401

    reactivate = client.patch(
        f"/api/admin/users/{member_user}",
        headers=admin_headers,
        json={"role": "member", "is_active": True},
    )
    assert reactivate.status_code == 200

    login_after_reactivation = client.post(
        "/api/login",
        json={"username": "member", "password": "MemberPass123!"},
    )
    assert login_after_reactivation.status_code == 200


def test_admin_can_change_member_role(client, admin_headers, member_user):
    response = client.patch(
        f"/api/admin/users/{member_user}",
        headers=admin_headers,
        json={"role": "admin", "is_active": True},
    )
    assert response.status_code == 200
    assert response.get_json()["user"]["role"] == "admin"

    login_response = client.post(
        "/api/admin/login",
        json={"username": "member", "password": "MemberPass123!"},
    )
    assert login_response.status_code == 200


def test_current_admin_cannot_deactivate_or_demote_self(
    client, admin_headers, admin_user
):
    deactivate = client.patch(
        f"/api/admin/users/{admin_user}",
        headers=admin_headers,
        json={"role": "admin", "is_active": False},
    )
    assert deactivate.status_code == 400

    demote = client.patch(
        f"/api/admin/users/{admin_user}",
        headers=admin_headers,
        json={"role": "member", "is_active": True},
    )
    assert demote.status_code == 400


def test_last_active_admin_cannot_be_removed_by_another_admin(client):
    with app.app_context():
        primary = User(
            username="primary",
            email="primary@example.com",
            role="admin",
            is_active=True,
        )
        primary.set_password("PrimaryPass123!")
        second = User(
            username="second",
            email="second@example.com",
            role="admin",
            is_active=True,
        )
        second.set_password("SecondPass123!")
        db.session.add_all([primary, second])
        db.session.commit()
        primary_id = primary.id
        second_id = second.id

    login = client.post(
        "/api/login",
        json={"username": "primary", "password": "PrimaryPass123!"},
    )
    headers = {"Authorization": f"Bearer {login.get_json()['token']}"}

    deactivate_second = client.patch(
        f"/api/admin/users/{second_id}",
        headers=headers,
        json={"role": "admin", "is_active": False},
    )
    assert deactivate_second.status_code == 200

    with app.app_context():
        primary = db.session.get(User, primary_id)
        assert primary.is_active is True

    self_deactivate = client.patch(
        f"/api/admin/users/{primary_id}",
        headers=headers,
        json={"role": "admin", "is_active": False},
    )
    assert self_deactivate.status_code == 400


def test_public_approved_projects_expose_only_public_fields(client):
    with app.app_context():
        application = Ansoegning(
            navn="Privat Ansøger",
            email="private@example.com",
            belob=2500,
            beskrivelse="Nye materialer til fælles aktivitet",
            status="approved",
        )
        db.session.add(application)
        db.session.commit()

    response = client.get("/api/approved-projects")
    assert response.status_code == 200

    project = response.get_json()[0]
    assert set(project) == {"id", "belob", "beskrivelse", "godkendt_dato"}
    assert "navn" not in project
    assert "email" not in project
    assert "status" not in project
