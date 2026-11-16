export type PaperStatus = "read" | "reading" | "unread";

export interface PaperRaw {
  id: number;
  title: string;
  byline: string;
  year: string;
  venue: string;
  citations: number;
  tag: string;
  status: PaperStatus;
}

export interface MessageRaw {
  role: "user" | "ai";
  name: string;
  time: string;
  text: string;
  cites?: string[];
}

export interface MessageVal extends MessageRaw {
  avatar: string;
  rowStyle: string;
  avatarStyle: string;
  bubbleStyle: string;
  hasCite: boolean;
  cites: string[];
}

export interface TagVal {
  label: string;
  toggle: () => void;
  style: string;
}

export interface PaperVal extends PaperRaw {
  toggle: () => void;
  cardStyle: string;
  checkStyle: string;
  checkMark: string;
  statusLabel: string;
  statusStyle: string;
  dotStyle: string;
}

export interface FilterVal {
  label: string;
  select: () => void;
  style: string;
}

export interface NavVal {
  label: string;
  icon: string;
  count: string;
  select: () => void;
  style: string;
}

export interface ResearchCardVal {
  title: string;
  meta: string;
  status: string;
  updated: string;
  icon: string;
  open: () => void;
  iconStyle: string;
  statusStyle: string;
}

export interface EnvVal {
  id: string;
  label: string;
  meta: string;
  icon: string;
  select: () => void;
  style: string;
  iconStyle: string;
  radioStyle: string;
  dotStyle: string;
}

/** Shared shape for the agent builder's sources / skills / tools toggle grids. */
export interface ToggleItemVal {
  label: string;
  meta: string;
  icon: string;
  toggle: () => void;
  style: string;
  checkStyle: string;
  check: string;
  iconStyle: string;
}

export interface ModelVal {
  name: string;
  desc: string;
  select: () => void;
  style: string;
  nameStyle: string;
}

export interface AutonomyVal {
  label: string;
  select: () => void;
  style: string;
}

export interface TargetVal {
  label: string;
  icon: string;
  select: () => void;
  style: string;
}

export interface PresetVal {
  label: string;
  pick: () => void;
}

export interface MenuItemVal {
  icon: string;
  label: string;
  style: string;
}

export interface ForestVal {
  label: string;
  value: string;
  /** CI band center/width, in percent of the row's width — plain numbers, not pre-baked CSS. */
  center: number;
  width: number;
}

export interface TableRowVal {
  name: string;
  k: string;
  g: string;
  ci: string;
}
