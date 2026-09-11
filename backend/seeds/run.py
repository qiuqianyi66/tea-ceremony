"""
一盏茶 数据库种子数据导入脚本
运行方式：python -m seeds.run
"""

import asyncio
import sys
import os

# 将项目根目录加入 Python 路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select, func
from app.database import SessionLocal, engine, Base
from app.models import Tea, TeaRegion, TeaPerson, TeaPoem
from seeds.tea_seed import SEED_TEAS
from seeds.culture_seed import SEED_REGIONS, SEED_PEOPLE, SEED_POEMS


async def seed_teas(db):
    """导入茶叶数据"""
    count_result = await db.execute(select(func.count()).select_from(Tea))
    existing = count_result.scalar() or 0
    if existing > 0:
        print(f"茶叶数据已存在 ({existing} 条)，跳过导入。如需重新导入请先清空 teas 表。")
        return

    for data in SEED_TEAS:
        db.add(Tea(**data))
    await db.commit()
    print(f"✅ 导入 {len(SEED_TEAS)} 款茶叶")


async def seed_regions(db):
    """导入产区数据"""
    count_result = await db.execute(select(func.count()).select_from(TeaRegion))
    existing = count_result.scalar() or 0
    if existing > 0:
        print(f"产区数据已存在 ({existing} 条)，跳过。")
        return
    for data in SEED_REGIONS:
        db.add(TeaRegion(**data))
    await db.commit()
    print(f"✅ 导入 {len(SEED_REGIONS)} 个产区")


async def seed_people(db):
    """导入茶人数据"""
    count_result = await db.execute(select(func.count()).select_from(TeaPerson))
    existing = count_result.scalar() or 0
    if existing > 0:
        print(f"茶人数据已存在 ({existing} 条)，跳过。")
        return
    for data in SEED_PEOPLE:
        db.add(TeaPerson(**data))
    await db.commit()
    print(f"✅ 导入 {len(SEED_PEOPLE)} 位茶人")


async def seed_poems(db):
    """导入茶诗数据"""
    count_result = await db.execute(select(func.count()).select_from(TeaPoem))
    existing = count_result.scalar() or 0
    if existing > 0:
        print(f"茶诗数据已存在 ({existing} 条)，跳过。")
        return
    for data in SEED_POEMS:
        db.add(TeaPoem(**data))
    await db.commit()
    print(f"✅ 导入 {len(SEED_POEMS)} 首茶诗")


async def main():
    print("=" * 40)
    print("一盏茶 文化数据库种子导入")
    print("=" * 40)

    # 创建所有表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ 数据库表已创建")

    db = SessionLocal()
    try:
        await seed_teas(db)
        await seed_regions(db)
        await seed_people(db)
        await seed_poems(db)
        print("\n🎉 全部种子数据导入完成！")
    except Exception as e:
        print(f"❌ 导入失败: {e}")
        await db.rollback()
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
