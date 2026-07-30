from app.core.config import settings
from app.db.database import SessionLocal
from app.services.session_service import cleanup_expired_sessions


def main() -> int:
    total_deleted = 0
    db = SessionLocal()
    try:
        while True:
            deleted = cleanup_expired_sessions(db, settings.session_cleanup_batch_size)
            total_deleted += deleted
            if deleted < settings.session_cleanup_batch_size:
                break
    except Exception:
        db.rollback()
        print("Pembersihan sesi gagal. Semak log operator.")
        return 1
    finally:
        db.close()
    print(f"Sesi tamat tempoh dibersihkan: {total_deleted}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
