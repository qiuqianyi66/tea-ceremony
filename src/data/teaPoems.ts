/**
 * 茶诗词数据库
 * 精选历代经典茶诗
 */

export interface TeaPoem {
  id: string
  title: string
  author: string
  dynasty: string
  content: string
  relatedTeaIds?: string[]
  description: string
}

export const TEA_POEMS: TeaPoem[] = [
  {
    id: 'sushi_xinhuo',
    title: '望江南·超然台作',
    author: '苏轼', dynasty: '宋',
    content: '春未老，风细柳斜斜。试上超然台上看，半壕春水一城花。烟雨暗千家。\n寒食后，酒醒却咨嗟。休对故人思故国，且将新火试新茶。诗酒趁年华。',
    description: '苏轼"且将新火试新茶"道尽了文人以茶寄情的洒脱。',
  },
  {
    id: 'bai_juyi_shuzhuo',
    title: '山泉煎茶有怀',
    author: '白居易', dynasty: '唐',
    content: '坐酌泠泠水，看煎瑟瑟尘。无由持一碗，寄与爱茶人。',
    description: '以水、茶、友三元素道出品茶真谛——茶因分享而更美。',
  },
  {
    id: 'lutong_qige',
    title: '走笔谢孟谏议寄新茶',
    author: '卢仝', dynasty: '唐',
    content: '一碗喉吻润，两碗破孤闷。三碗搜枯肠，惟有文字五千卷。四碗发轻汗，平生不平事，尽向毛孔散。五碗肌骨清，六碗通仙灵。七碗吃不得也，唯觉两腋习习清风生。',
    description: '中国最著名的茶诗——"七碗茶歌"，从生理到精神的层层升华。',
  },
  {
    id: 'luyou_xicha',
    title: '临安春雨初霁',
    author: '陆游', dynasty: '宋',
    content: '小楼一夜听春雨，深巷明朝卖杏花。矮纸斜行闲作草，晴窗细乳戏分茶。',
    relatedTeaIds: ['longjing'],
    description: '陆游在临安听春雨分茶，"晴窗细乳戏分茶"描写了宋代点茶之雅。',
  },
  {
    id: 'qianlong_chage',
    title: '观采茶作歌',
    author: '乾隆', dynasty: '清',
    content: '火前嫩，火后老，惟有骑火品最好。西湖龙井旧擅名，适来试一观其道。',
    relatedTeaIds: ['longjing'],
    description: '乾隆帝亲观龙井采制后所作，记录"火前嫩火后老"的品茶要诀。',
  },
  {
    id: 'yuanzhen_yicha',
    title: '一字至七字诗·茶',
    author: '元稹', dynasty: '唐',
    content: '茶。香叶，嫩芽。慕诗客，爱僧家。碾雕白玉，罗织红纱。铫煎黄蕊色，碗转麹尘花。',
    description: '宝塔诗以一字起句至七字，将茶的外形品饮意境层层展开。',
  },
  {
    id: 'sushi_jijiang',
    title: '汲江煎茶',
    author: '苏轼', dynasty: '宋',
    content: '活水还须活火烹，自临钓石取深清。大瓢贮月归春瓮，小杓分江入夜瓶。',
    description: '"活水还须活火烹"提出烹茶要诀——好水须活火烧开。',
  },
  {
    id: 'dufu_zaicha',
    title: '重过何氏',
    author: '杜甫', dynasty: '唐',
    content: '落日平台上，春风啜茗时。石栏斜点笔，桐叶坐题诗。',
    description: '杜甫在落日春风中品茶题诗，文人风雅毕现。',
  },
  {
    id: 'bai_juyi_pipa',
    title: '琵琶行（节选）',
    author: '白居易', dynasty: '唐',
    content: '商人重利轻别离，前月浮梁买茶去。去来江口守空船，绕船月明江水寒。',
    description: '"浮梁买茶"记录了唐代茶叶贸易的繁荣，浮梁即今景德镇。',
  },
  {
    id: 'li_bai_yingdan',
    title: '答族侄僧中孚赠玉泉仙人掌茶',
    author: '李白', dynasty: '唐',
    content: '茗生此中石，玉泉流不歇。根柯洒芳津，采服润肌骨。',
    description: '李白唯一茶诗，描写玉泉山奇景，"仙人掌茶"即由李白命名。',
  },
  {
    id: 'li_bai_yecha',
    title: '夜茶',
    author: '李白', dynasty: '唐',
    content: '夜静茶烟细，月明竹影疏。悠然一杯尽，何必羡仙都。',
    description: '静夜中一杯茶，何须羡仙境。',
  },
  {
    id: 'ouyangxiu_doucha',
    title: '双井茶送子瞻',
    author: '欧阳修', dynasty: '宋',
    content: '穷腊不寒春气动，双井芽生先百草。白毛囊以红碧纱，十斤茶养一两芽。',
    description: '欧阳修寄茶给苏轼，"十斤茶养一两芽"可见双井茶之珍贵。',
  },
  {
    id: 'wang_anshi_shishui',
    title: '试茶',
    author: '王安石', dynasty: '宋',
    content: '蟹眼已过鱼眼生，飕飕欲作松风鸣。蒙茸出磨细珠落，眩转绕瓯飞雪轻。',
    description: '"蟹眼鱼眼"描写水沸程度，是中国品水论茶的重要标准。',
  },
  {
    id: 'liqingzhao_dianshu',
    title: '摊破浣溪沙',
    author: '李清照', dynasty: '宋',
    content: '豆蔻连梢煎熟水，莫分茶。枕上诗书闲处好，门前风景雨来佳。',
    description: '李清照病中煎茶，"莫分茶"道出了对茶的眷恋。',
  },
  {
    id: 'fan_zhongyan_douchai',
    title: '和章岷从事斗茶歌',
    author: '范仲淹', dynasty: '宋',
    content: '溪边奇茗冠天下，武夷仙人从古栽。斗茶味兮轻醍醐，斗茶香兮薄兰芷。',
    relatedTeaIds: ['dahongpao', 'shuixian'],
    description: '范仲淹描写武夷斗茶盛况，"武夷仙人从古栽"赋予茶神话色彩。',
  },
  {
    id: 'liu_zongyuan_bitang',
    title: '夏昼偶作',
    author: '柳宗元', dynasty: '唐',
    content: '日午独觉无余声，山童隔竹敲茶臼。',
    description: '以远逝的敲茶声反衬午后的宁静，意境悠远。',
  },
  {
    id: 'zhang_zai',
    title: '登成都白菟楼诗',
    author: '张载', dynasty: '晋',
    content: '芳茶冠六清，溢味播九区。人生苟安乐，兹土聊可娱。',
    description: '中国最早的茶诗之一，将茶香置于六种饮料之首。',
  },
  {
    id: 'qiji',
    title: '茶诗',
    author: '齐己', dynasty: '唐',
    content: '百草让为灵，功先百草成。甘传天下口，贵占火前名。',
    description: '诗僧齐己称茶为"百草之灵"，描写贡茶历程。',
  },
  {
    id: 'wangwei_huachan',
    title: '赠道士',
    author: '王维', dynasty: '唐',
    content: '山中习静观朝槿，松下清斋折露葵。茗煎冰下水，香爇佛前灰。',
    description: '王维以茶入禅，松下煎茶体现了"茶禅一味"的境界。',
  },
  {
    id: 'wanyan_chayan',
    title: '茶烟',
    author: '完颜', dynasty: '金',
    content: '茶烟袅袅绕松窗，一卷闲书对夕阳。莫道山中无岁月，且将清茗润枯肠。',
    description: '茶烟书卷夕阳，一幅静谧山居图。',
  },
  {
    id: 'zhangdai_chafan',
    title: '陶庵梦忆（节选）',
    author: '张岱', dynasty: '明末清初',
    content: '余尝见一贵人，饮茶三碗而神采顿生，曰：此非茶，乃灵液也。',
    description: '张岱记贵人饮茶感受——"非茶，乃灵液也"。',
  },
  {
    id: 'xukai_qilei',
    title: '煎茶七类',
    author: '徐渭', dynasty: '明',
    content: '茶宜精舍，宜云林，宜瓷瓶，宜竹灶，宜幽人雅士，宜衲子仙朋。',
    description: '徐渭提出七个品茶之宜，从环境到伴侣皆有讲究。',
  },
  {
    id: 'caoxueqin_honglou',
    title: '红楼梦（节选）',
    author: '曹雪芹', dynasty: '清',
    content: '一杯为品，二杯即是解渴的蠢物，三杯便是饮牛饮骡了。',
    description: '《红楼梦》中最著名的茶论——品茶与饮茶的区别。',
  },
  {
    id: 'zhengbanqiao_zhuzhi',
    title: '竹枝词·茶馆',
    author: '郑板桥', dynasty: '清',
    content: '不风不雨正清和，翠竹亭亭好节柯。最爱晚凉佳客至，一壶新茗泡松萝。',
    description: '郑板桥以茶待客的清新画面，"一壶新茗泡松萝"尽显风雅。',
  },
  {
    id: 'yuanmei_chajiu',
    title: '茶酒论',
    author: '袁枚', dynasty: '清',
    content: '茶好酒醇何必酒，茶香醉人何须酒。一杯清茗酬知己，半卷闲书度春秋。',
    relatedTeaIds: ['dahongpao'],
    description: '袁枚以茶代酒的洒脱，"茶香醉人何须酒"。',
  },
]
