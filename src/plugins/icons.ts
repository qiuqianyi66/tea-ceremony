/**
 * Lucide Vue Next 图标全局注册
 * 统一管理项目中使用的所有图标
 */

import type { App } from 'vue'
import {
  // 导航/通用
  Home,
  Menu,
  X,
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

  // 茶道相关
  Coffee,
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

  // 位置/地图
  MapPin,
  Navigation,
  Compass,

  // 文档/笔记
  FileText,
  BookOpen,
  Notebook,
  Clipboard,
  ClipboardList,

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

  // 品茶专用
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
  Flower2,

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
} from 'lucide-vue-next'

const icons = {
  // 导航/通用
  Home,
  Menu,
  X,
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
  Tea: Coffee,        // 茶叶/茶杯通用
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

  // 位置/地图
  MapPin,
  Navigation,
  Compass,

  // 文档/笔记
  FileText,
  BookOpen,
  Notebook,
  Clipboard,
  ClipboardList,

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