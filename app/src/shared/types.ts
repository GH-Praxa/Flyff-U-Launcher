export type LaunchMode = "tabs" | "window";

export type Profile = {
  id: string;
  name: string;
  createdAt: string;
  job?: string;
  launchMode: "tabs" | "window";

  overlayTarget?: boolean;   // genau EINS true
  overlayIconKey?: string;   // z.B. "aibatt-gold"
};


export type ViewBounds = { x: number; y: number; width: number; height: number };

export type ProfilePatch = { id: string; name?: string; job?: string; launchMode?: LaunchMode };

export type TabLayoutSplit = { leftId: string; rightId: string; ratio?: number };

export type TabLayout = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tabs: string[];
  split?: TabLayoutSplit | null;
  activeId?: string | null;
};
