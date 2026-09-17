from app import InventoryItem, app, db


def _create_item(client, headers, name="Pepsi Max"):
    response = client.post(
        "/api/inventory/items",
        headers=headers,
        json={
            "name": name,
            "category": "Drikkevarer",
            "unit": "kasser",
            "stock_quantity": 2,
        },
    )
    assert response.status_code == 201
    return response.get_json()["item"]


def test_active_inventory_item_cannot_be_deleted_permanently(client, member_headers):
    item = _create_item(client, member_headers)

    response = client.delete(
        f"/api/inventory/items/{item['id']}/permanent",
        headers=member_headers,
    )

    assert response.status_code == 409
    assert "arkiveres" in response.get_json()["message"]

    with app.app_context():
        assert db.session.get(InventoryItem, item["id"]) is not None


def test_archived_inventory_item_can_be_deleted_permanently(client, member_headers):
    item = _create_item(client, member_headers)

    archive_response = client.delete(
        f"/api/inventory/items/{item['id']}", headers=member_headers
    )
    assert archive_response.status_code == 200
    assert archive_response.get_json()["item"]["active"] is False

    delete_response = client.delete(
        f"/api/inventory/items/{item['id']}/permanent",
        headers=member_headers,
    )
    assert delete_response.status_code == 200
    assert "slettet permanent" in delete_response.get_json()["message"]

    with app.app_context():
        assert db.session.get(InventoryItem, item["id"]) is None

    recreate_response = client.post(
        "/api/inventory/items",
        headers=member_headers,
        json={
            "name": "Pepsi Max",
            "category": "Drikkevarer",
            "unit": "kasser",
        },
    )
    assert recreate_response.status_code == 201
