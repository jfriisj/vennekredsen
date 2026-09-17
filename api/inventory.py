"""Inventory catalog and stock-counting API registration."""

from datetime import datetime

from flask import jsonify, request


def _normalize_item_name(value):
    return " ".join(str(value or "").strip().casefold().split())


def _parse_quantity(value):
    try:
        quantity = float(value)
    except (TypeError, ValueError):
        return None
    if quantity < 0:
        return None
    return quantity


def register_inventory(app, db, token_required):
    """Register the inventory model and authenticated API routes."""

    class InventoryItem(db.Model):  # type: ignore
        __tablename__ = "inventory_items"

        id = db.Column(db.Integer, primary_key=True)
        name = db.Column(db.String(160), nullable=False)
        normalized_name = db.Column(db.String(160), unique=True, nullable=False)
        category = db.Column(db.String(100), nullable=False)
        unit = db.Column(db.String(50), nullable=False)
        default_store = db.Column(db.String(120), nullable=False, default="")
        stock_quantity = db.Column(db.Float, nullable=False, default=0.0)
        note = db.Column(db.Text, nullable=False, default="")
        active = db.Column(db.Boolean, nullable=False, default=True)
        last_counted_at = db.Column(db.DateTime, nullable=True)
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
                "name": self.name,
                "category": self.category,
                "unit": self.unit,
                "default_store": self.default_store,
                "stock_quantity": self.stock_quantity,
                "note": self.note,
                "active": self.active,
                "last_counted_at": (
                    self.last_counted_at.isoformat(timespec="seconds")
                    if self.last_counted_at
                    else None
                ),
            }

    def item_or_404(item_id):
        item = db.session.get(InventoryItem, item_id)
        if item is None:
            return None, (jsonify({"message": "Vare ikke fundet"}), 404)
        return item, None

    @app.route("/api/inventory/items", methods=["GET"])
    @token_required
    def inventory_list_items(current_user):
        query = InventoryItem.query

        include_inactive = request.args.get("include_inactive") == "true"
        if not include_inactive:
            query = query.filter(InventoryItem.active.is_(True))

        search = request.args.get("q", "").strip()
        if search:
            query = query.filter(InventoryItem.name.ilike(f"%{search}%"))

        category = request.args.get("category", "").strip()
        if category:
            query = query.filter(InventoryItem.category == category)

        stock_filter = request.args.get("stock", "all")
        if stock_filter == "in_stock":
            query = query.filter(InventoryItem.stock_quantity > 0)
        elif stock_filter == "zero":
            query = query.filter(InventoryItem.stock_quantity == 0)
        elif stock_filter != "all":
            return jsonify({"message": "Ugyldigt lagerfilter"}), 400

        items = query.order_by(InventoryItem.category, InventoryItem.name).all()
        return jsonify({"items": [item.to_dict() for item in items]}), 200

    @app.route("/api/inventory/items", methods=["POST"])
    @token_required
    def inventory_create_item(current_user):
        data = request.json or {}
        name = str(data.get("name", "")).strip()
        category = str(data.get("category", "")).strip()
        unit = str(data.get("unit", "")).strip()
        default_store = str(data.get("default_store", "")).strip()
        note = str(data.get("note", "")).strip()
        quantity = _parse_quantity(data.get("stock_quantity", 0))

        if not name:
            return jsonify({"message": "Varenavn er påkrævet"}), 400
        if not category:
            return jsonify({"message": "Kategori er påkrævet"}), 400
        if not unit:
            return jsonify({"message": "Enhed er påkrævet"}), 400
        if quantity is None:
            return jsonify({"message": "Lagerantal skal være 0 eller højere"}), 400

        normalized_name = _normalize_item_name(name)
        if InventoryItem.query.filter_by(normalized_name=normalized_name).first():
            return jsonify({"message": "Varen findes allerede"}), 409

        item = InventoryItem(
            name=name,
            normalized_name=normalized_name,
            category=category,
            unit=unit,
            default_store=default_store,
            stock_quantity=quantity,
            note=note,
            active=True,
            last_counted_at=(datetime.utcnow() if "stock_quantity" in data else None),
        )
        db.session.add(item)
        db.session.commit()
        return jsonify({"item": item.to_dict()}), 201

    @app.route("/api/inventory/items/<int:item_id>", methods=["PUT"])
    @token_required
    def inventory_update_item(current_user, item_id):
        item, error = item_or_404(item_id)
        if error:
            return error

        data = request.json or {}
        name = str(data.get("name", item.name)).strip()
        category = str(data.get("category", item.category)).strip()
        unit = str(data.get("unit", item.unit)).strip()

        if not name or not category or not unit:
            return jsonify({"message": "Navn, kategori og enhed er påkrævet"}), 400

        normalized_name = _normalize_item_name(name)
        duplicate = InventoryItem.query.filter(
            InventoryItem.normalized_name == normalized_name,
            InventoryItem.id != item.id,
        ).first()
        if duplicate:
            return jsonify({"message": "Varen findes allerede"}), 409

        item.name = name
        item.normalized_name = normalized_name
        item.category = category
        item.unit = unit
        item.default_store = str(data.get("default_store", item.default_store)).strip()
        item.note = str(data.get("note", item.note)).strip()
        db.session.commit()
        return jsonify({"item": item.to_dict()}), 200

    @app.route("/api/inventory/items/<int:item_id>/stock", methods=["PATCH"])
    @token_required
    def inventory_update_stock(current_user, item_id):
        item, error = item_or_404(item_id)
        if error:
            return error

        data = request.json or {}
        quantity = _parse_quantity(data.get("stock_quantity"))
        if quantity is None:
            return jsonify({"message": "Lagerantal skal være 0 eller højere"}), 400

        item.stock_quantity = quantity
        item.last_counted_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"item": item.to_dict()}), 200

    @app.route("/api/inventory/items/<int:item_id>/active", methods=["PATCH"])
    @token_required
    def inventory_set_active(current_user, item_id):
        item, error = item_or_404(item_id)
        if error:
            return error

        data = request.json or {}
        active = data.get("active")
        if not isinstance(active, bool):
            return jsonify({"message": "active skal være true eller false"}), 400

        item.active = active
        db.session.commit()
        return jsonify({"item": item.to_dict()}), 200

    @app.route("/api/inventory/items/<int:item_id>", methods=["DELETE"])
    @token_required
    def inventory_archive_item(current_user, item_id):
        item, error = item_or_404(item_id)
        if error:
            return error

        item.active = False
        db.session.commit()
        return jsonify({"item": item.to_dict()}), 200

    @app.route("/api/inventory/items/<int:item_id>/permanent", methods=["DELETE"])
    @token_required
    def inventory_delete_item_permanently(current_user, item_id):
        item, error = item_or_404(item_id)
        if error:
            return error

        if item.active:
            return (
                jsonify(
                    {"message": "Aktive varer skal arkiveres før permanent sletning"}
                ),
                409,
            )

        deleted_name = item.name
        db.session.delete(item)
        db.session.commit()
        return jsonify({"message": f"{deleted_name} er slettet permanent"}), 200

    @app.route("/api/inventory/import", methods=["POST"])
    @token_required
    def inventory_import_items(current_user):
        data = request.json or {}
        incoming_items = data.get("items")
        if not isinstance(incoming_items, list):
            return jsonify({"message": "Import kræver en liste af varer"}), 400

        created = 0
        matched = 0
        invalid = 0

        existing = {item.normalized_name: item for item in InventoryItem.query.all()}

        for raw_item in incoming_items:
            if not isinstance(raw_item, dict):
                invalid += 1
                continue

            name = str(raw_item.get("name", "")).strip()
            normalized_name = _normalize_item_name(name)
            if not normalized_name:
                invalid += 1
                continue

            if normalized_name in existing:
                matched += 1
                continue

            item = InventoryItem(
                name=name,
                normalized_name=normalized_name,
                category=str(raw_item.get("category", "")).strip() or "Ukategoriseret",
                unit=str(raw_item.get("unit", "")).strip() or "stk",
                default_store=str(raw_item.get("default_store", "")).strip(),
                stock_quantity=0,
                note="",
                active=True,
                last_counted_at=None,
            )
            db.session.add(item)
            existing[normalized_name] = item
            created += 1

        db.session.commit()
        return (
            jsonify(
                {
                    "created": created,
                    "matched": matched,
                    "invalid": invalid,
                }
            ),
            200,
        )

    return InventoryItem