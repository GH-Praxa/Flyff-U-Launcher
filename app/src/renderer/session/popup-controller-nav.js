/**
 * Kompakte, eigenständige Controller-Navigation für die Tool-Popups
 * (Upgrade-Rechner, FCoin-Rechner, Einkaufsliste).
 *
 * Läuft als Inline-Script im Popup-Dokument — keine Imports, keine externen
 * Abhängigkeiten. Wird über `?raw` in tools-html.ts eingebunden und mit dem
 * CSP-Nonce des Popups in die Seite injiziert. Funktional eine abgespeckte
 * Variante von src/renderer/controller-nav/: Spatial-Nav + Fokus-Ring +
 * virtuelle Tastatur, ohne Scope-Stack (Popups haben keine verschachtelten
 * Modale).
 */
(function () {
  "use strict";
  if (window.__cnavPopupActive) return;
  window.__cnavPopupActive = true;

  var BTN_A = 0, BTN_B = 1, DPAD_UP = 12, DPAD_DOWN = 13, DPAD_LEFT = 14, DPAD_RIGHT = 15;
  var DEAD = 0.5, REPEAT_DELAY = 420, REPEAT_INT = 110, SCROLL_DEAD = 0.25, SCROLL_SPD = 16;

  var ring = document.createElement("div");
  ring.style.cssText =
    "position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;border-radius:9px;" +
    "opacity:0;z-index:2147483000;box-shadow:0 0 0 2px #0b1220,0 0 0 4px #3b7bff," +
    "0 0 14px 3px rgba(44,107,255,.6);transition:transform .09s,width .09s,height .09s,opacity .12s;";
  document.body.appendChild(ring);

  var focused = null, vk = null, vkTarget = null, vkShift = false;
  var prev = [], heldDir = null, nextRep = 0;

  function visible(el) {
    if (el.hidden || el.disabled) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    var s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none") return false;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    return true;
  }
  function focusables() {
    var root = vk || document;
    var sel = vk ? ".cnavpKey" : "button,input:not([type=hidden]),select,textarea,a[href],[tabindex]";
    return [].slice.call(root.querySelectorAll(sel)).filter(visible);
  }
  function center(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function refreshRing() {
    if (!focused || !focused.isConnected) { ring.style.opacity = "0"; return; }
    var r = focused.getBoundingClientRect();
    ring.style.opacity = "1";
    ring.style.transform = "translate(" + r.left + "px," + r.top + "px)";
    ring.style.width = r.width + "px";
    ring.style.height = r.height + "px";
  }
  function setFocus(el) {
    focused = el;
    if (el) {
      try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      try { el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { /* ignore */ }
    }
    refreshRing();
  }
  function move(dir) {
    var list = focusables();
    if (!list.length) return;
    if (!focused || !visible(focused) || (vk && list.indexOf(focused) < 0)) {
      list.sort(function (a, b) {
        var ca = center(a), cb = center(b);
        return (ca.y - cb.y) || (ca.x - cb.x);
      });
      setFocus(list[0]);
      return;
    }
    var from = center(focused), best = null, bestScore = Infinity;
    for (var i = 0; i < list.length; i++) {
      if (list[i] === focused) continue;
      var to = center(list[i]), dx = to.x - from.x, dy = to.y - from.y, primary, perp;
      if (dir === "up") { primary = -dy; perp = Math.abs(dx); }
      else if (dir === "down") { primary = dy; perp = Math.abs(dx); }
      else if (dir === "left") { primary = -dx; perp = Math.abs(dy); }
      else { primary = dx; perp = Math.abs(dy); }
      if (primary <= 1) continue;
      var score = primary + perp * 2;
      if (score < bestScore) { bestScore = score; best = list[i]; }
    }
    if (best) setFocus(best);
  }

  function isText(el) {
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName !== "INPUT") return false;
    return ["text", "search", "number", "email", "password", "url", "tel"].indexOf(el.type) >= 0;
  }
  function sel(el) {
    try {
      var s = el.selectionStart, e = el.selectionEnd;
      if (s != null && e != null) return [s, e];
    } catch (x) { /* number/email */ }
    var l = el.value.length;
    return [l, l];
  }
  function typeRaw(txt) {
    if (!vkTarget) return;
    var t = vkTarget;
    if ((t.type === "number" || t.type === "tel") && !/^[0-9.,+\-]$/.test(txt)) return;
    var se = sel(t), v = t.value;
    t.value = v.slice(0, se[0]) + txt + v.slice(se[1]);
    try { t.setSelectionRange(se[0] + txt.length, se[0] + txt.length); } catch (x) { /* ignore */ }
    t.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function typeCh(ch) {
    var out = (vkShift && /[a-z]/i.test(ch)) ? ch.toUpperCase() : ch;
    typeRaw(out);
    if (vkShift && /[a-z]/i.test(ch)) { vkShift = false; relabel(); }
  }
  function backspace() {
    if (!vkTarget) return;
    var t = vkTarget, se = sel(t), v = t.value;
    if (se[0] !== se[1]) { t.value = v.slice(0, se[0]) + v.slice(se[1]); }
    else if (se[0] > 0) { t.value = v.slice(0, se[0] - 1) + v.slice(se[0]); }
    var c = Math.max(0, se[0] - (se[0] === se[1] ? 1 : 0));
    try { t.setSelectionRange(c, c); } catch (x) { /* ignore */ }
    t.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function relabel() {
    if (!vk) return;
    [].forEach.call(vk.querySelectorAll(".cnavpKey[data-ch]"), function (k) {
      var c = k.getAttribute("data-ch");
      if (/[a-z]/i.test(c)) k.textContent = vkShift ? c.toUpperCase() : c.toLowerCase();
    });
  }
  function mkKey(label, charAttr, onp, wide) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "cnavpKey";
    b.textContent = label;
    if (charAttr) b.setAttribute("data-ch", charAttr);
    b.style.cssText =
      "min-width:" + (wide || 38) + "px;height:42px;padding:0 8px;background:#0d1830;" +
      "color:#e6eefc;border:1px solid #1b2b4d;border-radius:9px;font-size:15px;" +
      "font-weight:600;cursor:pointer;";
    b.addEventListener("click", function (e) { e.preventDefault(); onp(); });
    return b;
  }
  function openVK(target) {
    closeVK();
    vkTarget = target;
    vkShift = false;
    vk = document.createElement("div");
    vk.style.cssText =
      "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);display:flex;" +
      "flex-direction:column;gap:6px;padding:12px;background:#0f1a33;border:1px solid #1b2b4d;" +
      "border-radius:12px;z-index:2147483100;box-shadow:0 8px 30px rgba(0,0,0,.45);";
    var numeric = target.tagName === "INPUT" && (target.type === "number" || target.type === "tel");
    var rows = numeric ? ["1234567890"]
      : ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm", "@.-_:/+?"];
    rows.forEach(function (r) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;gap:5px;justify-content:center;";
      [].forEach.call(r, function (ch) {
        row.appendChild(mkKey(ch, ch, function () { typeCh(ch); }));
      });
      vk.appendChild(row);
    });
    var act = document.createElement("div");
    act.style.cssText = "display:flex;gap:5px;justify-content:center;";
    if (!numeric) act.appendChild(mkKey("⇧", "", function () { vkShift = !vkShift; relabel(); }));
    act.appendChild(mkKey("␣", "", function () { typeRaw(" "); }, numeric ? 60 : 200));
    act.appendChild(mkKey("⌫", "", function () { backspace(); }));
    act.appendChild(mkKey("✓", "", function () { closeVK(); }));
    vk.appendChild(act);
    document.body.appendChild(vk);
    var first = vk.querySelector(".cnavpKey");
    if (first) setFocus(first);
  }
  function closeVK() {
    if (!vk) return;
    vk.remove();
    vk = null;
    var r = vkTarget;
    vkTarget = null;
    if (r) {
      try { r.focus({ preventScroll: true }); } catch (x) { /* ignore */ }
      setFocus(r);
    }
  }
  function activate(el) {
    if (!el || !el.isConnected) return;
    if (isText(el)) { openVK(el); return; }
    if (el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio")) {
      el.click();
      return;
    }
    if (el.tagName === "SELECT") {
      if (el.options.length) {
        el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }
    el.click();
  }

  function readDir(gp) {
    var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    var up = (gp.buttons[DPAD_UP] && gp.buttons[DPAD_UP].pressed) || ay < -DEAD;
    var dn = (gp.buttons[DPAD_DOWN] && gp.buttons[DPAD_DOWN].pressed) || ay > DEAD;
    var lf = (gp.buttons[DPAD_LEFT] && gp.buttons[DPAD_LEFT].pressed) || ax < -DEAD;
    var rt = (gp.buttons[DPAD_RIGHT] && gp.buttons[DPAD_RIGHT].pressed) || ax > DEAD;
    if (Math.abs(ax) > Math.abs(ay)) {
      if (lf) return "left";
      if (rt) return "right";
      if (up) return "up";
      if (dn) return "down";
    } else {
      if (up) return "up";
      if (dn) return "down";
      if (lf) return "left";
      if (rt) return "right";
    }
    return null;
  }
  function edge(gp, i) {
    var p = !!(gp.buttons[i] && gp.buttons[i].pressed), w = prev[i] === true;
    prev[i] = p;
    return p && !w;
  }
  function tick() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var gp = null;
    for (var i = 0; i < pads.length; i++) { if (pads[i]) { gp = pads[i]; break; } }
    if (gp) {
      if (edge(gp, BTN_A)) activate(focused);
      if (edge(gp, BTN_B)) { if (vk) closeVK(); }
      var dir = readDir(gp), now = performance.now();
      if (dir && dir !== heldDir) { heldDir = dir; nextRep = now + REPEAT_DELAY; move(dir); }
      else if (dir && dir === heldDir && now >= nextRep) { nextRep = now + REPEAT_INT; move(dir); }
      else if (!dir) { heldDir = null; }
      var sy = gp.axes[3] || 0;
      if (Math.abs(sy) > SCROLL_DEAD && !vk) window.scrollBy(0, sy * SCROLL_SPD);
    }
    refreshRing();
    requestAnimationFrame(tick);
  }

  document.addEventListener("pointerdown", function (e) {
    var tgt = e.target;
    var f = tgt && tgt.closest && tgt.closest("button,input,select,textarea,a[href],[tabindex]");
    if (f) { focused = f; refreshRing(); }
  }, true);

  requestAnimationFrame(tick);
})();
