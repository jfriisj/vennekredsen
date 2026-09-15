#!/usr/bin/env python3
"""Create an administrator for Vennekredsen."""

import getpass
import sys

from app import User, app, db


def create_admin_user(username, email, password):
    """Create a new active administrator."""
    with app.app_context():
        try:
            if User.query.filter_by(username=username).first():
                print(f'❌ User "{username}" already exists!')
                return False
            if User.query.filter_by(email=email).first():
                print(f'❌ Email "{email}" already exists!')
                return False

            admin = User(
                username=username,
                email=email,
                role="admin",
                is_active=True,
            )
            admin.set_password(password)
            db.session.add(admin)
            db.session.commit()

            print("✅ Admin user created successfully!")
            print(f"   Username: {username}")
            print(f"   Email: {email}")
            print("🔐 Please save your password securely!")
            return True
        except Exception as exc:
            db.session.rollback()
            print(f"❌ Error creating admin: {exc}")
            return False


def main():
    print("👤 Creating admin user for Vennekredsen")
    print("=====================================")
    username = input("Admin username [admin]: ").strip() or "admin"
    email = input("Admin email: ").strip()
    if not email:
        print("❌ Admin email is required.")
        sys.exit(1)

    password = getpass.getpass("Admin password (will be hidden): ").strip()
    if len(password) < 8:
        print("❌ Admin password must be at least 8 characters.")
        sys.exit(1)

    print("\nCreating admin user:")
    print(f"  Username: {username}")
    print(f"  Email: {email}")
    if input("\nProceed? (y/N): ").strip().lower() not in ["y", "yes"]:
        print("❌ Admin creation cancelled.")
        return

    if not create_admin_user(username, email, password):
        sys.exit(1)

    print("\n🎉 Admin user ready!")
    print("   - Login at http://localhost:85/admin-login.html")
    print("   - Access admin panel at http://localhost:85/admin-panel.html")


if __name__ == "__main__":
    main()
