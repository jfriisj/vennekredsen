#!/usr/bin/env python3
"""Upgrade an existing Vennekredsen database for member/admin roles.

This migration is intentionally small and idempotent. It keeps the historical
``admins`` table name to avoid a destructive table rename in the MVP.
"""

from sqlalchemy import inspect, text

from app import app, db


def migrate():
    with app.app_context():
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()
        if "admins" not in table_names:
            db.create_all()
            print("PASS: created fresh authentication schema")
            return

        columns = {column["name"] for column in inspector.get_columns("admins")}
        with db.engine.begin() as connection:
            if "role" not in columns:
                connection.execute(
                    text(
                        "ALTER TABLE admins ADD COLUMN role VARCHAR(20) "
                        "NOT NULL DEFAULT 'admin'"
                    )
                )
                print("PASS: added role column (existing users defaulted to admin)")
            else:
                print("PASS: role column already exists")

            if "is_active" not in columns:
                connection.execute(
                    text(
                        "ALTER TABLE admins ADD COLUMN is_active BOOLEAN "
                        "NOT NULL DEFAULT TRUE"
                    )
                )
                print("PASS: added is_active column")
            else:
                print("PASS: is_active column already exists")

        print(
            "PASS: schema migration complete. Legacy SHA-256 passwords are "
            "upgraded to Argon2id automatically on the next successful login."
        )


if __name__ == "__main__":
    migrate()
