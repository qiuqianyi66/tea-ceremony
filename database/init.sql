-- 一盏茶 V2.0 文化数据库初始化脚本

-- ============ 1. 茶山产区 ============
CREATE TABLE IF NOT EXISTS tea_regions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    province VARCHAR(50),
    latitude FLOAT,
    longitude FLOAT,
    altitude VARCHAR(50),
    climate VARCHAR(200),
    soil VARCHAR(200),
    history TEXT,
    famous_for JSONB DEFAULT '[]',
    description TEXT
);

-- ============ 2. 制茶工艺 ============
CREATE TABLE IF NOT EXISTS tea_processes (
    id SERIAL PRIMARY KEY,
    tea_category VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    summary TEXT,
    steps JSONB DEFAULT '[]'
);

-- ============ 3. 茶叶主表 ============
CREATE TABLE IF NOT EXISTS teas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL,
    origin VARCHAR(200),
    region_id INTEGER REFERENCES tea_regions(id) ON DELETE SET NULL,
    process_id INTEGER REFERENCES tea_processes(id) ON DELETE SET NULL,
    season VARCHAR(50),
    grade VARCHAR(50),
    altitude VARCHAR(50),
    best_temp INTEGER,
    best_time INTEGER,
    infusions INTEGER DEFAULT 3,
    flavor JSONB DEFAULT '[]',
    story TEXT,
    description TEXT,
    historical_period VARCHAR(100),
    water_requirement VARCHAR(100),
    soup_color_min VARCHAR(20),
    soup_color_max VARCHAR(20),
    dry_tea_color VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============ 4. 茶人历史 ============
CREATE TABLE IF NOT EXISTS tea_people (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    dynasty VARCHAR(50),
    title VARCHAR(100),
    identity VARCHAR(100),
    description TEXT,
    contribution TEXT,
    quote TEXT,
    avatar VARCHAR(200),
    related_tea_ids JSONB DEFAULT '[]'
);

-- ============ 5. 茶诗词 ============
CREATE TABLE IF NOT EXISTS tea_poems (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200),
    author VARCHAR(100),
    dynasty VARCHAR(50),
    content TEXT,
    related_tea_ids JSONB DEFAULT '[]',
    description TEXT
);

-- ============ 6. 茶器（升级版）============
CREATE TABLE IF NOT EXISTS teawares_v2 (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    ware_type VARCHAR(20),
    material VARCHAR(100),
    capacity INTEGER,
    origin VARCHAR(100),
    dynasty VARCHAR(50),
    craft VARCHAR(200),
    description TEXT,
    culture_story TEXT,
    bonus JSONB DEFAULT '{}',
    recommended JSONB DEFAULT '[]',
    rarity VARCHAR(20) DEFAULT 'common'
);

-- ============ 7. 茶礼 ============
CREATE TABLE IF NOT EXISTS tea_etiquettes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    occasion VARCHAR(100),
    description TEXT,
    steps JSONB DEFAULT '[]'
);

-- ============ 8. 知识图谱关系 ============
CREATE TABLE IF NOT EXISTS tea_relations (
    id SERIAL PRIMARY KEY,
    source_type VARCHAR(50),
    source_id INTEGER,
    target_type VARCHAR(50),
    target_id INTEGER,
    relation VARCHAR(100)
);

-- ============ 9. 用户（升级版）============
CREATE TABLE IF NOT EXISTS users_v2 (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    hashed_password VARCHAR(200) NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    preferred_type VARCHAR(20),
    preferred_temp INTEGER,
    preferred_aroma JSONB DEFAULT '[]',
    preferred_ware_id INTEGER REFERENCES teawares_v2(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============ 10. 品鉴记录（升级版）============
CREATE TABLE IF NOT EXISTS tasting_records_v2 (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users_v2(id),
    tea_id INTEGER REFERENCES teas(id),
    tea_name VARCHAR(100) NOT NULL,
    brew_temp INTEGER,
    brew_time INTEGER,
    infusions INTEGER DEFAULT 1,
    water_type VARCHAR(20),
    ware_id INTEGER REFERENCES teawares_v2(id),
    dimensions JSONB DEFAULT '{}',
    overall_score FLOAT,
    process_factor FLOAT,
    aroma_type VARCHAR(50),
    notes TEXT,
    weather VARCHAR(50),
    mood VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============ 11. 水源 ============
CREATE TABLE IF NOT EXISTS water_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    quality VARCHAR(200),
    history TEXT,
    suitable_teas JSONB DEFAULT '[]'
);

-- ============ 12. 茶人生 ============
CREATE TABLE IF NOT EXISTS tea_journeys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users_v2(id),
    tea_count INTEGER DEFAULT 0,
    favorite_category VARCHAR(50),
    favorite_aroma JSONB DEFAULT '[]',
    tea_level VARCHAR(50) DEFAULT '初识茶客',
    experience INTEGER DEFAULT 0
);

-- ============ 13. 茶人关联 ============
CREATE TABLE IF NOT EXISTS tea_person_relations (
    id SERIAL PRIMARY KEY,
    tea_id INTEGER REFERENCES teas(id),
    person_id INTEGER REFERENCES tea_people(id)
);

-- ============ 索引 ============
CREATE INDEX idx_teas_name ON teas(name);
CREATE INDEX idx_teas_category ON teas(category);
CREATE INDEX idx_teas_region ON teas(region_id);
CREATE INDEX idx_teas_process ON teas(process_id);
CREATE INDEX idx_tea_people_dynasty ON tea_people(dynasty);
CREATE INDEX idx_tea_poems_author ON tea_poems(author);
CREATE INDEX idx_tasting_records_user ON tasting_records_v2(user_id);
CREATE INDEX idx_tea_relations_source ON tea_relations(source_type, source_id);
CREATE INDEX idx_tea_relations_target ON tea_relations(target_type, target_id);
