"""add chat messages

Revision ID: dc43677600be
Revises: 7048022bff12
Create Date: 2026-09-04 11:59:53.277481

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dc43677600be'
down_revision: Union[str, Sequence[str], None] = '7048022bff12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("chat_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["chat_id"],
            ["chat_history.id"],
            name="fk_chat_message_chat",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_chat_messages_chat_id",
        "chat_messages",
        ["chat_id"],
    )


def downgrade():
    op.drop_index(
        "ix_chat_messages_chat_id",
        table_name="chat_messages",
    )

    op.drop_table("chat_messages")
