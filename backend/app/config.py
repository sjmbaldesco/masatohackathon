from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    firebase_service_account_path: str = "./serviceAccountKey.json"
    firebase_project_id: str = ""
    ors_api_key: str = ""
    gemini_api_key: str = ""
    app_env: str = "development"
    allowed_origins: str = "http://localhost:3000"
    demo_key: str = "pasada-demo-2025"

    class Config:
        env_file = ".env"


settings = Settings()
