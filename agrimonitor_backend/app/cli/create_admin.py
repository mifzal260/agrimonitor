import getpass

from pydantic import ValidationError

from app.db.database import SessionLocal
from app.schemas.auth import UserCreate
from app.services.auth_service import UserAlreadyExistsError, provision_admin


def main() -> int:
    name = input("Nama admin: ").strip()
    email = input("Email admin: ").strip()
    password = getpass.getpass("Kata laluan admin: ")
    confirmation = getpass.getpass("Sahkan kata laluan admin: ")

    if password != confirmation:
        print("Kata laluan tidak sepadan.")
        return 1

    try:
        payload = UserCreate(name=name, email=email, password=password)
    except ValidationError:
        print("Maklumat admin tidak sah. Semak nama, email dan polisi kata laluan.")
        return 1

    try:
        operator_identifier = getpass.getuser() or "unknown-operator"
    except Exception:
        operator_identifier = "unknown-operator"

    db = SessionLocal()
    try:
        admin = provision_admin(db, payload, operator_identifier)
    except UserAlreadyExistsError:
        print("Akaun dengan email tersebut sudah wujud; tiada perubahan dibuat.")
        return 1
    except Exception:
        print("Admin tidak dapat diwujudkan. Semak log keselamatan operator.")
        return 1
    finally:
        db.close()

    print(f"Admin berjaya diwujudkan dengan ID {admin.id}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
