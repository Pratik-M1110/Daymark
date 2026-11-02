import {
  Bike, BookOpen, Brain, Coffee, Droplets, Dumbbell, Flower2, Footprints, Heart, Leaf, MoonStar, Music, Pencil,
  Smile, Sun, Target,
  type LucideIcon,
} from 'lucide-react'
import type { RepeatKind, Tone } from './api'

export type Page = 'Today' | 'Calendar' | 'Habits' | 'Routines' | 'Insights' | 'Settings'

export const TONES: Tone[] = ['violet', 'rose', 'amber', 'emerald', 'sky', 'coral', 'teal', 'slate']

export type AccentKey = 'aurora' | 'ocean' | 'sunset' | 'forest' | 'blossom' | 'graphite'

export const ACCENTS: { key: AccentKey; label: string; from: string; to: string }[] = [
  { key: 'aurora', label: 'Aurora', from: '#6d5efc', to: '#b06bff' },
  { key: 'ocean', label: 'Ocean', from: '#1f8ef1', to: '#19c3b4' },
  { key: 'sunset', label: 'Sunset', from: '#ff6a3d', to: '#ffb347' },
  { key: 'forest', label: 'Forest', from: '#1fa66a', to: '#8fd14f' },
  { key: 'blossom', label: 'Blossom', from: '#f0588c', to: '#ff9ecb' },
  { key: 'graphite', label: 'Graphite', from: '#4b5675', to: '#8a93ad' },
]

export const REPEATS: { value: RepeatKind; label: string }[] = [
  { value: 'HABIT_DAYS', label: 'On habit days' },
  { value: 'DAILY', label: 'Every day' },
  { value: 'CUSTOM_DAYS', label: 'Custom days' },
  { value: 'EVERY_N_DAYS', label: 'Every N days' },
]

export const UNITS = ['km', 'min', 'pages', 'glasses', 'reps', 'steps', 'kcal', 'hours']

export const ICONS: Record<string, LucideIcon> = {
  flower: Flower2,
  book: BookOpen,
  water: Droplets,
  moon: MoonStar,
  dumbbell: Dumbbell,
  heart: Heart,
  coffee: Coffee,
  music: Music,
  pencil: Pencil,
  sun: Sun,
  bike: Bike,
  leaf: Leaf,
  brain: Brain,
  steps: Footprints,
  smile: Smile,
  target: Target,
}

export const SUGGESTIONS = [
  { name: 'Drink water', category: 'Health', icon: 'water', goal: '8 glasses', trackType: 'MEASURABLE' as const, targetValue: 8, unit: 'glasses' },
  { name: 'Read 20 minutes', category: 'Mind', icon: 'book', goal: '20 min', trackType: 'MEASURABLE' as const, targetValue: 20, unit: 'min' },
  { name: 'Move your body', category: 'Movement', icon: 'dumbbell', goal: '30 min', trackType: 'MEASURABLE' as const, targetValue: 30, unit: 'min' },
  { name: 'Evening journal', category: 'Wellbeing', icon: 'pencil', goal: 'Once', trackType: 'YES_NO' as const, targetValue: null, unit: null },
]
