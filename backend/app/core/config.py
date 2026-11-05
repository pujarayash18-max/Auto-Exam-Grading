from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://viva_user:viva_password@localhost:5433/viva_db"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "dev_secret_key_change_in_prod_minimum_32_characters_for_hmac"
    JWT_SECRET_KEY: str = "supersecretkey_access_secure_hmac_sha256_token_signing_key_32bytes"
    JWT_REFRESH_SECRET_KEY: str = "supersecretkey_refresh_secure_hmac_sha256_token_signing_key_32bytes"
    ENVIRONMENT: str = "development"
    
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = "no-reply@autoexam.com"
    BREVO_SENDER_NAME: str = "AutoExam"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
