import React, { useEffect, useMemo, useState } from "react";
import type { Profile } from "../shared/types";
import aibattGold from "../assets/icons/aibatt_gold.png";
declare global {
    interface Window {
        api: {
            invoke: (channel: string, ...args: any[]) => Promise<any>;
        };
    }
}
export function ProfilesList() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    async function refresh() {
        const ps = await window.api.invoke("profiles:list");
        setProfiles(ps);
    }
    useEffect(() => {
        refresh().catch(console.error);
    }, []);
    const overlayTargetId = useMemo(() => profiles.find((p) => p.overlayTarget)?.id ?? null, [profiles]);
    async function toggleOverlayTarget(profileId: string) {
        const isAlreadyTarget = overlayTargetId === profileId;
        const payload = isAlreadyTarget
            ? { profileId: null }
            : { profileId, iconKey: "aibatt-gold" };
        const next = await window.api.invoke("profiles:setOverlayTarget", payload);
        setProfiles(next);
    }
    return (<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {profiles.map((p) => {
            const active = p.overlayTarget === true;
            return (<div key={p.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.06)",
                }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                Mode: {p.launchMode}
              </div>
            </div>

            
            <button onClick={() => toggleOverlayTarget(p.id)} title={active ? "Overlay-Ziel (klicken zum deaktivieren)" : "Als Overlay-Ziel markieren"} style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: active ? "rgba(255,215,0,0.18)" : "rgba(0,0,0,0.25)",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                }}>
              <img src={aibattGold} alt="Overlay Target" style={{
                    width: 20,
                    height: 20,
                    opacity: active ? 1 : 0.35,
                    filter: active ? "none" : "grayscale(100%)",
                }}/>
            </button>
          </div>);
        })}
    </div>);
}
