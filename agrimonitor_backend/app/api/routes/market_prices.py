from datetime import date

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.core.enums import PriceType
from app.db.database import get_db
from app.models.market_price import MarketPrice
from app.models.user import User
from app.schemas.market_price import CsvImportResult, MarketPriceCreate, MarketPriceRead, MarketPriceUpdate
from app.services.market_price_service import create_market_price, get_market_price_or_404, import_market_prices_csv, latest_market_prices, list_market_prices, update_market_price

router = APIRouter()


@router.get("", response_model=list[MarketPriceRead])
def read_market_prices(
    commodity_name: str | None = None,
    location: str | None = None,
    price_type: PriceType | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MarketPrice]:
    return list_market_prices(db, commodity_name, location, price_type, date_from, date_to)


@router.get("/latest", response_model=list[MarketPriceRead])
def read_latest_market_prices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[MarketPrice]:
    return latest_market_prices(db)


@router.post("", response_model=MarketPriceRead, status_code=201)
def create_price(payload: MarketPriceCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> MarketPrice:
    return create_market_price(db, payload)


@router.patch("/{price_id}", response_model=MarketPriceRead)
def update_price(price_id: int, payload: MarketPriceUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> MarketPrice:
    market_price = get_market_price_or_404(db, price_id)
    return update_market_price(db, market_price, payload)


@router.delete("/{price_id}", status_code=204)
def delete_price(price_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> Response:
    market_price = get_market_price_or_404(db, price_id)
    db.delete(market_price)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/import-csv", response_model=CsvImportResult)
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> CsvImportResult:
    return await import_market_prices_csv(db, file)
