import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  FolderOpen,
  CalendarDays,
  FlaskConical,
  Timer,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/grades", label: "Grades", icon: GraduationCap },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/resources", label: "Resources", icon: FolderOpen },
  { href: "/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/flashcards", label: "Study Lab", icon: FlaskConical },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/settings", label: "Settings", icon: Settings },
];
