"""Backend coverage for Inventory-backed Purchase Calculator 2.0."""

from app import InventoryItem, app, db


def _create_inventory_item(client, headers, **overrides):
    payload = {
        "name": "Pepsi Max",
        "category": "Drikkevarer",
        "unit": "liter",
        "default_store": "Dagrofa",
        "stock_quantity": 2,
    }
    payload.update(overrides)
    response = client.post("/api/inventory/items", headers=headers, json=payload)
    assert response.status_code == 201
    return response.get_json()["item"]


def _add_party_item(
    client,
    headers,
    party_key,
    inventory_item_id,
    per_adult=1,
    per_child=0.5,
    factor=1,
):
    return client.post(
        f"/api/purchase-calculator/parties/{party_key}/items",
        headers=headers,
        json={
            "inventory_item_id": inventory_item_id,
            "per_adult_quantity": per_adult,
            "per_child_quantity": per_child,
            "factor": factor,
        },
    )


def test_purchase_calculator_requires_authentication(client):
    assert client.get("/api/purchase-calculator/parties").status_code == 401
    assert client.post("/api/purchase-calculator/calculate", json={}).status_code == 401


def test_three_default_parties_are_available(client, member_headers):
    response = client.get("/api/purchase-calculator/parties", headers=member_headers)

    assert response.status_code == 200
    parties = response.get_json()["parties"]
    assert [(party["key"], party["name"]) for party in parties] == [
        ("sommerfest", "Sommerfest"),
        ("julefest", "Julefest"),
        ("fastelavn", "Fastelavn"),
    ]


def test_same_inventory_item_can_have_different_party_values(
    client, member_headers
):
    item = _create_inventory_item(client, member_headers)

    summer = _add_party_item(
        client,
        member_headers,
        "sommerfest",
        item["id"],
        per_adult=1.25,
        per_child=0.5,
        factor=1,
    )
    christmas = _add_party_item(
        client,
        member_headers,
        "julefest",
        item["id"],
        per_adult=0.75,
        per_child=0.25,
        factor=1.1,
    )

    assert summer.status_code == 201
    assert christmas.status_code == 201

    summer_payload = client.get(
        "/api/purchase-calculator/parties/sommerfest",
        headers=member_headers,
    ).get_json()
    christmas_payload = client.get(
        "/api/purchase-calculator/parties/julefest",
        headers=member_headers,
    ).get_json()

    assert summer_payload["items"][0]["per_adult_quantity"] == 1.25
    assert christmas_payload["items"][0]["per_adult_quantity"] == 0.75
    assert christmas_payload["items"][0]["factor"] == 1.1


def test_duplicate_party_item_is_rejected_without_duplicate_row(
    client, member_headers
):
    item = _create_inventory_item(client, member_headers)
    first = _add_party_item(
        client, member_headers, "sommerfest", item["id"]
    )
    duplicate = _add_party_item(
        client, member_headers, "sommerfest", item["id"]
    )

    assert first.status_code == 201
    assert duplicate.status_code == 409

    payload = client.get(
        "/api/purchase-calculator/parties/sommerfest",
        headers=member_headers,
    ).get_json()
    assert len(payload["items"]) == 1


def test_calculation_subtracts_stock_without_mutating_inventory(
    client, member_headers
):
    item = _create_inventory_item(
        client,
        member_headers,
        stock_quantity=3,
        unit="liter",
    )
    configured = _add_party_item(
        client,
        member_headers,
        "sommerfest",
        item["id"],
        per_adult=1,
        per_child=0.5,
        factor=1.2,
    )
    assert configured.status_code == 201

    response = client.post(
        "/api/purchase-calculator/calculate",
        headers=member_headers,
        json={
            "party_key": "sommerfest",
            "adults": 10,
            "children": 4,
            "subtract_stock": True,
        },
    )

    assert response.status_code == 200
    calculated = response.get_json()["items"][0]
    assert calculated["required_quantity"] == 14.4
    assert calculated["suggested_purchase_quantity"] == 11.4

    with app.app_context():
        saved = db.session.get(InventoryItem, item["id"])
        assert saved.stock_quantity == 3


def test_discrete_units_round_up_and_purchase_never_becomes_negative(
    client, member_headers
):
    item = _create_inventory_item(
        client,
        member_headers,
        name="Pølser",
        category="Mad",
        unit="stk",
        stock_quantity=20,
    )
    _add_party_item(
        client,
        member_headers,
        "sommerfest",
        item["id"],
        per_adult=0.25,
        per_child=0.1,
        factor=1,
    )

    response = client.post(
        "/api/purchase-calculator/calculate",
        headers=member_headers,
        json={
            "party_key": "sommerfest",
            "adults": 3,
            "children": 1,
            "subtract_stock": True,
        },
    )

    assert response.status_code == 200
    calculated = response.get_json()["items"][0]
    assert calculated["required_quantity"] == 1
    assert calculated["suggested_purchase_quantity"] == 0


def test_invalid_configuration_and_calculation_inputs_are_rejected(
    client, member_headers
):
    item = _create_inventory_item(client, member_headers)

    invalid_config = _add_party_item(
        client,
        member_headers,
        "sommerfest",
        item["id"],
        per_adult=-1,
    )
    assert invalid_config.status_code == 400

    invalid_factor = _add_party_item(
        client,
        member_headers,
        "sommerfest",
        item["id"],
        factor=0,
    )
    assert invalid_factor.status_code == 400

    invalid_people = client.post(
        "/api/purchase-calculator/calculate",
        headers=member_headers,
        json={
            "party_key": "sommerfest",
            "adults": -1,
            "children": 0,
            "subtract_stock": False,
        },
    )
    assert invalid_people.status_code == 400


def test_archived_inventory_item_remains_visible_in_configuration_but_not_calculation(
    client, member_headers
):
    item = _create_inventory_item(client, member_headers)
    _add_party_item(
        client,
        member_headers,
        "sommerfest",
        item["id"],
    )

    archive = client.delete(
        f"/api/inventory/items/{item['id']}",
        headers=member_headers,
    )
    assert archive.status_code == 200

    configured = client.get(
        "/api/purchase-calculator/parties/sommerfest",
        headers=member_headers,
    )
    assert configured.status_code == 200
    assert configured.get_json()["items"][0]["inventory_active"] is False

    calculation = client.post(
        "/api/purchase-calculator/calculate",
        headers=member_headers,
        json={
            "party_key": "sommerfest",
            "adults": 10,
            "children": 5,
            "subtract_stock": False,
        },
    )
    assert calculation.status_code == 200
    assert calculation.get_json()["items"] == []
