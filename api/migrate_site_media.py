#!/usr/bin/env python3
"""Upgrade existing databases for editable homepage media settings."""

from sqlalchemy import inspect, text

from app import app, db


def migrate_engine(engine):
    inspector = inspect(engine)
    if "site_settings" not in inspector.get_table_names():
        print("PASS: site_settings table not present; fresh schema will be created")
        return

    columns = {column["name"] for column in inspector.get_columns("site_settings")}
    with engine.begin() as connection:
        if "hero_video_url" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE site_settings ADD COLUMN hero_video_url "
                    "VARCHAR(1000) NOT NULL DEFAULT ''"
                )
            )
            print("PASS: added hero_video_url column")
        else:
            print("PASS: hero_video_url column already exists")

        if "hero_video_enabled" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE site_settings ADD COLUMN hero_video_enabled "
                    "BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
            print("PASS: added hero_video_enabled column")
        else:
            print("PASS: hero_video_enabled column already exists")


def migrate():
    with app.app_context():
        migrate_engine(db.engine)
        print("PASS: site media schema migration complete")


if __name__ == "__main__":
    migrate()
