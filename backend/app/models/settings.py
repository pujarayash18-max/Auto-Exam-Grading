from sqlalchemy import Column, Integer, String, Text, CheckConstraint
from .base import Base

class SiteSettings(Base):
    __tablename__ = "site_settings"
    __table_args__ = (
        CheckConstraint('id = 1', name='site_settings_single_row_check'),
    )

    id = Column(Integer, primary_key=True, index=True)
    logo_path = Column(String, nullable=True)
    terms_and_conditions = Column(Text, nullable=True)
    contact_number = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
