from pydantic import BaseModel


class AvatarResponse(BaseModel):
    avatar_id: str
    photo_url: str
