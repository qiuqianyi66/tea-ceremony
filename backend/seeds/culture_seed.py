"""
茶文化种子数据
产区、茶人、茶诗
"""

SEED_REGIONS = [
    {"name": "西湖茶区", "province": "浙江", "altitude": 200, "climate": "亚热带湿润", "history": "龙井茶原产地，乾隆四次驾临。"},
    {"name": "武夷山茶区", "province": "福建", "altitude": 600, "climate": "亚热带湿润", "history": "世界双遗产地，岩茶唯一产区。"},
    {"name": "安溪茶区", "province": "福建", "altitude": 500, "climate": "亚热带季风", "history": "铁观音原产地，中国茶都。"},
    {"name": "福鼎茶区", "province": "福建", "altitude": 600, "climate": "沿海湿润", "history": "白茶原产地，太姥山茶文化发祥地。"},
    {"name": "黄山茶区", "province": "安徽", "altitude": 800, "climate": "高山云雾", "history": "黄山毛峰、太平猴魁原产地。"},
    {"name": "勐海茶区", "province": "云南", "altitude": 1500, "climate": "热带雨林", "history": "普洱茶核心产区，布朗山古树茶闻名。"},
    {"name": "洞庭东山", "province": "江苏", "altitude": 200, "climate": "温和湿润", "history": "碧螺春原产地，太湖小气候。"},
    {"name": "祁门茶区", "province": "安徽", "altitude": 500, "climate": "亚热带湿润", "history": "祁门红茶原产地，世界三大高香红茶。"},
    {"name": "凤凰山茶区", "province": "广东", "altitude": 1000, "climate": "山地气候", "history": "凤凰单丛原产地，茶中香水。"},
    {"name": "洞庭湖君山", "province": "湖南", "altitude": 100, "climate": "湖岛气候", "history": "君山银针原产地，三起三落奇观。"},
]

SEED_PEOPLE = [
    {"name": "陆羽", "dynasty": "唐", "identity": "茶圣", "biography": "撰《茶经》三卷十篇，系统论述茶之源、具、造、器、煮、饮、事、出、略、图，奠定中国茶文化的理论基础。", "quote": "茶者，南方之嘉木也。"},
    {"name": "苏轼", "dynasty": "宋", "identity": "茶中诗仙", "biography": "一生爱茶，写下近百首茶诗。"活水还须活火烹"的烹茶理念影响深远。", "quote": "且将新火试新茶，诗酒趁年华。"},
    {"name": "陆游", "dynasty": "宋", "identity": "茶诗第一", "biography": "一生创作三百余首茶诗，是中国历史上写茶诗最多的诗人。", "quote": "晴窗细乳戏分茶。"},
    {"name": "乾隆", "dynasty": "清", "identity": "六下江南品茶帝", "biography": "六下江南，四次驾临龙井茶区，亲封十八棵御茶树，推动龙井茶名扬天下。", "quote": "火前嫩，火后老，惟有骑火品最好。"},
    {"name": "袁枚", "dynasty": "清", "identity": "随园茶客", "biography": "著《随园食单》，提出品茶三境界：始觉其清，再酌其香，终品其韵。", "quote": "始觉其清，再酌其香，终品其韵。"},
    {"name": "宋徽宗赵佶", "dynasty": "宋", "identity": "皇帝茶人", "biography": "亲撰《大观茶论》，是中国历史上唯一为茶著书立说的帝王。", "quote": "至若茶之为物，致清导和。"},
    {"name": "白居易", "dynasty": "唐", "identity": "茶中隐士", "biography": "晚年号香山居士，嗜茶如命，在《琵琶行》等名篇中多次提及茶事。", "quote": "无由持一碗，寄与爱茶人。"},
    {"name": "卢仝", "dynasty": "唐", "identity": "七碗茶歌者", "biography": "以"七碗茶诗"闻名——一碗喉吻润，两碗破孤闷，七碗吃不得也。", "quote": "七碗吃不得也，唯觉两腋习习清风生。"},
    {"name": "欧阳修", "dynasty": "宋", "identity": "文忠公茶客", "biography": "在《归田录》中详记宋代贡茶制度，提出"茶之品无有贵于龙凤者"。", "quote": "吾年向老，世味渐薄。惟于茶，不能忘情。"},
    {"name": "李清照", "dynasty": "宋", "identity": "茶中词后", "biography": ""赌书泼茶"的典故成为文人茶事的经典意象。", "quote": "酒阑更喜团茶苦，梦断偏宜瑞脑香。"},
]

SEED_POEMS = [
    {"title": "望江南·超然台作", "author": "苏轼", "dynasty": "宋", "content": "且将新火试新茶，诗酒趁年华。", "description": "苏轼以茶寄情的千古名句。"},
    {"title": "山泉煎茶有怀", "author": "白居易", "dynasty": "唐", "content": "坐酌泠泠水，看煎瑟瑟尘。无由持一碗，寄与爱茶人。", "description": "白居易以水、茶、友三元素道出品茶真谛。"},
    {"title": "七碗茶诗", "author": "卢仝", "dynasty": "唐", "content": "一碗喉吻润，两碗破孤闷。三碗搜枯肠，惟有文字五千卷。四碗发轻汗，平生不平事，尽向毛孔散。五碗肌骨清，六碗通仙灵。七碗吃不得也，唯觉两腋习习清风生。", "description": "中国最著名的茶诗，从生理到精神的层层升华。"},
    {"title": "临安春雨初霁", "author": "陆游", "dynasty": "宋", "content": "小楼一夜听春雨，深巷明朝卖杏花。矮纸斜行闲作草，晴窗细乳戏分茶。", "description": "陆游在临安听春雨分茶，宋代文人风雅。"},
    {"title": "观采茶作歌", "author": "乾隆", "dynasty": "清", "content": "火前嫩，火后老，惟有骑火品最好。西湖龙井旧擅名，适来试一观其道。", "description": "乾隆帝亲观龙井采制后所作，记录品茶要诀。"},
    {"title": "汲江煎茶", "author": "苏轼", "dynasty": "宋", "content": "活水还须活火烹，自临钓石取深清。大瓢贮月归春瓮，小杓分江入夜瓶。", "description": ""活水还须活火烹"提出烹茶要诀。"},
    {"title": "一字至七字诗·茶", "author": "元稹", "dynasty": "唐", "content": "茶。香叶，嫩芽。慕诗客，爱僧家。碾雕白玉，罗织红纱。铫煎黄蕊色，碗转麹尘花。", "description": "宝塔诗将茶的外形品饮意境层层展开。"},
    {"title": "走笔谢孟谏议寄新茶", "author": "卢仝", "dynasty": "唐", "content": "一碗喉吻润，两碗破孤闷。三碗搜枯肠，惟有文字五千卷。", "description": "七碗茶歌节选，品茶精神的极致表达。"},
]
