"""add user delete cascade rules

Revision ID: c7d91a2e4f10
Revises: b48f2c4ab1ae
"""

from alembic import op


revision = "c7d91a2e4f10"
down_revision = "b48f2c4ab1ae"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # chat_history.user_id -> users.id
    op.drop_constraint(
        "chat_history_user_id_fkey",
        "chat_history",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "chat_history_user_id_fkey",
        "chat_history",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # file_access_logs.user_id -> users.id
    op.drop_constraint(
        "fk_log_user",
        "file_access_logs",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "fk_log_user",
        "file_access_logs",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # file_permissions.shared_by -> users.id
    op.drop_constraint(
        "fk_permission_owner",
        "file_permissions",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "fk_permission_owner",
        "file_permissions",
        "users",
        ["shared_by"],
        ["id"],
        ondelete="CASCADE",
    )

    # shared_links.created_by -> users.id
    op.drop_constraint(
        "shared_links_created_by_fkey",
        "shared_links",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "shared_links_created_by_fkey",
        "shared_links",
        "users",
        ["created_by"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # shared_links.created_by -> users.id
    op.drop_constraint(
        "shared_links_created_by_fkey",
        "shared_links",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "shared_links_created_by_fkey",
        "shared_links",
        "users",
        ["created_by"],
        ["id"],
    )

    # file_permissions.shared_by -> users.id
    op.drop_constraint(
        "fk_permission_owner",
        "file_permissions",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "fk_permission_owner",
        "file_permissions",
        "users",
        ["shared_by"],
        ["id"],
    )

    # file_access_logs.user_id -> users.id
    op.drop_constraint(
        "fk_log_user",
        "file_access_logs",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "fk_log_user",
        "file_access_logs",
        "users",
        ["user_id"],
        ["id"],
    )

    # chat_history.user_id -> users.id
    op.drop_constraint(
        "chat_history_user_id_fkey",
        "chat_history",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "chat_history_user_id_fkey",
        "chat_history",
        "users",
        ["user_id"],
        ["id"],
    )
