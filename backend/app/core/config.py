from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://viva_user:viva_password@localhost:5433/viva_db"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "dev_secret_key_change_in_prod"
    JWT_SECRET_KEY: str = "dev_jwt_secret_key_change_in_prod"
    JWT_REFRESH_SECRET_KEY: str = "dev_jwt_refresh_secret_key_change_in_prod"
    ENVIRONMENT: str = "development"
    
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = "no-reply@autoexam.com"
    BREVO_SENDER_NAME: str = "AutoExam"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
