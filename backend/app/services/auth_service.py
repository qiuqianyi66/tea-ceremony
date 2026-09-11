"""认证域 service：注册 / 登录 / token 签发。"""

import logging
from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.hash import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import SECRET_KEY
from app.exceptions import BadRequestError, UnauthorizedError
from app.models import User
from app.schemas import UserCreate, UserLogin

logger = logging.getLogger("tea.auth")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


async def register(db: AsyncSession, data: UserCreate) -> User:
    result = await db.execute(select(User).filter(User.username == data.username))
    existing = result.scalar_one_or_none()
    if existing:
        raise BadRequestError("用户名已存在")

    user = User(
        username=data.username,
        hashed_password=bcrypt.hash(data.password),
        display_name=data.display_name or data.username,
        level=1,
        xp=0,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def login(db: AsyncSession, data: UserLogin) -> User:
    result = await db.execute(select(User).filter(User.username == data.username))
    user = result.scalar_one_or_none()
    if not user or not bcrypt.verify(data.password, user.hashed_password):
        # 统一文案避免用户枚举；记录失败以便排查异常登录尝试
        logger.info("登录失败: username=%s", data.username)
        raise UnauthorizedError("用户名或密码错误")
    return user
