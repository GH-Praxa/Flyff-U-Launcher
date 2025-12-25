/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
export {};

type Rect = { x: number; y: number; width: number; height: number };

type Profile = {
  id: string;
  name: string;
  createdAt: string;
  job?: string;
  launchMode: "tabs" | "window";
  overlayTarget?: boolean;
  overlayIconKey?: string;
};

declare global {
  interface Window {
    api: {
      profilesList: () => Promise<Profile[]>;
      profilesCreate: (name: string) => Promise<Profile[]>;
      profilesUpdate: (patch: Partial<Profile> & { id: string }) => Promise<Profile[]>;
      profilesDelete: (id: string) => Promise<Profile[]>;
      profilesClone: (sourceId: string, newName: string) => Promise<Profile[]>;
      profilesReorder: (orderedIds: string[]) => Promise<Profile[]>;
      profilesSetOverlayTarget: (profileId: string | null, iconKey?: string) => Promise<Profile[]>;

      openTab: (profileId: string) => Promise<boolean>;
      openWindow: (profileId: string) => Promise<boolean>;

      sessionTabsOpen: (profileId: string) => Promise<boolean>;
      sessionTabsSwitch: (profileId: string) => Promise<boolean>;
      sessionTabsClose: (profileId: string) => Promise<boolean>;
      sessionTabsSetBounds: (bounds: Rect) => Promise<boolean>;
      sessionTabsSetVisible: (visible: boolean) => Promise<boolean>;
      sessionTabsSetSplit: (pair: { primary: string; secondary: string; ratio?: number } | null) => Promise<boolean>;
      sessionTabsSetSplitRatio: (ratio: number) => Promise<boolean>;

      onOpenTab: (cb: (profileId: string) => void) => void;
      onSessionActiveChanged: (cb: (profileId: string | null) => void) => void;

      roiOpen: (profileId: string) => Promise<boolean>;
      roiLoad: (profileId: string) => Promise<any>;
      roiSave: (profileId: string, rois: any) => Promise<boolean>;

      fetchNewsPage: () => Promise<string>;
      fetchNewsArticle: (url: string) => Promise<string>;
    };
  }
}
