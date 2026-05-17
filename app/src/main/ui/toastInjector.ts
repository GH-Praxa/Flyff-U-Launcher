/**
 * Toast-Injektor
 *
 * Zeigt einen kurzlebigen Toast auf einer beliebigen `WebContents` an —
 * unabhaengig davon, ob dort unser eigener Renderer oder eine Fremdseite
 * (z. B. die Flyff-Spielseite) geladen ist.
 *
 * Umsetzung via `webContents.executeJavaScript()`: Das ist eine
 * Electron-Runtime-API und wird NICHT durch die Content-Security-Policy der
 * Zielseite blockiert (anders als ein injizierter `<script>`-Tag). Der
 * injizierte Code ist bewusst selbsttragend: kein Zugriff auf App-CSS, keine
 * `<style>`-Elemente, alle Styles direkt per `element.style.*` (CSP-sicher),
 * Text ausschliesslich via `textContent` (kein XSS).
 */

import type { WebContents } from "electron";

export type ToastTone = "info" | "success" | "error";

const TONE_BG: Record<ToastTone, string> = {
    info: "#2563eb",
    success: "#16a34a",
    error: "#dc2626",
};

/**
 * Injiziert einen Toast in die uebergebene `WebContents`.
 * Fehler (Seite navigiert gerade, noch nicht geladen, zerstoert) werden
 * verschluckt — ein fehlgeschlagener Toast darf nie etwas anderes stoeren.
 */
export function injectToast(
    wc: WebContents | null | undefined,
    message: string,
    tone: ToastTone = "info",
    ttlMs = 5000,
): void {
    if (!wc || wc.isDestroyed()) return;

    const bg = TONE_BG[tone] ?? TONE_BG.info;
    const ttl = Math.max(800, Number.isFinite(ttlMs) ? ttlMs : 5000);
    // Alle dynamischen Werte sicher als JSON in den Snippet-String einbetten.
    const payload = JSON.stringify({ message: String(message ?? ""), bg, ttl });

    const js = `(function(){try{
  var d=document; if(!d||!d.body){return;}
  var p=${payload};
  var CID='__lch_toast_container';
  var c=d.getElementById(CID);
  if(!c){
    c=d.createElement('div'); c.id=CID;
    var cs=c.style;
    cs.position='fixed'; cs.top='16px'; cs.right='16px'; cs.zIndex='2147483647';
    cs.display='flex'; cs.flexDirection='column'; cs.gap='8px';
    cs.pointerEvents='none'; cs.maxWidth='360px';
    d.body.appendChild(c);
  }
  var t=d.createElement('div');
  t.textContent=p.message;
  var ts=t.style;
  ts.background=p.bg; ts.color='#ffffff';
  ts.font='600 13px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  ts.padding='10px 14px'; ts.borderRadius='8px';
  ts.boxShadow='0 4px 16px rgba(0,0,0,0.35)';
  ts.opacity='0'; ts.transform='translateY(-8px)';
  ts.transition='opacity .18s ease, transform .18s ease';
  ts.wordBreak='break-word';
  c.appendChild(t);
  requestAnimationFrame(function(){ ts.opacity='1'; ts.transform='translateY(0)'; });
  setTimeout(function(){
    ts.opacity='0'; ts.transform='translateY(-8px)';
    setTimeout(function(){
      if(t.parentNode){ t.parentNode.removeChild(t); }
      if(c && !c.childElementCount && c.parentNode){ c.parentNode.removeChild(c); }
    }, 220);
  }, p.ttl);
}catch(e){/* ignore */}})();`;

    wc.executeJavaScript(js, true).catch(() => {
        /* Seite navigiert / noch nicht bereit — Toast wird stillschweigend verworfen. */
    });
}
