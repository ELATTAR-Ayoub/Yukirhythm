from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Set by Cloud Run; used for local runs too.
    port: int = 8080
    # Comma-separated list of allowed browser origins.
    cors_origins: str = "http://localhost:3000"
    # Set to true in tests/CI where no Firebase credentials exist.
    skip_firebase_init: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
