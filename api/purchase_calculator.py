"""Purchase Calculator 2.0 API backed by the shared Inventory catalog."""

import math
from datetime import datetime

from flask import jsonify, request
from sqlalchemy.exc import IntegrityError

PARTY_DEFINITIONS = (
    ("sommerfest", "Sommerfest"),
    ("julefest", "Julefest"),
    ("fastelavn", "Fastelavn"),
)

DISCRETE_UNITS = {
    "stk",
    "st",
    "pk",
    "pakke",
    "pakker",
    "pose",
    "poser",
    "flaske",
    "flasker",
    "dåse",
    "dåser",
    "bakke",
    "bakker",
}


def _parse_non_negative_number(value):
    if isinstance(value, bool):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(parsed) or parsed < 0:
        return None
    return parsed


def _parse_positive_number(value):
    parsed = _parse_non_negative_number(value)
    if parsed is None or parsed <= 0:
        return None
    return parsed


def _round_quantity(value, unit):
    normalized_unit = str(unit or "").strip().casefold()
    if normalized_unit in DISCRETE_UNITS:
        return float(math.ceil(value))
    return round(value + 1e-12, 2)


def register_purchase_calculator(app, db, token_required, InventoryItem):
    """Register persisted party configuration and calculation endpoints."""

    class PurchaseParty(db.Model):  # type: ignore
        __tablename__ = "purchase_parties"

        id = db.Column(db.Integer, primary_key=True)
        party_key = db.Column(db.String(50), unique=True, nullable=False)
        name = db.Column(db.String(100), nullable=False)
        created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
        updated_at = db.Column(
            db.DateTime,
            nullable=False,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
        )

        def to_dict(self):
            return {
                "id": self.id,
                "key": self.party_key,
                "name": self.name,
            }

    class PurchasePartyItem(db.Model):  # type: ignore
        __tablename__ = "purchase_party_items"
        __table_args__ = (
            db.UniqueConstraint(
                "party_id",
                "inventory_item_id",
                name="uq_purchase_party_inventory_item",
            ),
        )

        id = db.Column(db.Integer, primary_key=True)
        party_id = db.Column(
            db.Integer,
            db.ForeignKey("purchase_parties.id", ondelete="CASCADE"),
            nullable=False,
        )
        inventory_item_id = db.Column(
            db.Integer,
            db.ForeignKey("inventory_items.id", ondelete="CASCADE"),
            nullable=False,
        )
        per_adult_quantity = db.Column(db.Float, nullable=False, default=0.0)
        per_child_quantity = db.Column(db.Float, nullable=False, default=0.0)
        factor = db.Column(db.Float, nullable=False, default=1.0)
        active = db.Column(db.Boolean, nullable=False, default=True)
        created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
        updated_at = db.Column(
            db.DateTime,
            nullable=False,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
        )

    def ensure_default_parties():
        changed = False
        for party_key, name in PARTY_DEFINITIONS:
            party = PurchaseParty.query.filter_by(party_key=party_key).first()
            if party is None:
                db.session.add(PurchaseParty(party_key=party_key, name=name))
                changed = True
            elif party.name != name:
                party.name = name
                changed = True
        if changed:
            try:
                db.session.commit()
            except IntegrityError:
                db.session.rollback()

    def get_party_or_404(party_key):
        ensure_default_parties()
        party = PurchaseParty.query.filter_by(party_key=party_key).first()
        if party is None:
            return None, (jsonify({"message": "Festtype ikke fundet"}), 404)
        return party, None

    def serialize_relationship(relationship, inventory_item):
        return {
            "id": relationship.id,
            "inventory_item_id": inventory_item.id,
            "name": inventory_item.name,
            "category": inventory_item.category,
            "unit": inventory_item.unit,
            "default_store": inventory_item.default_store,
            "stock_quantity": inventory_item.stock_quantity,
            "inventory_active": inventory_item.active,
            "per_adult_quantity": relationship.per_adult_quantity,
            "per_child_quantity": relationship.per_child_quantity,
            "factor": relationship.factor,
            "active": relationship.active,
        }

    def parse_configuration_values(data, existing=None):
        per_adult_default = existing.per_adult_quantity if existing else 0
        per_child_default = existing.per_child_quantity if existing else 0
        factor_default = existing.factor if existing else 1

        per_adult = _parse_non_negative_number(
            data.get("per_adult_quantity", per_adult_default)
        )
        per_child = _parse_non_negative_number(
            data.get("per_child_quantity", per_child_default)
        )
        factor = _parse_positive_number(data.get("factor", factor_default))

        if per_adult is None:
            return None, "Pr. voksen skal være 0 eller højere"
        if per_child is None:
            return None, "Pr. barn skal være 0 eller højere"
        if factor is None:
            return None, "Faktor skal være større end 0"

        return (per_adult, per_child, factor), None

    @app.route("/api/purchase-calculator/parties", methods=["GET"])
    @token_required
    def purchase_list_parties(current_user):
        ensure_default_parties()
        parties = PurchaseParty.query.order_by(PurchaseParty.id).all()
        return jsonify({"parties": [party.to_dict() for party in parties]}), 200

    @app.route(
        "/api/purchase-calculator/parties/<string:party_key>",
        methods=["GET"],
    )
    @token_required
    def purchase_get_party(current_user, party_key):
        party, error = get_party_or_404(party_key)
        if error:
            return error

        rows = (
            db.session.query(PurchasePartyItem, InventoryItem)
            .join(
                InventoryItem,
                InventoryItem.id == PurchasePartyItem.inventory_item_id,
            )
            .filter(PurchasePartyItem.party_id == party.id)
            .order_by(InventoryItem.category, InventoryItem.name)
            .all()
        )
        return (
            jsonify(
                {
                    "party": party.to_dict(),
                    "items": [
                        serialize_relationship(relationship, item)
                        for relationship, item in rows
                    ],
                }
            ),
            200,
        )

    @app.route(
        "/api/purchase-calculator/parties/<string:party_key>/items",
        methods=["POST"],
    )
    @token_required
    def purchase_add_party_item(current_user, party_key):
        party, error = get_party_or_404(party_key)
        if error:
            return error

        data = request.get_json(silent=True) or {}
        inventory_item_id = data.get("inventory_item_id")
        if isinstance(inventory_item_id, bool):
            inventory_item_id = None
        try:
            inventory_item_id = int(inventory_item_id)
        except (TypeError, ValueError):
            return jsonify({"message": "Gyldigt inventory_item_id er påkrævet"}), 400

        inventory_item = db.session.get(InventoryItem, inventory_item_id)
        if inventory_item is None:
            return jsonify({"message": "Varen findes ikke i lageret"}), 404
        if not inventory_item.active:
            return jsonify({"message": "Arkiverede varer kan ikke tilføjes"}), 409

        values, validation_error = parse_configuration_values(data)
        if validation_error:
            return jsonify({"message": validation_error}), 400
        per_adult, per_child, factor = values

        relationship = PurchasePartyItem.query.filter_by(
            party_id=party.id,
            inventory_item_id=inventory_item.id,
        ).first()
        if relationship is not None:
            if relationship.active:
                return jsonify({"message": "Varen er allerede tilføjet til festtypen"}), 409
            relationship.per_adult_quantity = per_adult
            relationship.per_child_quantity = per_child
            relationship.factor = factor
            relationship.active = True
            db.session.commit()
            return (
                jsonify(
                    {
                        "item": serialize_relationship(
                            relationship,
                            inventory_item,
                        )
                    }
                ),
                200,
            )

        relationship = PurchasePartyItem(
            party_id=party.id,
            inventory_item_id=inventory_item.id,
            per_adult_quantity=per_adult,
            per_child_quantity=per_child,
            factor=factor,
            active=True,
        )
        db.session.add(relationship)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return jsonify({"message": "Varen er allerede tilføjet til festtypen"}), 409

        return (
            jsonify(
                {
                    "item": serialize_relationship(
                        relationship,
                        inventory_item,
                    )
                }
            ),
            201,
        )

    @app.route(
        "/api/purchase-calculator/parties/<string:party_key>/items/<int:item_id>",
        methods=["PATCH"],
    )
    @token_required
    def purchase_update_party_item(current_user, party_key, item_id):
        party, error = get_party_or_404(party_key)
        if error:
            return error

        relationship = PurchasePartyItem.query.filter_by(
            party_id=party.id,
            inventory_item_id=item_id,
        ).first()
        if relationship is None:
            return jsonify({"message": "Varen er ikke konfigureret for festtypen"}), 404

        inventory_item = db.session.get(InventoryItem, item_id)
        if inventory_item is None:
            return jsonify({"message": "Varen findes ikke i lageret"}), 404

        data = request.get_json(silent=True) or {}
        values, validation_error = parse_configuration_values(data, relationship)
        if validation_error:
            return jsonify({"message": validation_error}), 400
        per_adult, per_child, factor = values

        active = data.get("active", relationship.active)
        if not isinstance(active, bool):
            return jsonify({"message": "active skal være true eller false"}), 400
        if active and not inventory_item.active:
            return jsonify({"message": "En arkiveret lagervare kan ikke aktiveres"}), 409

        relationship.per_adult_quantity = per_adult
        relationship.per_child_quantity = per_child
        relationship.factor = factor
        relationship.active = active
        db.session.commit()
        return (
            jsonify(
                {
                    "item": serialize_relationship(
                        relationship,
                        inventory_item,
                    )
                }
            ),
            200,
        )

    @app.route(
        "/api/purchase-calculator/parties/<string:party_key>/items/<int:item_id>",
        methods=["DELETE"],
    )
    @token_required
    def purchase_remove_party_item(current_user, party_key, item_id):
        party, error = get_party_or_404(party_key)
        if error:
            return error

        relationship = PurchasePartyItem.query.filter_by(
            party_id=party.id,
            inventory_item_id=item_id,
        ).first()
        if relationship is None:
            return jsonify({"message": "Varen er ikke konfigureret for festtypen"}), 404

        inventory_item = db.session.get(InventoryItem, item_id)
        relationship.active = False
        db.session.commit()
        return (
            jsonify(
                {
                    "item": (
                        serialize_relationship(relationship, inventory_item)
                        if inventory_item is not None
                        else None
                    )
                }
            ),
            200,
        )

    @app.route("/api/purchase-calculator/calculate", methods=["POST"])
    @token_required
    def purchase_calculate(current_user):
        data = request.get_json(silent=True) or {}
        party_key = str(data.get("party_key", "")).strip()
        party, error = get_party_or_404(party_key)
        if error:
            return error

        adults = _parse_non_negative_number(data.get("adults"))
        children = _parse_non_negative_number(data.get("children"))
        subtract_stock = data.get("subtract_stock", False)

        if adults is None:
            return jsonify({"message": "Antal voksne skal være 0 eller højere"}), 400
        if children is None:
            return jsonify({"message": "Antal børn skal være 0 eller højere"}), 400
        if not isinstance(subtract_stock, bool):
            return jsonify({"message": "subtract_stock skal være true eller false"}), 400

        rows = (
            db.session.query(PurchasePartyItem, InventoryItem)
            .join(
                InventoryItem,
                InventoryItem.id == PurchasePartyItem.inventory_item_id,
            )
            .filter(
                PurchasePartyItem.party_id == party.id,
                PurchasePartyItem.active.is_(True),
                InventoryItem.active.is_(True),
            )
            .order_by(InventoryItem.category, InventoryItem.name)
            .all()
        )

        items = []
        for relationship, inventory_item in rows:
            raw_required = (
                (adults * relationship.per_adult_quantity)
                + (children * relationship.per_child_quantity)
            ) * relationship.factor
            required = _round_quantity(raw_required, inventory_item.unit)
            raw_purchase = (
                max(required - inventory_item.stock_quantity, 0)
                if subtract_stock
                else required
            )
            suggested_purchase = _round_quantity(
                raw_purchase,
                inventory_item.unit,
            )
            items.append(
                {
                    "inventory_item_id": inventory_item.id,
                    "name": inventory_item.name,
                    "category": inventory_item.category,
                    "unit": inventory_item.unit,
                    "default_store": inventory_item.default_store,
                    "stock_quantity": inventory_item.stock_quantity,
                    "per_adult_quantity": relationship.per_adult_quantity,
                    "per_child_quantity": relationship.per_child_quantity,
                    "factor": relationship.factor,
                    "required_quantity": required,
                    "suggested_purchase_quantity": suggested_purchase,
                }
            )

        return (
            jsonify(
                {
                    "party": party.to_dict(),
                    "adults": adults,
                    "children": children,
                    "subtract_stock": subtract_stock,
                    "items": items,
                }
            ),
            200,
        )

    return PurchaseParty, PurchasePartyItem
