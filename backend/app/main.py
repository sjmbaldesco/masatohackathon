from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import auth, passengers, drivers, demand, confidence, ai, routes, demo

app = FastAPI(
    title="Pasada API",
    description="Demand-first public transport coordination for jeepney cooperatives",
    version="0.1.0",
)

# CORS — frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(passengers.router, prefix="/passengers", tags=["Passengers"])
app.include_router(drivers.router, prefix="/drivers", tags=["Drivers"])
app.include_router(demand.router, prefix="/demand", tags=["Demand"])
app.include_router(confidence.router, tags=["Confidence Score"])
app.include_router(ai.router, prefix="/ai", tags=["AI"])
app.include_router(routes.router, prefix="/routes", tags=["Routes"])
app.include_router(demo.router, prefix="/demo", tags=["Demo"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "pasada-api"}
