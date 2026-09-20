/**
 * Lucide Vue Next 图标全局注册
 * 统一管理项目中使用的所有图标
 */

import {
  Activity,
  AlertCircle,
  Angry,
  Apple,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  // 数据/图表
  BarChart,
  Battery,
  BatteryLow,
  Beaker,
  // 通知/消息
  Bell,
  BellOff,
  BookOpen,
  // AI/角色
  Bot,
  Calendar,
  Carrot,
  // 状态/反馈
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clipboard,
  ClipboardList,
  // 时间/日历
  Clock,
  // 天气
  Cloud,
  CloudRain,
  CloudSun,
  // 茶道相关
  Coffee,
  Compass,
  // 食物/饮品
  Cookie,
  Copy,
  Crown,
  CupSoda,
  DoorOpen,
  Download,
  Droplet,
  Droplets,
  Edit,
  Eye,
  // 文档/笔记
  FileText,
  Flag,
  Flame,
  FlaskConical,
  Flower2,
  Frown,
  Gem,
  Grip,
  GripVertical,
  Hammer,
  Heart,
  History,
  // 导航/通用
  Home,
  Inbox,
  Info,
  Landmark,
  // 表情/情感
  Laugh,
  Leaf,
  Lightbulb,
  Loader2,
  // 状态/权限
  Lock,
  LogIn,
  LogOut,
  Mail,
  // biome-ignore lint/suspicious/noShadowRestrictedNames: lucide-vue-next 图标导出名 Map，遮蔽全局属预期
  Map,
  // 位置/地图
  MapPin,
  Medal,
  Meh,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  Minus,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Mountain,
  Music,
  Navigation,
  Notebook,
  Paintbrush,
  Palette,
  PauseCircle,
  // 书写/绘画
  PenLine,
  PieChart,
  PlayCircle,
  // 交互/动作
  Plus,
  RefreshCw,
  Ribbon,
  // 品茶专用
  Scale,
  ScrollText,
  Search,
  Settings,
  Share2,
  Signal,
  SignalLow,
  Smile,
  Sparkle,
  Sparkles,
  Sprout,
  Star,
  StopCircle,
  Sun,
  Sunrise,
  Target,
  Thermometer,
  Timer,
  Trash2,
  // 自然/植物
  TreePine,
  TrendingDown,
  TrendingUp,
  Trophy,
  Upload,
  // 用户/个人
  User,
  UserPlus,
  Users,
  // 媒体/声音
  Volume2,
  VolumeX,
  Waves,
  Wheat,
  Wifi,
  WifiOff,
  Wind,
  // 系统/工具
  Wrench,
  X,
  Zap,
} from 'lucide-vue-next'
import type { App } from 'vue'

const icons = {
  // 导航/通用
  Home,
  Menu,
  X,
  DoorOpen,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Search,
  Settings,
  MoreHorizontal,
  MoreVertical,
  Grip,
  GripVertical,

  // 茶道核心
  Tea: Coffee, // 茶叶/茶杯通用
  Leaf,
  Droplet,
  Flame,
  CupSoda,
  Beaker,
  FlaskConical,

  // 交互/动作
  Plus,
  Minus,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  Share2,
  Heart,
  Star,
  Award,
  Target,
  Zap,
  Sparkles,

  // 状态/反馈
  Check,
  CheckCircle,
  AlertCircle,
  Info,
  Loader2,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  StopCircle,

  // 时间/日历
  Clock,
  Calendar,
  History,
  Timer,

  // 用户/个人
  User,
  Users,
  LogIn,
  LogOut,
  UserPlus,

  // 数据/图表
  BarChart,
  TrendingUp,
  TrendingDown,
  Activity,
  PieChart,

  // 媒体/声音
  Volume2,
  VolumeX,
  Music,
  Mic,
  MicOff,

  // 书写/绘画
  PenLine,
  Sunrise,
  Palette,
  Paintbrush,

  // 表情/情感
  Laugh,
  Smile,
  Meh,
  Frown,
  Angry,

  // 位置/地图
  MapPin,
  Navigation,
  Compass,
  Map,
  Mountain,

  // 文档/笔记
  FileText,
  BookOpen,
  Notebook,
  Clipboard,
  ClipboardList,
  ScrollText,

  // AI/角色
  Bot,

  // 状态/权限
  Lock,
  Lightbulb,

  // 系统/工具
  Wrench,
  Hammer,
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  Signal,
  SignalLow,

  // 通知/消息
  Bell,
  BellOff,
  MessageSquare,
  Mail,
  Inbox,

  // 品茶专用语义化别名
  Scale,
  Thermometer,
  Droplets,
  Wind,
  Sparkle,
  Gem,
  Crown,
  Medal,
  Trophy,
  Ribbon,
  Flag,

  // 自然/植物
  TreePine,
  Sprout,
  Flower: Flower2,

  // 天气
  Cloud,
  CloudSun,
  CloudRain,
  Sun,
  Moon,

  // 食物/饮品
  Cookie,
  Apple,
  Wheat,
  Carrot,
  Waves,
  Landmark,

  // 茶具语义化别名（映射到现有图标）
  Cup: CupSoda,
  Kettle: FlaskConical,
  Bowl: Beaker,
  Vase: FlaskConical,

  // 交互手势
  Move: Grip,
  Swipe: GripVertical,
  Drag: Grip,
} as const

export function registerIcons(app: App) {
  // 全局注册所有图标组件
  for (const [name, component] of Object.entries(icons)) {
    app.component(`Icon${name}`, component)
  }
}

// 导出类型供组件按需导入
export type IconName = keyof typeof icons

// 常用图标组合（语义化导出）
export const TeaIcons = {
  // 冲泡阶段
  heating: 'Flame',
  warming: 'Thermometer',
  rinsing: 'Droplets',
  steeping: 'CupSoda',
  pouring: 'Droplet',
  tasting: 'Coffee',

  // 茶器
  gaiwan: 'Bowl',
  yixing: 'Vase',
  glass: 'Cup',
  kettle: 'Kettle',

  // 评分维度
  bitterness: 'Minus',
  sweetness: 'Heart',
  aftertaste: 'Sparkle',
  body: 'Gem',
  aroma: 'Wind',
  rhyme: 'Activity',
  shape: 'Target',
  mind: 'Crown',

  // 成就/等级
  achievement: 'Award',
  levelUp: 'TrendingUp',
  xp: 'Zap',
  streak: 'Target',
  master: 'Crown',

  // 交互
  drag: 'Move',
  drop: 'ArrowDown',
  swipe: 'Swipe',
} as const

// 为了避免重复导入，提供统一的默认导出
export default {
  install: registerIcons,
  icons,
  TeaIcons,
}
