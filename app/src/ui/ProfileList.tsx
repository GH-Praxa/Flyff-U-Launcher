/* eslint-disable import/no-unresolved, @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import type { Profile } from "../shared/types";
import aibattGold from "../assets/icons/aibatt_gold.png";
import supporterIcon from "../assets/icons/supporter.png";
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
    const overlaySupportTargetId = useMemo(() => profiles.find((p) => p.overlaySupportTarget)?.id ?? null, [profiles]);
    async function toggleOverlayTarget(profileId: string) {
        const isAlreadyTarget = overlayTargetId === profileId;
        const next = await window.api.invoke("profiles:setOverlayTarget", isAlreadyTarget ? null : profileId, isAlreadyTarget ? undefined : "aibatt-gold");
        setProfiles(next);
    }
    async function toggleOverlaySupportTarget(profileId: string) {
        const isAlreadyTarget = overlaySupportTargetId === profileId;
        const next = await window.api.invoke("profiles:setOverlaySupportTarget", isAlreadyTarget ? null : profileId, isAlreadyTarget ? undefined : "supporter");
        setProfiles(next);
    }
    return (<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {profiles.map((p) => {
            const active = p.overlayTarget === true;
            const supportActive = p.overlaySupportTarget === true;
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
                    padding: 0,
                    overflow: "hidden",
                    cursor: "pointer",
                }}>
              <img src={aibattGold} alt="Overlay Target" style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    objectFit: "cover",
                    opacity: active ? 1 : 0.35,
                    filter: active ? "none" : "grayscale(100%)",
                }}/>
            </button>
            <button onClick={() => toggleOverlaySupportTarget(p.id)} title={supportActive ? "Support-Ziel (klicken zum deaktivieren)" : "Als Support-Ziel markieren"} style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: supportActive ? "rgba(120,214,196,0.2)" : "rgba(0,0,0,0.25)",
                    display: "grid",
                    placeItems: "center",
                    padding: 0,
                    overflow: "hidden",
                    cursor: "pointer",
                }}>
              <img src={supporterIcon} alt="Support Overlay Target" style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    objectFit: "cover",
                    opacity: supportActive ? 1 : 0.35,
                    filter: supportActive ? "none" : "grayscale(100%)",
                }}/>
            </button>
          </div>);
        })}
    </div>);
}
