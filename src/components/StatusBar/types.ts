/**
 * Status Bar Types
 *
 * The status bar is hidden by default and reserved for plugin widgets.
 */

export type StatusBarItemPosition = "left" | "center" | "right";

export interface StatusBarItem {
  id: string;
  content: React.ReactNode;
  position: StatusBarItemPosition;
  priority?: number; // Higher = more to the edge
  onClick?: () => void;
  tooltip?: string;
}

export interface StatusBarProps {
  visible: boolean;
  items?: StatusBarItem[];
}
