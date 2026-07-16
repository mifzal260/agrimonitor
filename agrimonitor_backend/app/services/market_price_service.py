import csv
from datetime import date
from decimal import Decimal, InvalidOperation
from io import StringIO

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import VALID_PRICE_TRENDS, VALID_PRICE_TYPES
from app.models.crop import Crop
from app.models.market_price import MarketPrice
from app.schemas.market_price import CsvImportResult, MarketPriceCreate, MarketPriceUpdate

ALLOWED_CSV_CONTENT_TYPES = {"text/csv", "application/csv", "application/vnd.ms-excel", "application/octet-stream"}


def get_market_price_or_404(db: Session, price_id: int) -> MarketPrice:
    market_price = db.get(MarketPrice, price_id)
    if market_price is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Market price not found")
    return market_price


def validate_crop(db: Session, crop_id: int | None) -> None:
    if crop_id is None:
        return
    if db.get(Crop, crop_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Crop not found")


def create_market_price(db: Session, payload: MarketPriceCreate) -> MarketPrice:
    validate_crop(db, payload.crop_id)
    market_price = MarketPrice(**payload.model_dump())
    db.add(market_price)
    db.commit()
    db.refresh(market_price)
    return market_price


def update_market_price(db: Session, market_price: MarketPrice, payload: MarketPriceUpdate) -> MarketPrice:
    data = payload.model_dump(exclude_unset=True)
    if "crop_id" in data:
        validate_crop(db, data["crop_id"])
    for key, value in data.items():
        setattr(market_price, key, value)
    db.commit()
    db.refresh(market_price)
    return market_price


def list_market_prices(
    db: Session,
    commodity_name: str | None = None,
    location: str | None = None,
    price_type: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[MarketPrice]:
    query = select(MarketPrice)
    if commodity_name:
        query = query.where(MarketPrice.commodity_name.ilike(f"%{commodity_name}%"))
    if location:
        query = query.where(MarketPrice.location.ilike(f"%{location}%"))
    if price_type:
        query = query.where(MarketPrice.price_type == price_type)
    if date_from:
        query = query.where(MarketPrice.recorded_date >= date_from)
    if date_to:
        query = query.where(MarketPrice.recorded_date <= date_to)
    return list(db.scalars(query.order_by(MarketPrice.recorded_date.desc(), MarketPrice.commodity_name)).all())


def latest_market_prices(db: Session) -> list[MarketPrice]:
    rows = db.scalars(select(MarketPrice).order_by(MarketPrice.recorded_date.desc())).all()
    seen: set[tuple[str, str, str]] = set()
    latest: list[MarketPrice] = []
    for row in rows:
        key = (row.commodity_name, row.location, row.price_type)
        if key in seen:
            continue
        seen.add(key)
        latest.append(row)
    return latest


def validate_csv_upload(file: UploadFile, content: bytes) -> None:
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only CSV files are supported")
    if file.content_type and file.content_type not in ALLOWED_CSV_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported CSV content type")
    if len(content) > settings.csv_max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="CSV file is too large")


async def import_market_prices_csv(db: Session, file: UploadFile) -> CsvImportResult:
    raw_content = await file.read()
    validate_csv_upload(file, raw_content)
    try:
        content = raw_content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV must be UTF-8 encoded") from exc

    reader = csv.DictReader(StringIO(content))
    required = {"commodity_name", "location", "price_type", "price", "unit", "recorded_date"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV missing required columns")

    imported = 0
    skipped = 0
    for row_index, row in enumerate(reader, start=1):
        if row_index > settings.csv_max_rows:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV row limit exceeded")
        try:
            price_type = row["price_type"].strip().lower()
            trend = (row.get("trend") or "stable").strip().lower()
            if price_type not in VALID_PRICE_TYPES or trend not in VALID_PRICE_TRENDS:
                skipped += 1
                continue
            price = MarketPrice(
                commodity_name=row["commodity_name"].strip(),
                location=row["location"].strip(),
                price_type=price_type,
                price=Decimal(row["price"]),
                unit=row["unit"].strip(),
                recorded_date=date.fromisoformat(row["recorded_date"].strip()),
                trend=trend,
            )
        except (InvalidOperation, ValueError, KeyError):
            skipped += 1
            continue
        if not price.commodity_name or not price.location or not price.price_type or not price.unit:
            skipped += 1
            continue
        db.add(price)
        imported += 1

    db.commit()
    return CsvImportResult(imported=imported, skipped=skipped)
