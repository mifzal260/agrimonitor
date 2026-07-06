from fastapi import APIRouter

router = APIRouter()


@router.get("")
def api_health_check() -> dict[str, str]:
    return {"status": "ok"}

