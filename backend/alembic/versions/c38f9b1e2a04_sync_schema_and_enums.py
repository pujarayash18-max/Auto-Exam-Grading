"""sync_schema_and_enums

Revision ID: c38f9b1e2a04
Revises: 792de8de59c5
Create Date: 2026-11-05 13:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c38f9b1e2a04'
down_revision: Union[str, Sequence[str], None] = '792de8de59c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add enum values to studentvivastatus if not present
    op.execute("ALTER TYPE studentvivastatus ADD VALUE IF NOT EXISTS 'PAUSED'")
    op.execute("ALTER TYPE studentvivastatus ADD VALUE IF NOT EXISTS 'ABSENT'")

    # 2. Add token_quota_ceiling to faculty_profiles if not exists
    op.execute("ALTER TABLE faculty_profiles ADD COLUMN IF NOT EXISTS token_quota_ceiling INTEGER DEFAULT NULL")


def downgrade() -> None:
    pass
