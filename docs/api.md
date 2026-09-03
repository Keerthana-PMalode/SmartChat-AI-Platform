## Delete User

### DELETE /users/{user_id}

Administrators can permanently delete a user account.

User deletion is a hard delete. When a user is deleted, PostgreSQL
cascading foreign-key constraints automatically remove data owned by
or directly associated with that user.

The following data is deleted:

- User account
- Chat history
- Files owned by the user
- File access logs
- File permissions
- Shared links created by the user

The API prevents:

- An administrator from deleting their own account
- Deletion of the last administrator account

The operation is permanent and cannot be undone through the application.
