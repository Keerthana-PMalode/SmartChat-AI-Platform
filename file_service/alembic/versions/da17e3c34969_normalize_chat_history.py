"""normalize chat history

Revision ID: da17e3c34969
Revises: dc43677600be
Create Date: 2026-09-04 17:17:55.918936

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da17e3c34969'
down_revision: Union[str, Sequence[str], None] = 'dc43677600be'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("chat_history", "sender")
    op.drop_column("chat_history", "message")
    op.drop_column("chat_history", "response")


def downgrade() -> None:
    op.add_column(
        "chat_history",
        sa.Column("sender", sa.String(length=20), nullable=True),
    )

    op.add_column(
        "chat_history",
        sa.Column("message", sa.Text(), nullable=True),
    )

    op.add_column(
        "chat_history",
        sa.Column("response", sa.Text(), nullable=True),
    )