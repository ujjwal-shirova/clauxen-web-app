"use client";

import type { ComponentType, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Bootstrap Icons rendered as an icon font. These components keep the same
 * names as the lucide icons they replaced so call sites stay unchanged.
 */
export interface LucideProps extends Omit<HTMLAttributes<HTMLElement>, "color"> {
  size?: number | string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  fill?: string;
  stroke?: string;
  color?: string;
  width?: number | string;
  height?: number | string;
  viewBox?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  fillRule?: string;
  clipRule?: string;
  fillOpacity?: number | string;
  strokeOpacity?: number | string;
}

export type LucideIcon = ComponentType<LucideProps>;

function createBootstrapIcon(name: string) {
  function BootstrapGlyph({
    className,
    size,
    style,
    color,
    /* SVG-only props accepted for lucide compatibility are ignored. */
    strokeWidth: _strokeWidth,
    absoluteStrokeWidth: _absoluteStrokeWidth,
    fill: _fill,
    stroke: _stroke,
    width: _width,
    height: _height,
    viewBox: _viewBox,
    strokeLinecap: _strokeLinecap,
    strokeLinejoin: _strokeLinejoin,
    fillRule: _fillRule,
    clipRule: _clipRule,
    fillOpacity: _fillOpacity,
    strokeOpacity: _strokeOpacity,
    ...props
  }: LucideProps) {
    const fontSize =
      size == null
        ? undefined
        : typeof size === "number"
          ? `${size}px`
          : size;

    return (
      <i
        className={cn("bi", `bi-${name}`, className)}
        style={{
          ...(fontSize ? { fontSize } : null),
          ...(color ? { color } : null),
          ...style,
        }}
        aria-hidden="true"
        {...props}
      />
    );
  }

  BootstrapGlyph.displayName = `BootstrapIcon(${name})`;
  return BootstrapGlyph;
}

export const Archive = createBootstrapIcon("archive");
export const ArrowDown = createBootstrapIcon("arrow-down");
export const ArrowLeft = createBootstrapIcon("arrow-left");
export const ArrowRight = createBootstrapIcon("arrow-right");
export const ArrowUp = createBootstrapIcon("arrow-up");
export const ArrowUpCircle = createBootstrapIcon("arrow-up-circle");
export const ArrowUpRight = createBootstrapIcon("arrow-up-right");
export const AudioWaveform = createBootstrapIcon("soundwave");
export const Bell = createBootstrapIcon("bell");
export const Blocks = createBootstrapIcon("boxes");
export const BookLock = createBootstrapIcon("book");
export const BookOpen = createBootstrapIcon("book");
export const Boxes = createBootstrapIcon("boxes");
export const Brain = createBootstrapIcon("cpu");
export const Briefcase = createBootstrapIcon("briefcase");
export const ChartColumn = createBootstrapIcon("bar-chart-line");
export const Check = createBootstrapIcon("check2");
export const CheckCircle = createBootstrapIcon("check-circle-fill");
export const ChevronDown = createBootstrapIcon("chevron-down");
export const ChevronLeft = createBootstrapIcon("chevron-left");
export const ChevronRight = createBootstrapIcon("chevron-right");
export const ChevronUp = createBootstrapIcon("chevron-up");
export const ChevronsUpDown = createBootstrapIcon("chevron-expand");
export const Circle = createBootstrapIcon("circle");
export const ClockHistory = createBootstrapIcon("clock-history");
export const Code2 = createBootstrapIcon("code-slash");
export const Contact = createBootstrapIcon("person-vcard");
export const Copy = createBootstrapIcon("copy");
export const CornerDownLeft = createBootstrapIcon("arrow-return-left");
export const CornerDownRight = createBootstrapIcon("arrow-return-right");
export const CreditCard = createBootstrapIcon("credit-card");
export const Database = createBootstrapIcon("database");
export const DollarSign = createBootstrapIcon("currency-dollar");
export const Download = createBootstrapIcon("download");
export const Dumbbell = createBootstrapIcon("activity");
export const Edit2 = createBootstrapIcon("pencil");
export const ExternalLink = createBootstrapIcon("box-arrow-up-right");
export const Eye = createBootstrapIcon("eye");
export const AlertTriangle = createBootstrapIcon("exclamation-triangle");
export const File = createBootstrapIcon("file-earmark");
export const FileArchive = createBootstrapIcon("file-earmark-zip");
export const FileCode = createBootstrapIcon("file-earmark-code");
export const FileCode2 = createBootstrapIcon("file-earmark-code");
export const FileImage = createBootstrapIcon("file-earmark-image");
export const FileSpreadsheet = createBootstrapIcon("file-earmark-spreadsheet");
export const FileText = createBootstrapIcon("file-earmark-text");
export const Files = createBootstrapIcon("files");
export const Fingerprint = createBootstrapIcon("fingerprint");
export const FlaskConical = createBootstrapIcon("flask");
export const Flower2 = createBootstrapIcon("flower2");
export const Folder = createBootstrapIcon("folder");
export const FolderInput = createBootstrapIcon("folder-symlink");
export const FolderKanban = createBootstrapIcon("kanban");
export const FolderPlus = createBootstrapIcon("folder-plus");
export const Gauge = createBootstrapIcon("speedometer2");
export const Gift = createBootstrapIcon("gift");
export const Globe = createBootstrapIcon("globe2");
export const GraduationCap = createBootstrapIcon("mortarboard");
export const Hand = createBootstrapIcon("hand-index-thumb");
export const HardDrive = createBootstrapIcon("hdd");
export const HatGlasses = createBootstrapIcon("incognito");
export const Heart = createBootstrapIcon("heart");
export const HelpCircle = createBootstrapIcon("question-circle");
export const ImageIcon = createBootstrapIcon("image");
export const Info = createBootstrapIcon("info-circle");
export const KeyRound = createBootstrapIcon("key");
export const Keyboard = createBootstrapIcon("keyboard");
export const Landmark = createBootstrapIcon("bank");
export const Laptop = createBootstrapIcon("laptop");
export const Layers = createBootstrapIcon("layers");
export const LayoutGrid = createBootstrapIcon("grid");
export const Library = createBootstrapIcon("collection");
export const Lightbulb = createBootstrapIcon("lightbulb");
export const Link = createBootstrapIcon("link-45deg");
export const Link2 = createBootstrapIcon("link-45deg");
export const List = createBootstrapIcon("list-ul");
export const ListCheck = createBootstrapIcon("list-check");
export const Loader2 = createBootstrapIcon("arrow-repeat");
export const LoaderCircle = createBootstrapIcon("arrow-repeat");
export const Lock = createBootstrapIcon("lock");
export const LockKeyhole = createBootstrapIcon("lock");
export const LogIn = createBootstrapIcon("box-arrow-in-right");
export const LogOut = createBootstrapIcon("box-arrow-right");
export const Mail = createBootstrapIcon("envelope");
export const MapPin = createBootstrapIcon("geo-alt");
export const Maximize2 = createBootstrapIcon("arrows-angle-expand");
export const Menu = createBootstrapIcon("list");
export const MessageSquare = createBootstrapIcon("chat");
export const Mic = createBootstrapIcon("mic");
export const Microscope = createBootstrapIcon("search");
export const Minimize2 = createBootstrapIcon("arrows-angle-contract");
export const Minus = createBootstrapIcon("dash");
export const MoreHorizontal = createBootstrapIcon("three-dots");
export const MoreVertical = createBootstrapIcon("three-dots-vertical");
export const Music = createBootstrapIcon("music-note");
export const Palette = createBootstrapIcon("palette");
export const PanelLeft = createBootstrapIcon("layout-sidebar");
export const Paperclip = createBootstrapIcon("paperclip");
export const Pause = createBootstrapIcon("pause");
export const PawPrint = createBootstrapIcon("heart");
export const PenLine = createBootstrapIcon("pen");
export const PenTool = createBootstrapIcon("bezier");
export const Pencil = createBootstrapIcon("pencil");
export const Pin = createBootstrapIcon("pin");
export const PinOff = createBootstrapIcon("pin-angle");
export const Plane = createBootstrapIcon("airplane");
export const Play = createBootstrapIcon("play");
export const Plug = createBootstrapIcon("plug");
export const Plus = createBootstrapIcon("plus-lg");
export const Popcorn = createBootstrapIcon("film");
export const Puzzle = createBootstrapIcon("puzzle");
export const RotateCcw = createBootstrapIcon("arrow-counterclockwise");
export const Scale = createBootstrapIcon("rulers");
export const Scissors = createBootstrapIcon("scissors");
export const ScrollText = createBootstrapIcon("file-text");
export const Search = createBootstrapIcon("search");
export const Settings = createBootstrapIcon("gear");
export const Settings2 = createBootstrapIcon("sliders");
export const Share = createBootstrapIcon("share");
export const Share2 = createBootstrapIcon("share");
export const Shield = createBootstrapIcon("shield");
export const ShieldCheck = createBootstrapIcon("shield-check");
export const ShieldLock = createBootstrapIcon("shield-lock");
export const SlidersHorizontal = createBootstrapIcon("sliders");
export const SlidersVertical = createBootstrapIcon("sliders");
export const Smartphone = createBootstrapIcon("phone");
export const Sparkles = createBootstrapIcon("stars");
export const Sprout = createBootstrapIcon("tree");
export const Square = createBootstrapIcon("square");
export const SquarePen = createBootstrapIcon("pencil-square");
export const Star = createBootstrapIcon("star");
export const Stethoscope = createBootstrapIcon("heart-pulse");
export const Telescope = createBootstrapIcon("binoculars");
export const Terminal = createBootstrapIcon("terminal");
export const Trash2 = createBootstrapIcon("trash");
export const Upload = createBootstrapIcon("upload");
export const UserCheck = createBootstrapIcon("person-check");
export const UserPlus = createBootstrapIcon("person-plus");
export const UserRound = createBootstrapIcon("person-circle");
export const Wallet = createBootstrapIcon("wallet2");
export const Waypoints = createBootstrapIcon("diagram-3");
export const Wrench = createBootstrapIcon("wrench");
export const X = createBootstrapIcon("x-lg");
export const Zap = createBootstrapIcon("lightning");
