/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
export {};

declare global {
  interface Window {
    api: {
      profilesList: () => Promise<{ id: string; name: string; createdAt: string }[]>;
      profilesUpdate: (patch: { id: string; name?: string; job?: string; launchMode?: "tabs" | "window" }) => Promise<any>;
      openDefault: (profileId: string) => Promise<boolean>;
      profilesCreate: (name: string) => Promise<{ id: string; name: string; createdAt: string }>;
      profilesDelete: (id: string) => Promise<boolean>;
      profilesClone: (sourceId: string, nameOverride?: string) => Promise<Profile | null>;



      openTab: (profileId: string) => Promise<boolean>;
      openWindow: (profileId: string) => Promise<boolean>;

      onOpenTab: (cb: (profileId: string) => void) => void;
      profilesReorder: (orderedIds: string[]) => Promise<boolean>;

    };
  }
}
