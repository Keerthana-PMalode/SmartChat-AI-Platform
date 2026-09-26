from pydantic import BaseModel, ConfigDict, Field


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "user"


class UpdateRoleRequest(BaseModel):
    role: str


class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True

class UpdateSettingsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    application_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    max_message_length: int | None = Field(
        default=None,
        ge=1,
        le=100000,
    )

    maintenance_mode: bool | None = None

    allow_user_registration: bool | None = None
