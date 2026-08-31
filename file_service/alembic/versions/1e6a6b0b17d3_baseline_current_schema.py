"""baseline current schema

Revision ID: 1e6a6b0b17d3
Revises:
Create Date: 2026-08-29 03:55:48.587400
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "1e6a6b0b17d3"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Mark the existing database schema as the baseline."""
    pass


def downgrade() -> None:
    """Baseline migration has no downgrade operations."""
    pass
