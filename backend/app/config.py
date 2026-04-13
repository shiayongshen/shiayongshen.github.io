from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ShiaYongShen Personal Site API"
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./site.db"
    jwt_secret: str = Field("change-me-in-production", min_length=16)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 12
    admin_username: str = "admin"
    admin_password: str = "changeme123"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def get_database_url(self) -> str:
        # SQLAlchemy 1.4+ 要求使用 postgresql:// 而不是 postgres://
        if self.database_url and self.database_url.startswith("postgres://"):
            return self.database_url.replace("postgres://", "postgresql://", 1)
        return self.database_url

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
