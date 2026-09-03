"""add share link access auditing

Revision ID: <GENERATED_REVISION_ID>
Revises: c7d91a2e4f10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3bdfd3ff740c"
down_revision: Union[str, Sequence[str], None] = "c7d91a2e4f10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Anonymous share-link downloads do not have an authenticated user.
    op.alter_column(
        "file_access_logs",
        "user_id",
        existing_type=sa.Integer(),
        nullable=True,
    )

    # Identify the share link responsible for an anonymous access.
    op.add_column(
        "file_access_logs",
        sa.Column(
            "share_link_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    # Add temporarily nullable so existing audit rows can be populated.
    op.add_column(
        "file_access_logs",
        sa.Column(
            "access_method",
            sa.String(length=30),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_log_share_link",
        "file_access_logs",
        "shared_links",
        ["share_link_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Existing audit records represent authenticated operations.
    op.execute(
        """
        UPDATE file_access_logs
        SET access_method = 'AUTHENTICATED'
        WHERE access_method IS NULL
        """
    )

    # All existing rows now have a valid access method.
    op.alter_column(
        "file_access_logs",
        "access_method",
        existing_type=sa.String(length=30),
        nullable=False,
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_log_share_link",
        "file_access_logs",
        type_="foreignkey",
    )

    op.drop_column(
        "file_access_logs",
        "access_method",
    )

    op.drop_column(
        "file_access_logs",
        "share_link_id",
    )

    op.alter_column(
        "file_access_logs",
        "user_id",
        existing_type=sa.Integer(),
        nullable=False,
    )