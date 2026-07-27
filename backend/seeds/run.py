"""
一盏茶 数据库种子数据导入脚本
运行方式：python -m backend.seeds.run
"""

import sys
import os

# 将项目根目录加入 Python 路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from app.database import SessionLocal, engine, Base
from app.models import Tea, TeaRegion, TeaPerson, TeaPoem
from seeds.tea_seed import SEED_TEAS
from seeds.culture_seed import SEED_REGIONS, SEED_PEOPLE, SEED_POEMS


def seed_teas(db):
    """导入茶叶数据"""
    existing = db.query(Tea).count()
    if existing > 0:
        print(f"茶叶数据已存在 ({existing} 条)，跳过导入。如需重新导入请先清空 teas 表。")
        return

    for data in SEED_TEAS:
        tea = Tea(**data)
        db.add(tea)
    db.commit()
    print(f"✅ 导入 {len(SEED_TEAS)} 款茶叶")


def seed_regions(db):
    """导入产区数据"""
    existing = db.query(TeaRegion).count()
    if existing > 0:
        print(f"产区数据已存在 ({existing} 条)，跳过。")
        return
    for data in SEED_REGIONS:
        region = TeaRegion(**data)
        db.add(region)
    db.commit()
    print(f"✅ 导入 {len(SEED_REGIONS)} 个产区")


def seed_people(db):
    """导入茶人数据"""
    existing = db.query(TeaPerson).count()
    if existing > 0:
        print(f"茶人数据已存在 ({existing} 条)，跳过。")
        return
    for data in SEED_PEOPLE:
        person = TeaPerson(**data)
        db.add(person)
    db.commit()
    print(f"✅ 导入 {len(SEED_PEOPLE)} 位茶人")


def seed_poems(db):
    """导入茶诗数据"""
    existing = db.query(TeaPoem).count()
    if existing > 0:
        print(f"茶诗数据已存在 ({existing} 条)，跳过。")
        return
    for data in SEED_POEMS:
        poem = TeaPoem(**data)
        db.add(poem)
    db.commit()
    print(f"✅ 导入 {len(SEED_POEMS)} 首茶诗")


def main():
    print("=" * 40)
    print("一盏茶 文化数据库种子导入")
    print("=" * 40)

    # 创建所有表
    Base.metadata.create_all(bind=engine)
    print("✅ 数据库表已创建")

    db = SessionLocal()
    try:
        seed_teas(db)
        seed_regions(db)
        seed_people(db)
        seed_poems(db)
        print("\n🎉 全部种子数据导入完成！")
    except Exception as e:
        print(f"❌ 导入失败: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
