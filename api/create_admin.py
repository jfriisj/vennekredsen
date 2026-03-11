#!/usr/bin/env python3
"""
Admin User Creation Script for Vennekredsen

Dette script opretter en admin bruger i databasen.
Kan køres enten direkte eller via dev.sh create-admin kommandoen.
"""

import getpass
import sys

from app import Admin, app, db


def create_admin_user(username, email, password):
    """Create a new admin user"""
    with app.app_context():
        try:
            # Check if admin already exists
            existing_admin = Admin.query.filter_by(username=username).first()
            if existing_admin:
                print(f'❌ Admin user "{username}" already exists!')
                return False

            existing_email = Admin.query.filter_by(email=email).first()
            if existing_email:
                print(f'❌ Admin email "{email}" already exists!')
                return False

            # Create new admin
            admin = Admin(username=username, email=email)
            admin.set_password(password)
            db.session.add(admin)
            db.session.commit()

            print("✅ Admin user created successfully!")
            print(f"   Username: {username}")
            print(f"   Email: {email}")
            print("🔐 Please save your password securely!")
            return True

        except Exception as e:
            print(f"❌ Error creating admin: {e}")
            return False


def main():
    """Main function for interactive admin creation"""
    print("👤 Creating admin user for Vennekredsen")
    print("=====================================")

    # Get admin details
    username = input("Admin username [admin]: ").strip() or "admin"
    email = (
        input("Admin email [admin@hashojskolen.dk]: ").strip()
        or "admin@hashojskolen.dk"
    )

    # Get password securely
    password = getpass.getpass("Admin password (will be hidden): ").strip()
    if not password:
        import secrets
        import string

        # Generate secure password
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        password = "".join(secrets.choice(alphabet) for _ in range(12))
        print(f"🔑 Generated secure password: {password}")

    # Confirm creation
    print("\nCreating admin user:")
    print(f"  Username: {username}")
    print(f"  Email: {email}")

    confirm = input("\nProceed? (y/N): ").strip().lower()
    if confirm not in ["y", "yes"]:
        print("❌ Admin creation cancelled.")
        return

    # Create the admin user
    success = create_admin_user(username, email, password)

    if success:
        print("\n🎉 Admin user ready! You can now:")
        print("   - Login at http://localhost:85/admin-login.html")
        print("   - Access admin panel at http://localhost:85/admin-panel.html")
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
