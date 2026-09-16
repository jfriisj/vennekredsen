"""API tests for public endpoints and MVP authentication."""

import hashlib

from app import InventoryItem, User, app, db


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


def test_member_resources_require_authentication(client):
    response = client.get("/api/member/resources")
    assert response.status_code == 401


def test_member_can_access_member_resources(client, member_headers):
    response = client.get("/api/member/resources", headers=member_headers)
    assert response.status_code == 200

    payload = response.get_json()
    resources = {resource["id"]: resource for resource in payload["resources"]}

    calculator = resources["purchase-calculator"]
    assert calculator["title"] == "Indkøbsberegner"
    assert calculator["href"] == "purchase-calculator.html"
    assert calculator["available"] is True

    inventory = resources["inventory"]
    assert inventory["title"] == "Lager"
    assert inventory["href"] == "inventory.html"
    assert inventory["available"] is True


def test_admin_can_access_member_resources(client, admin_headers):
    response = client.get("/api/member/resources", headers=admin_headers)
    assert response.status_code == 200


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


def test_inventory_requires_authentication(client):
    response = client.get("/api/inventory/items")
    assert response.status_code == 401


def test_member_can_create_edit_count_and_archive_inventory_item(
    client, member_headers
):
    create_response = client.post(
        "/api/inventory/items",
        headers=member_headers,
        json={
            "name": "Pepsi Max",
            "category": "Drikkevarer",
            "unit": "kasser",
            "default_store": "Dagrofa",
            "stock_quantity": 2,
            "note": "Testvare",
        },
    )
    assert create_response.status_code == 201
    item = create_response.get_json()["item"]
    assert item["stock_quantity"] == 2
    assert item["last_counted_at"] is not None

    list_response = client.get("/api/inventory/items", headers=member_headers)
    assert list_response.status_code == 200
    assert [entry["name"] for entry in list_response.get_json()["items"]] == [
        "Pepsi Max"
    ]

    edit_response = client.put(
        f"/api/inventory/items/{item['id']}",
        headers=member_headers,
        json={
            "name": "Pepsi Max",
            "category": "Sodavand",
            "unit": "kasser",
            "default_store": "Dagrofa",
            "note": "Opdateret",
        },
    )
    assert edit_response.status_code == 200
    assert edit_response.get_json()["item"]["category"] == "Sodavand"

    count_response = client.patch(
        f"/api/inventory/items/{item['id']}/stock",
        headers=member_headers,
        json={"stock_quantity": 5},
    )
    assert count_response.status_code == 200
    assert count_response.get_json()["item"]["stock_quantity"] == 5

    archive_response = client.delete(
        f"/api/inventory/items/{item['id']}", headers=member_headers
    )
    assert archive_response.status_code == 200
    assert archive_response.get_json()["item"]["active"] is False

    active_items = client.get("/api/inventory/items", headers=member_headers)
    assert active_items.get_json()["items"] == []

    all_items = client.get(
        "/api/inventory/items?include_inactive=true", headers=member_headers
    )
    assert len(all_items.get_json()["items"]) == 1


def test_inventory_rejects_duplicate_normalized_names(client, member_headers):
    first = {
        "name": "Pepsi Max",
        "category": "Drikkevarer",
        "unit": "kasser",
    }
    assert (
        client.post("/api/inventory/items", headers=member_headers, json=first).status_code
        == 201
    )

    duplicate = dict(first)
    duplicate["name"] = "  pepsi   max  "
    response = client.post(
        "/api/inventory/items", headers=member_headers, json=duplicate
    )
    assert response.status_code == 409


def test_inventory_filters_stock_and_category(client, member_headers):
    items = [
        {
            "name": "Pepsi Max",
            "category": "Drikkevarer",
            "unit": "kasser",
            "stock_quantity": 2,
        },
        {
            "name": "Popcorn",
            "category": "Snacks",
            "unit": "poser",
            "stock_quantity": 0,
        },
    ]
    for item in items:
        response = client.post(
            "/api/inventory/items", headers=member_headers, json=item
        )
        assert response.status_code == 201

    in_stock = client.get(
        "/api/inventory/items?stock=in_stock", headers=member_headers
    ).get_json()["items"]
    assert [item["name"] for item in in_stock] == ["Pepsi Max"]

    zero_stock = client.get(
        "/api/inventory/items?stock=zero", headers=member_headers
    ).get_json()["items"]
    assert [item["name"] for item in zero_stock] == ["Popcorn"]

    snacks = client.get(
        "/api/inventory/items?category=Snacks", headers=member_headers
    ).get_json()["items"]
    assert [item["name"] for item in snacks] == ["Popcorn"]


def test_inventory_import_creates_missing_items_without_overwriting_stock(
    client, member_headers
):
    existing_response = client.post(
        "/api/inventory/items",
        headers=member_headers,
        json={
            "name": "Pepsi Max",
            "category": "Drikkevarer",
            "unit": "kasser",
            "stock_quantity": 4,
        },
    )
    assert existing_response.status_code == 201
    existing_id = existing_response.get_json()["item"]["id"]

    response = client.post(
        "/api/inventory/import",
        headers=member_headers,
        json={
            "items": [
                {
                    "name": " pepsi max ",
                    "category": "Sodavand",
                    "unit": "kasser",
                    "default_store": "Ny butik",
                },
                {
                    "name": "Popcorn",
                    "category": "Snacks",
                    "unit": "poser",
                    "default_store": "Dagrofa",
                },
                {"name": ""},
            ]
        },
    )
    assert response.status_code == 200
    assert response.get_json() == {"created": 1, "matched": 1, "invalid": 1}

    with app.app_context():
        existing = db.session.get(InventoryItem, existing_id)
        assert existing.stock_quantity == 4
        assert existing.category == "Drikkevarer"

        imported = InventoryItem.query.filter_by(normalized_name="popcorn").first()
        assert imported is not None
        assert imported.stock_quantity == 0
        assert imported.last_counted_at is None


def test_admin_can_use_inventory(client, admin_headers):
    response = client.get("/api/inventory/items", headers=admin_headers)
    assert response.status_code == 200
