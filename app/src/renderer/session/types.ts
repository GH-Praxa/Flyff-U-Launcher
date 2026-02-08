import { GRID_CONFIGS } from "../../shared/constants";

export type LayoutType = keyof typeof GRID_CONFIGS;

export type GridCell = { id: string; position: number };

export type LayoutState = {
    type: LayoutType;
    cells: GridCell[];
    ratio?: number;
    activePosition?: number;
};

export type TabKind = "single" | "layout";

export type Tab = {
    id: string;
    type: TabKind;
    profileId: string;
    layout: LayoutState | null;
    name: string;
    tabBtn: HTMLButtonElement | null;
    cellButtons: Map<string, HTMLButtonElement>;
    loggedOut: Set<string>;
};

export type CloseChoice = "tab" | "dissolve" | "window" | "app" | "cancel";

export type CloseTarget =
    | { kind: "single"; profileId: string }
    | { kind: "layout"; tabId: string; profileIds: string[] };
