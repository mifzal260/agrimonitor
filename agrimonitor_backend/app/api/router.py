from fastapi import APIRouter

from app.api.routes import auth, dashboard, finance, health, market_prices, monitoring, recommendations

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["monitoring"])
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
api_router.include_router(market_prices.router, prefix="/market-prices", tags=["market-prices"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(finance.router, prefix="/finance", tags=["finance"])