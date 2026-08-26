import {
  BookOpen,
  CalendarDays,
  ChartCandlestick,
  CheckSquare2,
  Cpu,
  Dumbbell,
  Eye,
  FileSearch,
  Languages,
  Mail,
  Newspaper,
  NotebookTabs,
  Salad,
  ScanSearch,
  Sparkles,
  Sun,
  TrendingUp,
} from "lucide-react";
import type { AutomationIcon as AutomationIconName } from "./automation-presets";
import { cn } from "@/lib/utils";

const ICONS = {
  sun: Sun,
  chip: Cpu,
  droplet: TrendingUp,
  eye: Eye,
  mail: Mail,
  review: NotebookTabs,
  tasks: CheckSquare2,
  calendar: CalendarDays,
  stocks: ChartCandlestick,
  earnings: Newspaper,
  scan: ScanSearch,
  paper: FileSearch,
  book: BookOpen,
  workout: Dumbbell,
  meal: Salad,
  language: Languages,
} as const;

export function AutomationIcon({
  name,
  className,
}: {
  name?: AutomationIconName;
  className?: string;
}) {
  const Icon = name ? ICONS[name] : Sparkles;
  return <Icon className={cn("size-5", className)} strokeWidth={1.65} />;
}
