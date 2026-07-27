/**
 * 制茶工艺数据库
 * 六大茶类核心工艺流程
 */

export interface ProcessStep {
  order: number
  name: string
  description: string
  duration?: string
  temperature?: string
}

export interface TeaProcess {
  teaType: string
  name: string
  summary: string
  steps: ProcessStep[]
}

export const TEA_PROCESSES: TeaProcess[] = [
  {
    teaType: '绿茶',
    name: '绿茶制作工艺',
    summary: '绿茶为不发酵茶，核心工艺是"杀青"——通过高温破坏鲜叶中的氧化酶活性，保持茶叶的绿色。',
    steps: [
      { order: 1, name: '采摘', description: '采摘一芽一叶或一芽二叶，明前茶为品质最佳。采摘要"三不采"：不采雨水叶、不采病虫害叶、不采紫色叶。', duration: '春季3-4月', temperature: '常温' },
      { order: 2, name: '摊青', description: '鲜叶均匀摊放在竹席上，自然散失部分水分，使叶片柔软，便于后续杀青。', duration: '2-4小时' },
      { order: 3, name: '杀青', description: '在高温锅中翻炒鲜叶（炒青）或用蒸汽蒸制（蒸青），破坏氧化酶活性，停止发酵。锅温约200°C，手法有"抖、搭、捺、推"等。', duration: '5-10分钟', temperature: '180-220°C' },
      { order: 4, name: '揉捻', description: '将杀青后的茶叶趁热揉捻，使茶叶卷曲成条，同时揉出茶汁附着在叶面，增加冲泡时的滋味。', duration: '15-30分钟' },
      { order: 5, name: '干燥', description: '通过烘干或炒干进一步去除水分，固定茶形，提升香气。使含水量降至5%以下。', duration: '30-60分钟', temperature: '80-120°C' },
    ],
  },
  {
    teaType: '白茶',
    name: '白茶制作工艺',
    summary: '白茶为微发酵茶，制作工艺最为自然简洁——不炒不揉，只经萎凋和干燥，最大程度保留了茶叶的本真。',
    steps: [
      { order: 1, name: '采摘', description: '白毫银针只采单芽，白牡丹采一芽一二叶。采摘要选择晴朗天气，保证萎凋品质。', duration: '春季3-4月' },
      { order: 2, name: '萎凋', description: '将鲜叶均匀摊放在竹帘上，置于通风处自然萎凋。这是白茶品质形成的关键步骤，需要72小时左右。期间茶叶缓慢失水，内含物质发生微妙转化。', duration: '48-72小时', temperature: '20-30°C' },
      { order: 3, name: '干燥', description: '用文火低温烘干，进一步去除水分，固定品质。传统用焙笼炭火烘焙。', duration: '1-2小时', temperature: '40-50°C' },
    ],
  },
  {
    teaType: '黄茶',
    name: '黄茶制作工艺',
    summary: '黄茶的独特之处在于"闷黄"——在杀青后用湿布包裹茶叶，让其在湿热条件下发生非酶性氧化，使茶叶和汤色变成黄色。',
    steps: [
      { order: 1, name: '采摘', description: '采摘一芽一叶或一芽二叶，以春茶品质最佳。', duration: '春季' },
      { order: 2, name: '杀青', description: '与绿茶类似，用高温破坏氧化酶活性。温度略低于绿茶。', temperature: '160-180°C' },
      { order: 3, name: '闷黄', description: '将杀青后的茶叶用湿纸或湿布包裹，放置数小时至数天。在温热条件下，叶绿素被破坏，叶色由绿变黄，形成黄茶特有的"黄叶黄汤"。', duration: '4-48小时', temperature: '30-40°C' },
      { order: 4, name: '干燥', description: '低温慢烘，固定色香味。', duration: '1-2小时' },
    ],
  },
  {
    teaType: '青茶',
    name: '乌龙茶（青茶）制作工艺',
    summary: '乌龙茶为半发酵茶，制作工艺最为复杂精细——通过"做青"使叶缘发酵形成"绿叶红镶边"的独特品质。萎凋、摇青、炒青、揉捻、烘焙等工序环环相扣。',
    steps: [
      { order: 1, name: '采摘', description: '采摘开面三四叶，以晴天的下午采摘要最佳。岩茶讲究"三不采"：不采雨水青、不采露水青、不采烈日青。', duration: '春秋两季' },
      { order: 2, name: '萎凋', description: '将鲜叶薄摊于竹筛上，置于日光下或室内自然萎凋，使叶片柔软、水分蒸发。', duration: '1-2小时' },
      { order: 3, name: '做青（摇青）', description: '将茶叶放入竹制摇笼中交替进行"摇青"和"静置"——摇青使叶缘碰撞破裂，静置使内含物质转化。这个过程需要重复5-10次，持续8-12小时。乌龙茶的香气和品质在此阶段形成。', duration: '8-12小时' },
      { order: 4, name: '杀青', description: '用高温炒锅破坏发酵酶的活性，固定做青成果，停止发酵。', duration: '5-8分钟', temperature: '200-240°C' },
      { order: 5, name: '揉捻', description: '趁热将茶叶揉捻成条（包揉），使茶汁渗出，卷曲紧结。', duration: '15-30分钟' },
      { order: 6, name: '初烘', description: '初步烘焙去除水分，固定形状。', duration: '30-60分钟', temperature: '80-100°C' },
      { order: 7, name: '复焙（炭焙）', description: '这是岩茶品质升华的关键步骤。用炭火长时间低温慢焙，使茶香内敛、汤感醇厚。不同火工（轻火/中火/足火）决定乌龙茶的风格。', duration: '2-8小时', temperature: '60-120°C' },
    ],
  },
  {
    teaType: '红茶',
    name: '红茶制作工艺',
    summary: '红茶为全发酵茶，核心工艺是"发酵"——在适宜温湿度下让茶叶充分氧化，使茶汤和叶底呈现红色，形成甜醇的风味。',
    steps: [
      { order: 1, name: '采摘', description: '采摘一芽二三叶，以春茶和秋茶品质最佳。', duration: '春、夏、秋三季' },
      { order: 2, name: '萎凋', description: '将鲜叶摊放在萎凋槽中，通热风促进水分蒸发，使叶片柔软、香气显露。', duration: '6-12小时' },
      { order: 3, name: '揉捻', description: '用揉捻机使茶叶卷曲成条，破坏叶细胞结构，使茶汁外溢，促进发酵。', duration: '30-60分钟' },
      { order: 4, name: '发酵', description: '在发酵室中保持高湿度（95%以上）和适宜温度，茶叶在酶的作用下充分氧化。叶色由绿转红，香气由青草香变为花果香。', duration: '2-5小时', temperature: '25-30°C' },
      { order: 5, name: '干燥', description: '高温烘干终止发酵，固定品质，使含水量降至5%以下。', duration: '30-60分钟', temperature: '90-120°C' },
    ],
  },
  {
    teaType: '黑茶',
    name: '黑茶制作工艺',
    summary: '黑茶为后发酵茶，核心工艺是"渥堆"——将茶叶堆放在一起洒水，在微生物作用下进行发酵。普洱熟茶的"渥堆发酵"是黑茶中最具代表性的工艺。',
    steps: [
      { order: 1, name: '采摘', description: '采摘一芽三四叶或对夹叶，以粗老叶片为主。', duration: '夏秋季为主' },
      { order: 2, name: '杀青', description: '用高温铁锅翻炒杀青，破坏氧化酶活性。', temperature: '180-200°C' },
      { order: 3, name: '揉捻', description: '趁热揉捻成条，使茶汁渗出。黑茶的揉捻一般较重。', duration: '20-40分钟' },
      { order: 4, name: '渥堆（核心）', description: '将揉捻后的茶叶堆成一定厚度（30-50厘米），洒水后盖上湿布，在微生物和湿热作用下后发酵。期间堆温会自然上升到50-65°C，需要定期翻堆控制温湿度。这是普洱茶"越陈越香"品质形成的关键。', duration: '45-60天', temperature: '50-65°C' },
      { order: 5, name: '干燥', description: '自然晾干或低温烘干，使含水量降至12%以下。', duration: '3-7天' },
      { order: 6, name: '紧压（可选）', description: '将干燥后的茶叶蒸软后压制成饼、砖、沱等形状，便于存放和运输。', duration: '根据形状' },
    ],
  },
]

/** 根据茶类名称获取工艺 */
export function getProcessByTeaType(teaType: string): TeaProcess | undefined {
  return TEA_PROCESSES.find(p => p.teaType === teaType)
}
