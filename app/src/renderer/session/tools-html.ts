import type { TranslationKey } from "../../i18n/translations";
import { t } from "../i18n";
import penyaIcon from "../../assets/penya.png";
import mineralsIcon from "../../assets/minerals.png";
import eronsIcon from "../../assets/erons.png";
import powerdice4Icon from "../../assets/powerdice4.png";
import powerdice6Icon from "../../assets/powerdice6.png";
import powerdice8Icon from "../../assets/powerdice8.png";
import powerdice10Icon from "../../assets/powerdice10.png";
import powerdice12Icon from "../../assets/powerdice12.png";
import sprotectIcon from "../../assets/sprotect.png";
import lowsprotectIcon from "../../assets/lowsprotect.png";
import xprotectIcon from "../../assets/xprotect.png";
import sunstoneIcon from "../../assets/sunstone.png";
import aprotectIcon from "../../assets/aprotect.png";
import gprotectIcon from "../../assets/gprotect.png";
import ultimateorbIcon from "../../assets/ultimateorb.png";
import guruIcon from "../../assets/guru.png";
import weaponIcon from "../../assets/itm_weaaxebehemoth.png";
import curseJewelryIcon from "../../assets/curse_jewelry_fragment.png";
import weaswowoodenIcon from "../../assets/weaswowooden.png";
import mvag02upperIcon from "../../assets/mvag02upper.png";
import armshibuckleIcon from "../../assets/armshibuckle.png";
import goreIcon from "../../assets/gore.png";
import weastaegoIcon from "../../assets/weastaego.png";

export function localeToIntl(loc: string): string {
    return loc === "cn" ? "zh-CN" :
        loc === "jp" ? "ja-JP" :
        loc === "pl" ? "pl-PL" :
        loc === "ru" ? "ru-RU" :
        loc === "tr" ? "tr-TR" :
        loc === "fr" ? "fr-FR" :
        loc === "de" ? "de-DE" :
        "en-US";
}

export function tr(key: TranslationKey, replacements?: Record<string, string>): string {
    let text = t(key);
    if (replacements) {
        for (const [k, v] of Object.entries(replacements)) {
            text = text.replace(`{${k}}`, v);
        }
    }
    return text;
}

export interface ThemeVars {
    bg: string;
    panel: string;
    panel2: string;
    stroke: string;
    text: string;
    muted: string;
    accentRgb: string;
}

export function getThemeVars(): ThemeVars {
    const s = getComputedStyle(document.documentElement);
    const pick = (key: string, fb: string) => s.getPropertyValue(`--${key}`)?.trim() || fb;
    return {
        bg: pick("bg", "#0b1220"),
        panel: pick("panel", "#0f1a33"),
        panel2: pick("panel2", "#0d1830"),
        stroke: pick("stroke", "#1b2b4d"),
        text: pick("text", "#e6eefc"),
        muted: pick("muted", "#294093"),
        accentRgb: pick("accent-rgb", "44,107,255"),
    };
}

export function buildFcoinConverterHtml(locale: string, theme: ThemeVars): string {
    const intlLocale = localeToIntl(locale);
    const fmt = new Intl.NumberFormat(intlLocale);
    const sampleRate = 200_000_000;
    const sampleAmount = 60;
    const sampleResult = (sampleRate / 1000) * sampleAmount;
    const fcoinTexts = {
        title: tr("tools.fcoin.title" as TranslationKey),
        rateLabel: tr("tools.fcoin.rateLabel" as TranslationKey),
        amountLabel: tr("tools.fcoin.amountLabel" as TranslationKey),
        penyaLabel: tr("tools.fcoin.penyaLabel" as TranslationKey),
        hint: tr("tools.fcoin.hint" as TranslationKey, {
            rate: fmt.format(sampleRate),
            amount: fmt.format(sampleAmount),
            result: fmt.format(sampleResult),
        }),
    };
    const ar = theme.accentRgb;
    return `<!doctype html>
<html lang="${intlLocale}">
<head>
  <meta charset="utf-8" />
  <title>${fcoinTexts.title}</title>
  <style>
    :root { color-scheme: dark; --ar: ${ar}; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: ${theme.bg}; color: ${theme.text}; display: flex; min-height: 100vh; }
    .card { margin: auto; width: 100%; max-width: 360px; padding: 24px 22px; }
    h1 { margin: 0 0 18px; font-size: 16px; font-weight: 700; text-align: center; color: rgba(var(--ar), 0.9); letter-spacing: 0.02em; }
    label { display: block; margin: 14px 0 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(var(--ar), 0.55); }
    input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid ${theme.stroke}; background: ${theme.panel2}; color: ${theme.text}; font-size: 15px; box-sizing: border-box; }
    input:focus { outline: none; border-color: rgba(var(--ar), 0.6); box-shadow: 0 0 0 2px rgba(var(--ar), 0.15); }
    #penya { border-color: rgba(var(--ar), 0.45); }
    .hint { color: rgba(var(--ar), 0.35); margin-top: 14px; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${fcoinTexts.title}</h1>
    <label for="rate">${fcoinTexts.rateLabel}</label>
    <input id="rate" type="text" inputmode="decimal" value="${fmt.format(sampleRate)}" />
    <label for="amount">${fcoinTexts.amountLabel}</label>
    <input id="amount" type="text" inputmode="decimal" value="${fmt.format(sampleAmount)}" />
    <label for="penya">${fcoinTexts.penyaLabel}</label>
    <input id="penya" type="text" inputmode="decimal" value="${fmt.format(sampleResult)}" />
    <div class="hint" id="hint">${fcoinTexts.hint}</div>
  </div>
  <script>
    const intlLocale='${intlLocale}';
    const rateInput=document.getElementById('rate');
    const amountInput=document.getElementById('amount');
    const penyaInput=document.getElementById('penya');
    const fmt=new Intl.NumberFormat(intlLocale,{maximumFractionDigits:2});
    let internalUpdate=false;

    /* --- locale-aware parse: strip thousand seps, normalize decimal --- */
    const testStr=fmt.format(1234.5);
    const thousandSep=testStr.match(/1(.)2/)?.[1]||'';
    const decimalSep=testStr.match(/4(.)5/)?.[1]||'.';
    function parseVal(val){
      let s=val;
      if(thousandSep) s=s.split(thousandSep).join('');
      if(decimalSep!=='.') s=s.replace(decimalSep,'.');
      const n=Number(s);
      return Number.isFinite(n)?n:NaN;
    }
    const fmtVal=(num)=>Number.isFinite(num)?fmt.format(num):'';

    /* --- live formatting: format while typing, keep cursor stable --- */
    function isDigitOrDec(ch){return (ch>='0'&&ch<='9')||ch===decimalSep;}
    function formatInputLive(input){
      const raw=input.value;
      const num=parseVal(raw);
      if(!Number.isFinite(num)&&raw!=='') return;
      if(raw==='') return;
      const cursorPos=input.selectionStart||0;
      let digitsBefore=0;
      for(let i=0;i<cursorPos&&i<raw.length;i++){if(isDigitOrDec(raw[i]))digitsBefore++;}
      const formatted=fmtVal(num);
      if(formatted===raw) return;
      input.value=formatted;
      let count=0;let newPos=formatted.length;
      for(let i=0;i<formatted.length;i++){
        if(isDigitOrDec(formatted[i])) count++;
        if(count>=digitsBefore){newPos=i+1;break;}
      }
      input.setSelectionRange(newPos,newPos);
    }

    function calcFromRateAmount(){
      if(internalUpdate)return;
      const rate=parseVal(rateInput.value);
      const amount=parseVal(amountInput.value);
      if(!Number.isFinite(rate)||rate<=0){penyaInput.value='';return;}
      if(!Number.isFinite(amount)||amount<0){penyaInput.value='';return;}
      const perFcoin=rate/1000;
      const total=perFcoin*amount;
      internalUpdate=true;
      penyaInput.value=fmtVal(total);
      penyaInput.title=fmt.format(amount)+" FC = "+fmt.format(total)+" Penya (1 FC = "+fmt.format(perFcoin)+" Penya)";
      internalUpdate=false;
    }
    function calcFromPenya(){
      if(internalUpdate)return;
      const rate=parseVal(rateInput.value);
      const penya=parseVal(penyaInput.value);
      if(!Number.isFinite(rate)||rate<=0){amountInput.value='';return;}
      if(!Number.isFinite(penya)||penya<0){amountInput.value='';return;}
      const perFcoin=rate/1000;
      const amount=penya/perFcoin;
      internalUpdate=true;
      amountInput.value=fmtVal(amount);
      internalUpdate=false;
    }

    rateInput.addEventListener('input',()=>{formatInputLive(rateInput);calcFromRateAmount();});
    amountInput.addEventListener('input',()=>{formatInputLive(amountInput);calcFromRateAmount();});
    penyaInput.addEventListener('input',()=>{formatInputLive(penyaInput);calcFromPenya();});
    calcFromRateAmount();
    rateInput.focus();
    rateInput.select();
  </script>
</body>
</html>`;
}

export function buildShoppingListHtml(locale: string, theme: ThemeVars): string {
    const intlLocale = localeToIntl(locale);
    const apiLocale = locale === "cn" ? "cn" : locale === "jp" ? "jp" : locale;
    const fmt = new Intl.NumberFormat(intlLocale);
    const shoppingTexts = {
        title: t("config.client.hotkeys.showShoppingList" as TranslationKey),
        searchPlaceholder: tr("tools.shopping.searchPlaceholder" as TranslationKey),
        listHeader: tr("tools.shopping.listHeader" as TranslationKey),
        empty: tr("tools.shopping.empty" as TranslationKey),
        noResults: tr("tools.shopping.noResults" as TranslationKey),
        add: tr("tools.shopping.add" as TranslationKey),
        totalTemplate: tr("tools.shopping.total" as TranslationKey),
    };
    const ar = theme.accentRgb;
    const totalZero = shoppingTexts.totalTemplate.replace("{total}", fmt.format(0));
    return `<!doctype html>
<html lang="${intlLocale}"><head><meta charset="utf-8"/><title>${shoppingTexts.title}</title>
<style>
:root{color-scheme:dark;--ar:${ar};--bg:${theme.bg};--text:${theme.text}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);display:flex;flex-direction:column;height:100vh;overflow:hidden}
.header{padding:12px 16px 0;flex-shrink:0}
.header h1{font-size:14px;font-weight:700;letter-spacing:.02em;color:rgba(var(--ar),.9);margin-bottom:10px}
#searchInput{width:100%;padding:9px 12px;border-radius:8px;border:1px solid rgba(var(--ar),.25);background:rgba(var(--ar),.06);color:var(--text);font-size:13px}
#searchInput:focus{outline:none;border-color:rgba(var(--ar),.7);box-shadow:0 0 0 2px rgba(var(--ar),.15)}
#searchInput::placeholder{color:rgba(var(--ar),.4)}
.search-results{max-height:180px;overflow-y:auto;margin:6px 16px 0;border-radius:8px}
.search-results::-webkit-scrollbar{width:6px}
.search-results::-webkit-scrollbar-thumb{background:rgba(var(--ar),.25);border-radius:3px}
.sr-item{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid rgba(var(--ar),.08);cursor:default}
.sr-item:hover{background:rgba(var(--ar),.08)}
.sr-icon{width:28px;height:28px;border-radius:4px;background:rgba(var(--ar),.1);flex-shrink:0;object-fit:contain}
.sr-name{flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sr-cat{font-size:10px;color:rgba(var(--ar),.5);margin-left:4px}
.sr-add{padding:3px 10px;border:none;border-radius:6px;background:rgba(var(--ar),.18);color:rgba(var(--ar),.9);font-size:11px;font-weight:700;cursor:pointer}
.sr-add:hover{background:rgba(var(--ar),.3)}
.divider{height:1px;background:rgba(var(--ar),.15);margin:8px 16px}
.list-header{padding:4px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(var(--ar),.5)}
.cart{flex:1;overflow-y:auto;padding:0 16px}
.cart::-webkit-scrollbar{width:6px}
.cart::-webkit-scrollbar-thumb{background:rgba(var(--ar),.25);border-radius:3px}
.cart-empty{text-align:center;color:rgba(var(--ar),.3);font-size:12px;padding:24px 0}
.cart-row{display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(var(--ar),.06)}
.cart-check{width:15px;height:15px;accent-color:rgba(var(--ar),.8);flex-shrink:0;cursor:pointer;margin:0}
.cart-row.checked .cart-name,.cart-row.checked .cart-input{opacity:.4;text-decoration:line-through}
.cart-icon{width:24px;height:24px;border-radius:4px;background:rgba(var(--ar),.1);flex-shrink:0;object-fit:contain}
.cart-name{flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.cart-input{width:72px;padding:4px 6px;border-radius:6px;border:1px solid rgba(var(--ar),.2);background:rgba(var(--ar),.06);color:var(--text);font-size:12px;text-align:right;font-variant-numeric:tabular-nums}
.cart-input:focus{outline:none;border-color:rgba(var(--ar),.6)}
.cart-qty{width:40px}
.cart-del{background:none;border:none;color:rgba(var(--ar),.4);font-size:15px;cursor:pointer;padding:2px 6px}
.cart-del:hover{color:#ff5c5c}
.total-bar{flex-shrink:0;padding:10px 16px;border-top:1px solid rgba(var(--ar),.2);display:flex;justify-content:flex-end;align-items:center;font-size:14px;font-weight:700;color:rgba(var(--ar),.9)}
</style></head><body>
<div class="header"><h1>${shoppingTexts.title}</h1>
<input id="searchInput" type="text" placeholder="${shoppingTexts.searchPlaceholder}" autocomplete="off"/></div>
<div id="searchResults" class="search-results"></div>
<div class="divider"></div>
<div class="list-header">${shoppingTexts.listHeader}</div>
<div id="cart" class="cart"><div class="cart-empty">${shoppingTexts.empty}</div></div>
<div id="totalBar" class="total-bar">${totalZero}</div>
<script>
const api=window.opener?.api;
const STR=${JSON.stringify({
            empty: shoppingTexts.empty,
            noResults: shoppingTexts.noResults,
            add: shoppingTexts.add,
            totalTemplate: shoppingTexts.totalTemplate,
            listHeader: shoppingTexts.listHeader,
            locale: apiLocale,
        })};
const searchInput=document.getElementById('searchInput');
const searchResults=document.getElementById('searchResults');
const cartEl=document.getElementById('cart');
const totalBar=document.getElementById('totalBar');
const cart=[];
const iconCache=new Map();
let debounceTimer=null;
const locale=STR.locale;
const fmt=n=>new Intl.NumberFormat('${intlLocale}').format(n);

async function loadIcon(filename,imgEl){
  if(!filename){return}
  if(iconCache.has(filename)){imgEl.src=iconCache.get(filename);return}
  try{
    const url=await api.shoppingListIcon(filename);
    if(url){iconCache.set(filename,url);imgEl.src=url}
  }catch(e){}
}

async function doSearch(q){
  if(!q||q.length<1){searchResults.innerHTML='';return}
  try{
    const results=await api.shoppingListSearch(q,locale);
    searchResults.innerHTML='';
    if(!results||results.length===0){searchResults.innerHTML='<div style="padding:8px 12px;font-size:11px;color:rgba(var(--ar),.4)">'+STR.noResults+'</div>';return}
    for(const item of results){
      const row=document.createElement('div');row.className='sr-item';
      const img=document.createElement('img');img.className='sr-icon';img.alt='';row.appendChild(img);
      loadIcon(item.icon,img);
      const name=document.createElement('span');name.className='sr-name';name.textContent=item.name[locale]||item.name['en']||('Item #'+item.id);row.appendChild(name);
      if(item.category){const cat=document.createElement('span');cat.className='sr-cat';cat.textContent=item.category;row.appendChild(cat)}
      const btn=document.createElement('button');btn.className='sr-add';btn.textContent=STR.add;
      btn.onclick=()=>addToCart(item);row.appendChild(btn);
      searchResults.appendChild(row);
    }
  }catch(e){searchResults.innerHTML=''}
}

searchInput.addEventListener('input',()=>{
  clearTimeout(debounceTimer);
  debounceTimer=setTimeout(()=>doSearch(searchInput.value.trim()),300);
});

function addToCart(item){
  const existing=cart.find(c=>c.id===item.id);
  if(existing){existing.qty++;renderCart();return}
  cart.push({id:item.id,name:item.name[locale]||item.name['en']||('Item #'+item.id),icon:item.icon,price:item.savedPrice||0,qty:1,checked:false});
  renderCart();
}

function renderCart(){
  cartEl.innerHTML='';
  if(cart.length===0){cartEl.innerHTML='<div class="cart-empty">'+STR.empty+'</div>';updateTotal();return}
  for(let i=0;i<cart.length;i++){
    const c=cart[i];
    const row=document.createElement('div');row.className='cart-row'+(c.checked?' checked':'');
    const cb=document.createElement('input');cb.type='checkbox';cb.className='cart-check';cb.checked=!!c.checked;
    cb.onchange=()=>{c.checked=cb.checked;row.className='cart-row'+(c.checked?' checked':'')};
    row.appendChild(cb);
    const img=document.createElement('img');img.className='cart-icon';img.alt='';row.appendChild(img);
    loadIcon(c.icon,img);
    const name=document.createElement('span');name.className='cart-name';name.title=c.name;name.textContent=c.name;row.appendChild(name);
    const priceIn=document.createElement('input');priceIn.className='cart-input';priceIn.type='text';priceIn.inputMode='numeric';priceIn.value=c.price?fmt(c.price):'';priceIn.placeholder='FCoins';
    priceIn.addEventListener('input',()=>{const v=Number(priceIn.value.replace(/\\./g,'').replace(',','.'));if(Number.isFinite(v)&&v>=0){c.price=v;updateTotal()}});
    priceIn.addEventListener('blur',()=>{if(c.price>0){priceIn.value=fmt(c.price);try{api.shoppingListSavePrice(c.id,c.price)}catch(e){}}});
    row.appendChild(priceIn);
    const qtyIn=document.createElement('input');qtyIn.className='cart-input cart-qty';qtyIn.type='number';qtyIn.min='1';qtyIn.value=String(c.qty);
    qtyIn.addEventListener('input',()=>{const v=parseInt(qtyIn.value,10);if(v>0){c.qty=v;updateTotal()}});
    row.appendChild(qtyIn);
    const del=document.createElement('button');del.className='cart-del';del.textContent='\\u2715';del.onclick=()=>{cart.splice(i,1);renderCart()};
    row.appendChild(del);
    cartEl.appendChild(row);
  }
  updateTotal();
}

function updateTotal(){
  const total=cart.reduce((s,c)=>s+c.price*c.qty,0);
  totalBar.textContent=STR.totalTemplate.replace('{total}', fmt(total));
}
document.querySelector('.list-header').textContent = STR.listHeader;
searchInput.focus();
</script></body></html>`;
}

// ============================================================================
// Unified Upgrade Calculator  (all upgrade types in one window with sidebar nav)
// Replaces: buildUpgradeCalculatorHtml, buildJewelryUpgradeHtml,
//           buildArmorPiercingHtml, buildWeaponPiercingHtml, buildUltimateUpgradeHtml
// ============================================================================

export function buildUnifiedUpgradeCalculatorHtml(locale: string, theme: ThemeVars): string {
    const intlLocale = localeToIntl(locale);
    const ar = theme.accentRgb;

    // Translation strings (weapon/armor tab uses i18n; other tabs use fixed German labels)
    const T = {
        sProtect:      tr("tools.upgrade.sProtect"      as TranslationKey),
        sProtectLow:   tr("tools.upgrade.sProtectLow"   as TranslationKey),
        compare:       tr("tools.upgrade.compare"       as TranslationKey),
        fromLevel:     tr("tools.upgrade.fromLevel"     as TranslationKey),
        toLevel:       tr("tools.upgrade.toLevel"       as TranslationKey),
        owned:         tr("tools.upgrade.owned"         as TranslationKey),
        materials:     tr("tools.upgrade.materials"     as TranslationKey),
        calculate:     tr("tools.upgrade.calculate"     as TranslationKey),
        level:         tr("tools.upgrade.level"         as TranslationKey),
        chance:        tr("tools.upgrade.chance"        as TranslationKey),
        attempts:      tr("tools.upgrade.attempts"      as TranslationKey),
        mineral:       tr("tools.upgrade.mineral"       as TranslationKey),
        eron:          tr("tools.upgrade.eron"          as TranslationKey),
        penya:         tr("tools.upgrade.penya"         as TranslationKey),
        total:         tr("tools.upgrade.total"         as TranslationKey),
        totalCost:     tr("tools.upgrade.totalCost"     as TranslationKey),
        cheaper:       tr("tools.upgrade.cheaper"       as TranslationKey),
        diceTypeLabel: "Power Dice",
        dice4_6:       "Power Dice 6",
        dice12:        "Power Dice 12",
    };

    const ICONS = {
        penya:       penyaIcon,
        minerals:    mineralsIcon,
        erons:       eronsIcon,
        d4:          powerdice4Icon,
        d6:          powerdice6Icon,
        d8:          powerdice8Icon,
        d10:         powerdice10Icon,
        d12:         powerdice12Icon,
        sprotect:    sprotectIcon,
        lowsprotect: lowsprotectIcon,
        xprotect:    xprotectIcon,
        sunstone:    sunstoneIcon,
        aprotect:    aprotectIcon,
        gprotect:    gprotectIcon,
        ultimateorb: ultimateorbIcon,
        guru:        guruIcon,
        weapon:      weaponIcon,
        jewelry:     curseJewelryIcon,
        weaswowooden: weaswowoodenIcon,
        mvag02upper: mvag02upperIcon,
        armshibuckle: armshibuckleIcon,
        gore: goreIcon,
        weastaego: weastaegoIcon,
    };

    const DEFAULT_WS = {
        prices: { mineral: 1000, eron: 1000, sProtect: 18000000, sProtectLow: 10000000, dice6: 500000, dice12: 1000000 },
        owned:  { mineral: false, eron: false, sProtect: false, sProtectLow: false, dice6: false, dice12: false },
        diceType: "dice4_6",
        systemMode: "compare",
        bonus: { fwcActive: false, fwcValue: 100, eventActive: false, eventValue: 0 },
    };

    // All game data bundled for client-side JS
    const GD = {
        weapon: {
            dice4_6: [0.88888889, 0.82352941, 0.75, 0.34736999, 0.20622583, 0.09782638, 0.04562014, 0.01201637, 0.00308911, 0.00050293],
            dice12:  [1.0, 1.0, 0.86363636, 0.42264973, 0.24440677, 0.11894919, 0.06385147, 0.01773627, 0.00442309, 0.00067675],
            costs: [
                {l:1,m:10,p:2000},{l:2,m:14,p:4000},{l:3,m:20,p:8000},{l:4,m:27,p:15000},
                {l:5,m:38,p:30000},{l:6,m:54,p:60000},{l:7,m:75,p:75000},
                {l:8,m:105,p:125000},{l:9,m:148,p:250000},{l:10,m:207,p:300000},
            ],
        },
        jewelry: {
            d8:  [0.8888888900, 0.8235294118, 0.4581044440, 0.2493069984, 0.1418051957, 0.0911834609, 0.0610808317, 0.0409199117, 0.0282296525, 0.0177362748, 0.0120163682, 0.0095524157, 0.0054401086, 0.0038016583, 0.0024485555, 0.0013861777, 0.0006200876, 0.0001560417, 0.0000766121, 0.0000015698],
            d10: [1.0000000000, 1.0000000000, 0.5569985570, 0.2968258491, 0.1688875608, 0.1088714130, 0.0724875434, 0.0505493442, 0.0322209144, 0.0209832282, 0.0171175271, 0.0136224870, 0.0077555964, 0.0054401086, 0.0035080404, 0.0019884101, 0.0008906052, 0.0002244043, 0.0001102193, 0.0000022601],
            penya: new Array(20).fill(0),
            max: 20,
        },
        armorPiercing: {
            d8:  [0.75, 0.3021030303, 0.0557040404, 0.0038016583],
            d10: [0.8636363636, 0.3603978509, 0.0785111200, 0.0054401086],
            penya: [1120000, 1400000, 1680000, 1960000],
            max: 4,
        },
        weaponPiercing: {
            d8:   [0.3021030253, 0.0847440919, 0.0227015537, 0.0058936935, 0.0015076521, 0.3021030253, 0.0847440919, 0.0227015537, 0.0058936935, 0.0015076521],
            d10:  [0.3603978509, 0.1012233924, 0.0322209144, 0.0084214794, 0.0022126466, 0.3603978509, 0.1012233924, 0.0322209144, 0.0084214794, 0.0022126466],
            p1h:  [1120000, 1400000, 1680000, 1960000, 2240000],
            p2h:  [1120000, 1400000, 1680000, 1960000, 2240000, 2520000, 2800000, 3080000, 3360000, 3640000],
            max1h: 5,
            max2h: 10,
        },
        ultimate: {
            wProbs: [0.0244824095, 0.0177362748, 0.0133482050, 0.0100237399, 0.0073587053, 0.0054401086, 0.0038016583, 0.0019884101, 0.0008184658, 0.0003050380],
            wMin:   [50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
            wPenya: [20000, 40000, 80000, 150000, 300000, 500000, 750000, 900000, 1200000, 1500000],
            jProbs: [0.0073587053, 0.0054401086, 0.0030891066, 0.0017758901, 0.0009657416, 0.0005029272, 0.0003050380, 0.0001408741, 0.0000766121, 0.0000391396],
            jPenya: [20000, 40000, 80000, 150000, 300000, 500000, 750000, 900000, 1200000, 1500000],
        },
    };

    const STR = {
        sProtect:    T.sProtect,
        sProtectLow: T.sProtectLow,
        total:       T.total,
        totalCost:   T.totalCost,
        owned:       T.owned,
    };

    return `<!doctype html><html lang="${intlLocale}"><head>
  <meta charset="utf-8" />
  <title>🎲 Upgrade-Rechner</title>
  <style>
    :root { color-scheme: dark; --ar: ${ar}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: ${theme.bg}; color: ${theme.text}; display: flex; height: 100vh; overflow: hidden; }

    /* ── Sidebar ── */
    .sidebar { width: 172px; flex-shrink: 0; background: ${theme.panel}; border-right: 1px solid ${theme.stroke}; display: flex; flex-direction: column; padding: 10px 7px; gap: 3px; overflow-y: auto; }
    .sidebar-title { font-size: 10px; font-weight: 700; color: rgba(var(--ar), 0.5); padding: 2px 7px 8px; letter-spacing: 0.07em; text-transform: uppercase; border-bottom: 1px solid rgba(var(--ar), 0.1); margin-bottom: 3px; }
    .nav-btn { display: flex; align-items: center; gap: 6px; padding: 8px 9px; border-radius: 8px; border: none; background: transparent; color: rgba(var(--ar), 0.5); font-size: 11.5px; font-weight: 600; cursor: pointer; text-align: left; width: 100%; transition: background 0.12s, color 0.12s; }
    .nav-icon { width: 16px; height: 16px; object-fit: contain; flex-shrink: 0; opacity: 0.65; transition: opacity 0.12s; }
    .nav-btn:hover .nav-icon, .nav-btn.active .nav-icon { opacity: 1; }
    .nav-btn:hover { background: rgba(var(--ar), 0.08); color: rgba(var(--ar), 0.85); }
    .nav-btn.active { background: rgba(var(--ar), 0.15); color: rgba(var(--ar), 0.95); }

    /* ── Content ── */
    .content { flex: 1; overflow-y: auto; padding: 14px 16px; }
    .content::-webkit-scrollbar { width: 6px; }
    .content::-webkit-scrollbar-thumb { background: rgba(var(--ar), 0.22); border-radius: 3px; }
    .panel { display: none; }
    .panel.active { display: block; }

    /* ── Cards ── */
    h2 { font-size: 14px; font-weight: 700; color: rgba(var(--ar), 0.9); margin: 0 0 12px; display: flex; align-items: center; gap: 7px; }
    h2 img { width: 20px; height: 20px; object-fit: contain; flex-shrink: 0; }
    .card { background: ${theme.panel}; border-radius: 12px; padding: 14px; margin-bottom: 10px; border: 1px solid ${theme.stroke}; }
    .card-title { font-size: 11px; font-weight: 700; color: rgba(var(--ar), 0.6); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.06em; display: flex; align-items: center; gap: 5px; }
    .card-title img { width: 15px; height: 15px; object-fit: contain; }

    /* ── Form ── */
    .form-row { display: flex; gap: 9px; margin-bottom: 7px; flex-wrap: wrap; }
    .form-group { flex: 1; min-width: 130px; }
    label { display: flex; align-items: center; gap: 5px; margin: 7px 0 3px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(var(--ar), 0.5); }
    label img { width: 13px; height: 13px; object-fit: contain; }
    input, select { width: 100%; padding: 7px 9px; border-radius: 8px; border: 1px solid rgba(var(--ar), 0.22); background: ${theme.panel2}; color: ${theme.text}; font-size: 12px; }
    input:focus, select:focus { outline: none; border-color: rgba(var(--ar), 0.65); box-shadow: 0 0 0 2px rgba(var(--ar), 0.12); }
    .btn-calc { width: 100%; padding: 9px 14px; border-radius: 8px; border: none; background: rgba(var(--ar), 0.2); color: rgba(var(--ar), 0.9); font-size: 12px; font-weight: 700; cursor: pointer; margin-top: 7px; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .btn-calc:hover { background: rgba(var(--ar), 0.38); }
    .btn-calc img { width: 15px; height: 15px; object-fit: contain; }

    /* ── Tables ── */
    .hidden { display: none !important; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; padding: 7px 5px; color: rgba(var(--ar), 0.5); font-weight: 700; border-bottom: 1px solid rgba(var(--ar), 0.15); }
    th.r { text-align: right; }
    th.ic { padding: 7px 3px; width: 25px; }
    th.ic img { width: 14px; height: 14px; object-fit: contain; vertical-align: middle; }
    td { padding: 5px; border-bottom: 1px solid rgba(var(--ar), 0.06); }
    tr:last-child td { border-bottom: none; }
    .r { text-align: right; font-variant-numeric: tabular-nums; }
    .lvc { font-weight: 600; color: rgba(var(--ar), 0.8); }
    .already-done { font-size: 10px; font-weight: 400; opacity: 0.6; color: rgba(var(--ar), 1); margin-left: 3px; }
    .total-row { background: rgba(var(--ar), 0.08); font-weight: 700; }
    .total-row td { border-bottom: none; }

    /* ── Dice Segmented Picker ── */
    .dice-seg { display: flex; gap: 4px; flex-wrap: wrap; }
    .dseg-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 6px; border-radius: 8px; border: 1px solid rgba(var(--ar), 0.22); background: ${theme.panel2}; color: rgba(var(--ar), 0.5); font-size: 11px; font-weight: 700; cursor: pointer; transition: background 0.12s, color 0.12s, border-color 0.12s; min-width: 80px; }
    .dseg-btn:hover { background: rgba(var(--ar), 0.1); color: rgba(var(--ar), 0.85); }
    .dseg-btn.active { background: rgba(var(--ar), 0.2); color: rgba(var(--ar), 0.92); border-color: rgba(var(--ar), 0.5); }
    .dseg-icon { width: 18px; height: 18px; object-fit: contain; }

    /* ── Comparison cards (weapon tab) ── */
    .cmp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px; }
    .cmp-card { background: rgba(var(--ar), 0.05); border-radius: 10px; padding: 12px; border: 2px solid transparent; }
    .cmp-card.cheaper { border-color: rgba(76,175,80,0.55); background: rgba(76,175,80,0.07); }
    .cmp-head { display: flex; align-items: center; gap: 7px; margin-bottom: 7px; }
    .cmp-head img { width: 20px; height: 20px; object-fit: contain; }
    .cmp-title { font-size: 11px; font-weight: 700; color: rgba(var(--ar), 0.75); }
    .cmp-value { font-size: 14px; font-weight: 700; color: rgba(var(--ar), 0.95); display: flex; align-items: center; gap: 5px; }
    .cmp-value img { width: 15px; height: 15px; object-fit: contain; }
    .cmp-details { font-size: 10px; color: rgba(var(--ar), 0.5); margin-top: 5px; display: flex; flex-wrap: wrap; gap: 7px; }
    .cmp-detail { display: flex; align-items: center; gap: 3px; }
    .cmp-detail img { width: 12px; height: 12px; object-fit: contain; }
    .cheaper-badge { background: rgba(76,175,80,0.2); color: #6fcf73; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; }
    .cmp-footer { margin-top: 9px; font-size: 11px; color: rgba(var(--ar), 0.55); text-align: center; }

    /* ── Materials grid (weapon tab) ── */
    .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(var(--ar), 0.5); margin: 10px 0 6px; padding-top: 7px; border-top: 1px solid rgba(var(--ar), 0.08); }
    .mat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
    .mat-row { display: flex; align-items: center; gap: 6px; padding: 5px 7px; background: rgba(var(--ar), 0.04); border-radius: 8px; }
    .mat-icon { width: 17px; height: 17px; object-fit: contain; flex-shrink: 0; }
    .mat-price { flex: 1; min-width: 0; }
    .mat-price input { padding: 5px 7px; font-size: 11px; }
    .mat-check { display: flex; align-items: center; gap: 3px; font-size: 10px; color: rgba(var(--ar), 0.5); cursor: pointer; white-space: nowrap; }
    .mat-check input { width: 12px; height: 12px; accent-color: rgba(var(--ar), 0.8); cursor: pointer; }

    /* ── Inner tabs (ultimate) ── */
    .inner-tabs { display: flex; gap: 5px; margin-bottom: 10px; }
    .inner-tab { flex: 1; padding: 7px; border-radius: 8px; border: 1px solid rgba(var(--ar), 0.18); background: ${theme.panel}; color: rgba(var(--ar), 0.5); font-size: 12px; font-weight: 700; cursor: pointer; text-align: center; display: flex; align-items: center; justify-content: center; gap: 5px; }
    .inner-tab img { width: 16px; height: 16px; object-fit: contain; opacity: 0.6; }
    .inner-tab.active img { opacity: 1; }
    .inner-tab.active { background: rgba(var(--ar), 0.2); color: rgba(var(--ar), 0.92); border-color: rgba(var(--ar), 0.45); }
    .note { font-size: 10px; color: rgba(var(--ar), 0.38); margin-top: 6px; font-style: italic; }
    .dice-icons { display: flex; gap: 3px; align-items: center; }
    .dice-icons img { width: 14px; height: 14px; object-fit: contain; }

    /* ── Bonus Bar ── */
    .bonus-bar { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; margin: 0 0 12px; background: ${theme.panel}; border-radius: 10px; border: 1px solid ${theme.stroke}; flex-wrap: wrap; }
    .bonus-fwc-group { display: flex; flex-direction: column; gap: 4px; }
    .bonus-fwc-row, .bonus-event-group { display: flex; align-items: center; gap: 6px; }
    .bonus-fwc-cfgrow { display: flex; align-items: center; gap: 5px; padding-left: 18px; }
    .bonus-toggle { display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: rgba(var(--ar), 0.55); cursor: pointer; user-select: none; }
    .bonus-toggle input[type=checkbox] { accent-color: rgba(var(--ar), 0.9); width: 13px; height: 13px; cursor: pointer; }
    .bonus-toggle.on { color: rgba(var(--ar), 0.9); }
    .bonus-pct-badge { font-size: 10px; font-weight: 700; color: #6fcf73; background: rgba(76,175,80,.12); padding: 1px 6px; border-radius: 8px; }
    .bonus-cfg-btn { background: rgba(var(--ar), 0.07); border: 1px solid rgba(var(--ar), 0.18); border-radius: 6px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px; color: rgba(var(--ar), 0.5); padding: 0; transition: background .12s; }
    .bonus-cfg-btn:hover { background: rgba(var(--ar), 0.15); color: rgba(var(--ar), .9); }
    .bonus-cfg-input { width: 52px; padding: 3px 6px; border-radius: 6px; border: 1px solid rgba(var(--ar), 0.3); background: ${theme.panel2}; color: ${theme.text}; font-size: 12px; font-weight: 700; }
    .bonus-spin { width: 60px; padding: 3px 6px; border-radius: 6px; border: 1px solid rgba(var(--ar), 0.22); background: ${theme.panel2}; color: ${theme.text}; font-size: 12px; font-weight: 700; }
    .bonus-unit { font-size: 11px; color: rgba(var(--ar), 0.45); font-weight: 700; }
    .bonus-sep { width: 1px; align-self: stretch; background: rgba(var(--ar), 0.12); flex-shrink: 0; }
    .bonus-total-badge { margin-left: auto; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 8px; background: rgba(76,175,80,.1); color: #6fcf73; white-space: nowrap; align-self: center; }
    .bonus-total-badge.zero { background: rgba(var(--ar), .06); color: rgba(var(--ar), .4); }
  </style>
</head><body>

  <!-- Sidebar navigation -->
  <nav class="sidebar">
    <div class="sidebar-title">Upgrade-Rechner</div>
    <button id="nav-weapon"         class="nav-btn"><img src="${ICONS.weaswowooden}" class="nav-icon" /><img src="${ICONS.mvag02upper}" class="nav-icon" /><img src="${ICONS.armshibuckle}" class="nav-icon" /><span style="color:rgba(var(--ar),0.4);font-size:12px;"> - </span><img src="${ICONS.d4}" class="nav-icon" /><img src="${ICONS.sprotect}" class="nav-icon" /></button>
    <button id="nav-jewelry"        class="nav-btn"><img src="${ICONS.gore}" class="nav-icon" /><span style="color:rgba(var(--ar),0.4);font-size:12px;"> - </span><img src="${ICONS.d8}" class="nav-icon" /><img src="${ICONS.aprotect}" class="nav-icon" /></button>
    <button id="nav-armorPiercing"  class="nav-btn"><img src="${ICONS.mvag02upper}" class="nav-icon" /><span style="color:rgba(var(--ar),0.4);font-size:12px;"> - </span><img src="${ICONS.d8}" class="nav-icon" /><img src="${ICONS.gprotect}" class="nav-icon" /></button>
    <button id="nav-weaponPiercing" class="nav-btn"><img src="${ICONS.weaswowooden}" class="nav-icon" /><img src="${ICONS.armshibuckle}" class="nav-icon" /><span style="color:rgba(var(--ar),0.4);font-size:12px;"> - </span><img src="${ICONS.d8}" class="nav-icon" /><img src="${ICONS.gprotect}" class="nav-icon" /></button>
    <button id="nav-ultimateWeapon" class="nav-btn"><img src="${ICONS.ultimateorb}" class="nav-icon" /><img src="${ICONS.weapon}" class="nav-icon" /></button>
    <button id="nav-ultimateJewelry" class="nav-btn"><img src="${ICONS.ultimateorb}" class="nav-icon" /><img src="${ICONS.jewelry}" class="nav-icon" /></button>
  </nav>

  <main class="content">

    <!-- ══ Waffe / Rüstung ══════════════════════════════════════════════ -->
    <section id="panel-weapon" class="panel">
      <h2>Waffe-Rüstung-Schild Upgrade</h2>
      <!-- Bonus Bar — moved into active panel by switchTab() -->
      <div class="bonus-bar" id="bonus-bar">
        <!-- FWC -->
        <div class="bonus-fwc-group">
          <div class="bonus-fwc-row">
            <label class="bonus-toggle" id="bonus-fwcLabel">
              <input type="checkbox" id="bonus-fwcOn" />
              FWC
            </label>
            <span class="bonus-pct-badge" id="bonus-fwcBadge">+100%</span>
            <button class="bonus-cfg-btn" id="bonus-fwcCfgBtn" title="FWC Bonus konfigurieren">⚙</button>
          </div>
          <div class="bonus-fwc-cfgrow hidden" id="bonus-fwcCfgRow">
            <input type="number" class="bonus-cfg-input" id="bonus-fwcPct" min="0" max="100" step="1" value="100" />
            <span class="bonus-unit">%</span>
          </div>
        </div>
        <div class="bonus-sep"></div>
        <!-- Event -->
        <div class="bonus-event-group">
          <label class="bonus-toggle" id="bonus-eventLabel">
            <input type="checkbox" id="bonus-eventOn" />
            Event
          </label>
          <span class="bonus-pct-badge" id="bonus-eventBadge" style="opacity:.35">+0%</span>
          <input type="number" class="bonus-spin" id="bonus-eventPct" min="0" max="100" step="0.5" value="0" />
          <span class="bonus-unit">%</span>
        </div>
        <div class="bonus-total-badge zero" id="bonus-totalBadge">+0%</div>
      </div>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>${T.diceTypeLabel}</label>
            <div class="dice-seg" id="w-diceType" data-val="dice4_6">
              <button type="button" class="dseg-btn active" data-val="dice4_6">
                <img src="${ICONS.d6}" class="dseg-icon" />${T.dice4_6}
              </button>
              <button type="button" class="dseg-btn" data-val="dice12">
                <img src="${ICONS.d12}" class="dseg-icon" />${T.dice12}
              </button>
            </div>
          </div>
          <div class="form-group">
            <label>${T.fromLevel}</label>
            <select id="w-from">
              ${Array.from({length:10},(_,i)=>`<option value="${i+1}"${i===0?" selected":""}>+${i}</option>`).join("")}
            </select>
          </div>
          <div class="form-group" style="min-width:110px;max-width:140px;">
            <label title="Bereits fehlgeschlagene Versuche beim Startlevel (Pity-Zähler)">Bereits Versuche ✦</label>
            <input type="number" id="w-alreadyDone" min="0" max="9999" step="1" value="0" />
          </div>
          <div class="form-group">
            <label>${T.toLevel}</label>
            <select id="w-to">
              ${Array.from({length:10},(_,i)=>`<option value="${i+2}"${i===9?" selected":""}>+${i+1}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>Modus</label>
            <select id="w-mode">
              <option value="compare">${T.compare}</option>
              <option value="sProtect">${T.sProtect}</option>
              <option value="sProtectLow">${T.sProtectLow}</option>
            </select>
          </div>
        </div>
        <div class="section-label">${T.materials}</div>
        <div class="mat-grid" id="w-matGrid"></div>
        <button class="btn-calc" id="w-calcBtn">
          <img src="${ICONS.penya}" />${T.calculate}
        </button>
      </div>

      <div id="w-results" class="hidden">
        <!-- Comparison view -->
        <div class="card hidden" id="w-cmpSection">
          <div class="card-title" id="w-cmpTitle"></div>
          <div class="cmp-grid">
            <div class="cmp-card" id="w-spCard">
              <div class="cmp-head"><img src="${ICONS.sprotect}" /><span class="cmp-title">${T.sProtect}</span></div>
              <div id="w-spSummary"></div>
            </div>
            <div class="cmp-card" id="w-splCard">
              <div class="cmp-head"><img src="${ICONS.lowsprotect}" /><span class="cmp-title">${T.sProtectLow}</span></div>
              <div id="w-splSummary"></div>
            </div>
            <div class="cmp-card" id="w-mixCard">
              <div class="cmp-head"><img src="${ICONS.lowsprotect}" /><span style="font-size:9px;opacity:.5">→</span><img src="${ICONS.sprotect}" /><span class="cmp-title">Mix</span></div>
              <div id="w-mixSummary"></div>
            </div>
          </div>
          <div class="cmp-footer" id="w-cheaperText"></div>
        </div>
        <!-- Single-system detail table -->
        <div class="card hidden" id="w-singleSection">
          <div class="card-title" id="w-singleTitle"></div>
          <table>
            <thead><tr>
              <th>${T.level}</th>
              <th class="r">${T.chance}</th>
              <th class="r">${T.attempts}</th>
              <th class="ic"><img src="${ICONS.minerals}" title="${T.mineral}" /></th>
              <th class="ic"><img src="${ICONS.erons}" title="${T.eron}" /></th>
              <th class="ic"><img src="${ICONS.penya}" title="${T.penya}" /></th>
            </tr></thead>
            <tbody id="w-tbody"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ══ Schmuck ════════════════════════════════════════════════════════ -->
    <section id="panel-jewelry" class="panel">
      <h2>Schmuck Upgrade</h2>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>Power Dice</label>
            <div class="dice-seg" id="j-dice" data-val="d8">
              <button type="button" class="dseg-btn active" data-val="d8">
                <img src="${ICONS.d8}" class="dseg-icon" />Power Dice 8
              </button>
              <button type="button" class="dseg-btn" data-val="d10">
                <img src="${ICONS.d10}" class="dseg-icon" />Power Dice 10
              </button>
            </div>
          </div>
          <div class="form-group">
            <label>Von Level</label>
            <select id="j-from"></select>
          </div>
          <div class="form-group" style="min-width:110px;max-width:140px;">
            <label title="Bereits fehlgeschlagene Versuche beim Startlevel (Pity-Zähler)">Bereits Versuche ✦</label>
            <input type="number" id="j-alreadyDone" min="0" max="9999" step="1" value="0" />
          </div>
          <div class="form-group">
            <label>Bis Level</label>
            <select id="j-to"></select>
          </div>
          <div class="form-group">
            <label><img src="${ICONS.penya}" /> Preis / Würfel</label>
            <input type="text" inputmode="decimal" id="j-price" value="500,000" />
          </div>
        </div>
        <button class="btn-calc" id="j-calcBtn"><img src="${ICONS.penya}" />Berechnen</button>
      </div>
      <div class="card hidden" id="j-results">
        <table>
          <thead><tr>
            <th>Level</th><th class="r">Chance</th><th class="r">Ø Versuche</th>
            <th class="r">Ø Penya/Versuch</th><th class="r">Ø Gesamt</th>
          </tr></thead>
          <tbody id="j-tbody"></tbody>
        </table>
      </div>
    </section>

    <!-- ══ Rüstungs-Piercing ══════════════════════════════════════════════ -->
    <section id="panel-armorPiercing" class="panel">
      <h2>Rüstungs-Sockel</h2>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>Power Dice</label>
            <div class="dice-seg" id="ap-dice" data-val="d8">
              <button type="button" class="dseg-btn active" data-val="d8">
                <img src="${ICONS.d8}" class="dseg-icon" />Power Dice 8
              </button>
              <button type="button" class="dseg-btn" data-val="d10">
                <img src="${ICONS.d10}" class="dseg-icon" />Power Dice 10
              </button>
            </div>
          </div>
          <div class="form-group">
            <label>Von Level</label>
            <select id="ap-from"></select>
          </div>
          <div class="form-group" style="min-width:110px;max-width:140px;">
            <label title="Bereits fehlgeschlagene Versuche beim Startlevel (Pity-Zähler)">Bereits Versuche ✦</label>
            <input type="number" id="ap-alreadyDone" min="0" max="9999" step="1" value="0" />
          </div>
          <div class="form-group">
            <label>Bis Level</label>
            <select id="ap-to"></select>
          </div>
          <div class="form-group">
            <label><img src="${ICONS.penya}" /> Preis / Würfel</label>
            <input type="text" inputmode="decimal" id="ap-price" value="500,000" />
          </div>
        </div>
        <button class="btn-calc" id="ap-calcBtn"><img src="${ICONS.penya}" />Berechnen</button>
      </div>
      <div class="card hidden" id="ap-results">
        <table>
          <thead><tr>
            <th>Level</th><th class="r">Chance</th><th class="r">Ø Versuche</th>
            <th class="r">Ø Penya/Versuch</th><th class="r">Ø Gesamt</th>
          </tr></thead>
          <tbody id="ap-tbody"></tbody>
        </table>
      </div>
    </section>

    <!-- ══ Waffe / Schild Piercing ════════════════════════════════════════ -->
    <section id="panel-weaponPiercing" class="panel">
      <h2>Waffe/Schild Sockel</h2>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>Power Dice</label>
            <div class="dice-seg" id="wp-dice" data-val="d8">
              <button type="button" class="dseg-btn active" data-val="d8">
                <img src="${ICONS.d8}" class="dseg-icon" />Power Dice 8
              </button>
              <button type="button" class="dseg-btn" data-val="d10">
                <img src="${ICONS.d10}" class="dseg-icon" />Power Dice 10
              </button>
            </div>
          </div>
          <div class="form-group">
            <label>Waffen-Typ</label>
            <div class="dice-seg" id="wp-type" data-val="1h">
              <button type="button" class="dseg-btn active" data-val="1h">
                <img src="${ICONS.weaswowooden}" class="dseg-icon" /><img src="${ICONS.armshibuckle}" class="dseg-icon" style="width:14px;" /> 5 Slots
              </button>
              <button type="button" class="dseg-btn" data-val="2h">
                <img src="${ICONS.weastaego}" class="dseg-icon" /> 10 Slots
              </button>
            </div>
          </div>
          <div class="form-group">
            <label>Von Level</label>
            <select id="wp-from"></select>
          </div>
          <div class="form-group" style="min-width:110px;max-width:140px;">
            <label title="Bereits fehlgeschlagene Versuche beim Startlevel (Pity-Zähler)">Bereits Versuche ✦</label>
            <input type="number" id="wp-alreadyDone" min="0" max="9999" step="1" value="0" />
          </div>
          <div class="form-group">
            <label>Bis Level</label>
            <select id="wp-to"></select>
          </div>
          <div class="form-group">
            <label><img src="${ICONS.penya}" /> Preis / Würfel</label>
            <input type="text" inputmode="decimal" id="wp-price" value="500,000" />
          </div>
        </div>
        <button class="btn-calc" id="wp-calcBtn"><img src="${ICONS.penya}" />Berechnen</button>
      </div>
      <div class="card hidden" id="wp-results">
        <table>
          <thead><tr>
            <th>Level</th><th class="r">Chance</th><th class="r">Ø Versuche</th>
            <th class="r">Ø Penya/Versuch</th><th class="r">Ø Gesamt</th>
          </tr></thead>
          <tbody id="wp-tbody"></tbody>
        </table>
      </div>
    </section>

    <!-- ══ Ultimate Waffe ═══════════════════════════════════════════════════════ -->
    <section id="panel-ultimateWeapon" class="panel">
      <h2>Ultimate Waffe</h2>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>Von Level</label>
            <select id="ultw-from"></select>
          </div>
          <div class="form-group" style="min-width:110px;max-width:140px;">
            <label title="Bereits fehlgeschlagene Versuche beim Startlevel (Pity-Zähler)">Bereits Versuche ✦</label>
            <input type="number" id="ultw-alreadyDone" min="0" max="9999" step="1" value="0" />
          </div>
          <div class="form-group">
            <label>Bis Level</label>
            <select id="ultw-to"></select>
          </div>
        </div>
        <div class="section-label">Preise</div>
        <div class="form-row">
          <div class="form-group">
            <label><img src="${ICONS.sunstone}" /> Sunstone Preis</label>
            <input type="text" inputmode="decimal" id="ultw-sunstone" value="0" />
          </div>
          <div class="form-group">
            <label><img src="${ICONS.xprotect}" /> XProtect Preis</label>
            <input type="text" inputmode="decimal" id="ultw-xprotect" value="0" />
          </div>
          <div class="form-group">
            <label><img src="${ICONS.minerals}" /> Mineral Preis</label>
            <input type="text" inputmode="decimal" id="ultw-mineral" value="1,000" />
          </div>
        </div>
        <button class="btn-calc" id="ultw-calcBtn"><img src="${ICONS.penya}" />Berechnen</button>
        <p class="note">* Sunstone + Mineral + XProtect pro Versuch</p>
      </div>
      <div class="card hidden" id="ultw-results">
        <table>
          <thead><tr>
            <th>Level</th>
            <th class="r">Chance</th>
            <th class="r">Ø Versuche</th>
            <th class="r">Ø Mineral</th>
            <th class="r">Ø Penya/Versuch</th>
            <th class="r">Ø Gesamt</th>
          </tr></thead>
          <tbody id="ultw-tbody"></tbody>
        </table>
      </div>
    </section>

    <!-- ══ Ultimate Schmuck ═══════════════════════════════════════════════════════ -->
    <section id="panel-ultimateJewelry" class="panel">
      <h2>Ultimate Schmuck</h2>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>Von Level</label>
            <select id="ultj-from"></select>
          </div>
          <div class="form-group" style="min-width:110px;max-width:140px;">
            <label title="Bereits fehlgeschlagene Versuche beim Startlevel (Pity-Zähler)">Bereits Versuche ✦</label>
            <input type="number" id="ultj-alreadyDone" min="0" max="9999" step="1" value="0" />
          </div>
          <div class="form-group">
            <label>Bis Level</label>
            <select id="ultj-to"></select>
          </div>
        </div>
        <div class="section-label">Preise</div>
        <div class="form-row">
          <div class="form-group">
            <label><img src="${ICONS.sunstone}" /> Sunstone Preis</label>
            <input type="text" inputmode="decimal" id="ultj-sunstone" value="0" />
          </div>
          <div class="form-group">
            <label><img src="${ICONS.xprotect}" /> XProtect Preis</label>
            <input type="text" inputmode="decimal" id="ultj-xprotect" value="0" />
          </div>
        </div>
        <button class="btn-calc" id="ultj-calcBtn"><img src="${ICONS.penya}" />Berechnen</button>
        <p class="note">* Sunstone + XProtect pro Versuch</p>
      </div>
      <div class="card hidden" id="ultj-results">
        <table>
          <thead><tr>
            <th>Level</th>
            <th class="r">Chance</th>
            <th class="r">Ø Versuche</th>
            <th class="r">Ø Penya/Versuch</th>
            <th class="r">Ø Gesamt</th>
          </tr></thead>
          <tbody id="ultj-tbody"></tbody>
        </table>
      </div>
    </section>

  </main>

  <script>
    const GD    = ${JSON.stringify(GD)};
    const STR   = ${JSON.stringify(STR)};
    const ICONS = ${JSON.stringify(ICONS)};
    const DWS   = ${JSON.stringify(DEFAULT_WS)};
    const IL    = '${intlLocale}';

    // === Shared utilities ===
    const fmt    = new Intl.NumberFormat(IL, { maximumFractionDigits: 0 });
    const fmtDec = new Intl.NumberFormat(IL, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    function parseNum(s) { return Number(String(s).replace(/[^0-9.,]/g,'').replace(',','.')) || 0; }

    // Pity-system expected attempts (SProtect formula).
    // alreadyDone: failed attempts already done at this level (pity counter).
    // Returns expected *additional* attempts to succeed.
    function calcEA(p, alreadyDone) {
      alreadyDone = alreadyDone || 0;
      if (p >= 1) return 1;
      const max = Math.ceil(1 / p);
      if (alreadyDone >= max) return 1; // next attempt is guaranteed
      let e = 0, prod = 1;
      for (let k = alreadyDone + 1; k <= max; k++) {
        const sp = Math.min(k * p, 1);
        e += (k - alreadyDone) * prod * sp;
        if (k < max) prod *= (1 - sp);
      }
      return e;
    }

    // === Tab system ===
    const TABS = ['weapon','jewelry','armorPiercing','weaponPiercing','ultimateWeapon','ultimateJewelry'];
    function switchTab(id) {
      TABS.forEach(t => {
        document.getElementById('nav-' + t).classList.toggle('active', t === id);
        document.getElementById('panel-' + t).classList.toggle('active', t === id);
      });
      const panel = document.getElementById('panel-' + id);
      const h2    = panel.querySelector('h2');
      h2.insertAdjacentElement('afterend', document.getElementById('bonus-bar'));
    }
    TABS.forEach(t => document.getElementById('nav-' + t).addEventListener('click', () => switchTab(t)));

    // === Dice Segmented Control ===
    function diceSegVal(id) { return document.getElementById(id).dataset.val; }
    function diceSegSet(id, val) {
      const wrap = document.getElementById(id);
      if (!wrap) return;
      wrap.dataset.val = val;
      wrap.querySelectorAll('.dseg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val));
    }
    function diceSegInit(id, onChange) {
      const wrap = document.getElementById(id);
      if (!wrap) return;
      wrap.querySelectorAll('.dseg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          diceSegSet(id, btn.dataset.val);
          if (onChange) onChange(btn.dataset.val);
        });
      });
    }

    // ================================================================
    // BONUS STATE  (FWC + Event — global, applies to all tabs)
    // ================================================================
    let bonusState = JSON.parse(JSON.stringify(DWS.bonus));

    function bonusTotal() {
      return (bonusState.fwcActive ? bonusState.fwcValue / 100 : 0)
           + (bonusState.eventActive ? bonusState.eventValue / 100 : 0);
    }

    function applyBonus(probs) {
      const b = bonusTotal();
      if (b === 0) return probs;
      return probs.map(p => Math.min(p + b, 1.0));
    }

    function bonusUpdateUI() {
      const fwcOn   = bonusState.fwcActive;
      const evtOn   = bonusState.eventActive;
      const total   = bonusTotal();
      document.getElementById('bonus-fwcLabel').classList.toggle('on', fwcOn);
      document.getElementById('bonus-eventLabel').classList.toggle('on', evtOn);
      const fwcBadge = document.getElementById('bonus-fwcBadge');
      fwcBadge.textContent = '+' + bonusState.fwcValue + '%';
      fwcBadge.style.opacity = fwcOn ? '1' : '0.35';
      const evtBadge = document.getElementById('bonus-eventBadge');
      evtBadge.textContent = '+' + (bonusState.eventValue || 0) + '%';
      evtBadge.style.opacity = evtOn ? '1' : '0.35';
      const totBdg = document.getElementById('bonus-totalBadge');
      totBdg.textContent = '+' + (total * 100).toFixed(1).replace(/\\.0$/,'') + '%';
      totBdg.classList.toggle('zero', total === 0);
    }

    function bonusSave() {
      bonusState.fwcActive   = document.getElementById('bonus-fwcOn').checked;
      bonusState.fwcValue    = parseFloat(document.getElementById('bonus-fwcPct').value)   || 0;
      bonusState.eventActive = document.getElementById('bonus-eventOn').checked;
      bonusState.eventValue  = parseFloat(document.getElementById('bonus-eventPct').value)  || 0;
      bonusUpdateUI();
    }

    function bonusLoadUI() {
      document.getElementById('bonus-fwcOn').checked    = bonusState.fwcActive;
      document.getElementById('bonus-fwcPct').value     = bonusState.fwcValue;
      document.getElementById('bonus-eventOn').checked  = bonusState.eventActive;
      document.getElementById('bonus-eventPct').value   = bonusState.eventValue;
      bonusUpdateUI();
    }

    // Bonus UI interactions
    document.getElementById('bonus-fwcOn').addEventListener('change', bonusSave);
    document.getElementById('bonus-eventOn').addEventListener('change', bonusSave);
    document.getElementById('bonus-eventPct').addEventListener('input', bonusSave);
    document.getElementById('bonus-fwcCfgBtn').addEventListener('click', () => {
      const row = document.getElementById('bonus-fwcCfgRow');
      const nowHidden = row.classList.toggle('hidden');
      if (!nowHidden) document.getElementById('bonus-fwcPct').focus();
    });
    document.getElementById('bonus-fwcPct').addEventListener('input', bonusSave);
    document.getElementById('bonus-fwcPct').addEventListener('blur', bonusSave);

    // ================================================================
    // WEAPON / ARMOR TAB
    // ================================================================
    let ws  = JSON.parse(JSON.stringify(DWS));
    const api = window.opener?.api;

    const W_MATS = [
      { key:'mineral',     icon:ICONS.minerals    },
      { key:'eron',        icon:ICONS.erons       },
      { key:'sProtect',    icon:ICONS.sprotect    },
      { key:'sProtectLow', icon:ICONS.lowsprotect },
      { key:'dice6',       icon:ICONS.d6          },
      { key:'dice12',      icon:ICONS.d12         },
    ];

    function wRenderMaterials() {
      const grid = document.getElementById('w-matGrid');
      grid.innerHTML = '';
      W_MATS.forEach(m => {
        const row = document.createElement('div');
        row.className = 'mat-row';
        row.innerHTML =
          '<img class="mat-icon" src="' + m.icon + '" />' +
          '<div class="mat-price"><input type="text" inputmode="decimal" id="wmp_' + m.key + '" value="' + fmt.format(ws.prices[m.key]) + '" /></div>' +
          '<label class="mat-check"><input type="checkbox" id="wmo_' + m.key + '"' + (ws.owned[m.key] ? ' checked' : '') + ' />' + STR.owned + '</label>';
        grid.appendChild(row);
        document.getElementById('wmp_' + m.key).addEventListener('input', e => {
          ws.prices[m.key] = parseNum(e.target.value) || 0; wSave();
        });
        document.getElementById('wmp_' + m.key).addEventListener('blur', e => {
          e.target.value = fmt.format(ws.prices[m.key]);
        });
        document.getElementById('wmo_' + m.key).addEventListener('change', e => {
          ws.owned[m.key] = e.target.checked; wSave();
        });
      });
    }

    function wTotalPenya(res, protectType, dt) {
      let t = res.total.penya;
      if (!ws.owned.mineral)     t += res.total.mineral  * ws.prices.mineral;
      if (!ws.owned.eron)        t += res.total.eron     * ws.prices.eron;
      if (protectType === 'sProtect'    && !ws.owned.sProtect)    t += res.total.protects * ws.prices.sProtect;
      if (protectType === 'sProtectLow' && !ws.owned.sProtectLow) t += res.total.protects * ws.prices.sProtectLow;
      const dKey = (dt || 'dice4_6') === 'dice12' ? 'dice12' : 'dice6';
      if (!ws.owned[dKey]) t += res.total.protects * (ws.prices[dKey] || 0);
      return t;
    }

    // SProtect (pity accumulator)
    // alreadyDone: failed attempts already done at the start level (pity counter offset)
    function wCalcSP(from, to, probs, costFn, alreadyDone) {
      alreadyDone = alreadyDone || 0;
      const results = [];
      let totEa = 0, totMin = 0, totEron = 0, totPenya = 0, totProt = 0;
      for (let i = 0; i < to - from; i++) {
        const c  = costFn(from + i);
        const ea = calcEA(probs[i], i === 0 ? alreadyDone : 0);
        const r  = { ea, mineral: ea*c.m, eron: ea*c.m, penya: ea*c.p, protects: ea };
        results.push(r);
        totEa += ea; totMin += r.mineral; totEron += r.eron; totPenya += r.penya; totProt += ea;
      }
      return { results, total: { ea:totEa, mineral:totMin, eron:totEron, penya:totPenya, protects:totProt } };
    }

    // SProtectLow (Markov chain with downgrade, recursive + memo)
    function wCalcSPLow(from, to, probs, costFn) {
      const memo = new Map();
      function get(tgt) {
        if (memo.has(tgt)) return memo.get(tgt);
        const pi = tgt - from, p = probs[pi], c = costFn(tgt);
        if (tgt === from) {
          const ea = 1 / p;
          const r  = { ea, mineral: ea*c.m, eron: ea*c.m, penya: ea*c.p, protects: ea };
          memo.set(tgt, r); return r;
        }
        const prev = get(tgt - 1);
        const ea   = (1 + (1-p) * (prev.ea + 1)) / p;
        const r    = {
          ea,
          mineral:  (c.m + (1-p)*(c.m + prev.mineral))  / p,
          eron:     (c.m + (1-p)*(c.m + prev.eron))      / p,
          penya:    (c.p + (1-p)*(c.p + prev.penya))     / p,
          protects: ea,
        };
        memo.set(tgt, r); return r;
      }
      const results = [];
      let totEa = 0, totMin = 0, totEron = 0, totPenya = 0, totProt = 0;
      for (let i = 0; i < to - from; i++) {
        const r = get(from + i);
        results.push(r);
        totEa += r.ea; totMin += r.mineral; totEron += r.eron; totPenya += r.penya; totProt += r.protects;
      }
      return { results, total: { ea:totEa, mineral:totMin, eron:totEron, penya:totPenya, protects:totProt } };
    }

    // Mix: optimal switch from SPLow → SProtect
    function wCalcMix(from, to, probs, costFn, dt) {
      if (to - from <= 1) return null;
      let bestPenya = Infinity, bestSw = from + 1;
      for (let sw = from + 1; sw < to; sw++) {
        const splR = wCalcSPLow(from, sw,  probs.slice(0, sw - from), costFn);
        const spR  = wCalcSP(sw, to,        probs.slice(sw - from),   costFn);
        const t = wTotalPenya(splR, 'sProtectLow', dt) + wTotalPenya(spR, 'sProtect', dt);
        if (t < bestPenya) { bestPenya = t; bestSw = sw; }
      }
      const splPart = wCalcSPLow(from, bestSw, probs.slice(0, bestSw - from), costFn);
      const spPart  = wCalcSP(bestSw, to,      probs.slice(bestSw - from),    costFn);
      return { switchAt: bestSw, totalPenya: bestPenya, splPart, spPart };
    }

    function wRenderTable(res, probs, from, protectType, dt, alreadyDone) {
      alreadyDone = alreadyDone || 0;
      const tbody = document.getElementById('w-tbody');
      tbody.innerHTML = '';
      res.results.forEach((r, i) => {
        const lvl = from + i;
        let lp = r.penya;
        if (!ws.owned.mineral)     lp += r.mineral * ws.prices.mineral;
        if (!ws.owned.eron)        lp += r.eron    * ws.prices.eron;
        if (protectType === 'sProtect'    && !ws.owned.sProtect)    lp += r.ea * ws.prices.sProtect;
        if (protectType === 'sProtectLow' && !ws.owned.sProtectLow) lp += r.ea * ws.prices.sProtectLow;
        const dKey = (dt || 'dice4_6') === 'dice12' ? 'dice12' : 'dice6';
        if (!ws.owned[dKey]) lp += r.ea * (ws.prices[dKey] || 0);
        const ad = (i === 0 && protectType === 'sProtect') ? alreadyDone : 0;
        const adHtml = ad > 0 ? \` <span class="already-done" title="Bereits \${ad} Versuche gemacht">ab V.\${ad+1}</span>\` : '';
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td class="lvc">+\${lvl-1} → +\${lvl}\${adHtml}</td>
          <td class="r">\${(probs[i]*100).toFixed(2)}%</td>
          <td class="r">\${fmtDec.format(r.ea)}</td>
          <td class="r">\${fmt.format(r.mineral)}</td>
          <td class="r">\${fmt.format(r.eron)}</td>
          <td class="r">\${fmt.format(lp)}</td>\`;
        tbody.appendChild(tr);
      });
      const totalPenya = wTotalPenya(res, protectType, dt);
      const tot = document.createElement('tr');
      tot.className = 'total-row';
      tot.innerHTML = \`<td>\${STR.total}</td><td class="r">-</td>
        <td class="r">\${fmtDec.format(res.total.ea)}</td>
        <td class="r">\${fmt.format(res.total.mineral)}</td>
        <td class="r">\${fmt.format(res.total.eron)}</td>
        <td class="r">\${fmt.format(totalPenya)}</td>\`;
      tbody.appendChild(tot);
    }

    async function wLoad() {
      if (api?.upgradeCalcLoadSettings) {
        try {
          const s = await api.upgradeCalcLoadSettings();
          if (s) {
            ws.prices     = { ...DWS.prices, ...s.prices };
            ws.owned      = { ...DWS.owned,  ...s.owned  };
            ws.diceType   = s.diceType   || DWS.diceType;
            ws.systemMode = s.systemMode || DWS.systemMode;
            if (s.bonus) bonusState = { ...DWS.bonus, ...s.bonus };
          }
        } catch(e) {}
      }
      diceSegSet('w-diceType', ws.diceType);
      document.getElementById('w-mode').value = ws.systemMode;
      bonusLoadUI();
      wRenderMaterials();
    }

    function wSave() {
      ws.diceType   = diceSegVal('w-diceType');
      ws.systemMode = document.getElementById('w-mode').value;
      ws.bonus      = { ...bonusState };
      if (api?.upgradeCalcSaveSettings) { try { api.upgradeCalcSaveSettings(ws); } catch(e) {} }
    }

    function wCalculate() {
      const dt          = diceSegVal('w-diceType');
      const from        = parseInt(document.getElementById('w-from').value);
      const to          = parseInt(document.getElementById('w-to').value);
      const mode        = document.getElementById('w-mode').value;
      const alreadyDone = Math.max(0, parseInt(document.getElementById('w-alreadyDone').value) || 0);
      if (from >= to) { alert('Start-Level muss kleiner als Ziel-Level sein'); return; }
      wSave();

      const probs  = applyBonus((dt === 'dice12' ? GD.weapon.dice12 : GD.weapon.dice4_6).slice(from - 1, to - 1));
      const costMap = new Map(GD.weapon.costs.map(c => [c.l, c]));
      const costFn  = lvl => costMap.get(lvl) || { m:0, p:0 };

      const wRes = document.getElementById('w-results');
      wRes.classList.remove('hidden');

      if (mode === 'compare') {
        document.getElementById('w-singleSection').classList.add('hidden');
        const cmpSec = document.getElementById('w-cmpSection');
        cmpSec.classList.remove('hidden');
        document.getElementById('w-cmpTitle').textContent = STR.totalCost;

        const spRes  = wCalcSP(from, to, probs, costFn, alreadyDone);
        const splRes = wCalcSPLow(from, to, probs, costFn);
        const spPenya  = wTotalPenya(spRes,  'sProtect',    dt);
        const splPenya = wTotalPenya(splRes, 'sProtectLow', dt);
        const mixRes   = wCalcMix(from, to, probs, costFn, dt);

        const spCard  = document.getElementById('w-spCard');
        const splCard = document.getElementById('w-splCard');
        const mixCard = document.getElementById('w-mixCard');
        [spCard, splCard, mixCard].forEach(c => c.classList.remove('cheaper'));

        const mixPenya = mixRes ? mixRes.totalPenya : Infinity;
        const minPenya = Math.min(spPenya, splPenya, mixPenya);
        if (spPenya  === minPenya) spCard.classList.add('cheaper');
        if (splPenya === minPenya) splCard.classList.add('cheaper');
        if (mixRes && mixPenya === minPenya) mixCard.classList.add('cheaper');

        const costs3 = [spPenya, splPenya, ...(mixRes ? [mixPenya] : [])].filter(x => isFinite(x));
        const second = [...costs3].sort((a,b)=>a-b)[1] ?? minPenya;
        const cheapestLabel = spPenya === minPenya ? STR.sProtect : splPenya === minPenya ? STR.sProtectLow : 'Mix';
        const savings = second - minPenya;
        const cheaperHtml = '<span class="cheaper-badge">' + cheapestLabel + ' günstiger</span>' +
          (savings > 0 ? ' — Ersparnis: ' + fmt.format(savings) + ' Penya' : '');

        document.getElementById('w-spSummary').innerHTML =
          '<div class="cmp-value"><img src="' + ICONS.penya + '" />' + fmt.format(spPenya) + '</div>' +
          '<div class="cmp-details">' +
            '<span class="cmp-detail"><img src="' + ICONS.minerals + '" />' + fmt.format(spRes.total.mineral) + '</span>' +
            '<span class="cmp-detail"><img src="' + ICONS.erons + '" />' + fmt.format(spRes.total.eron) + '</span>' +
            '<span class="cmp-detail">' + fmtDec.format(spRes.total.ea) + ' Vers.</span>' +
          '</div>';
        document.getElementById('w-splSummary').innerHTML =
          '<div class="cmp-value"><img src="' + ICONS.penya + '" />' + fmt.format(splPenya) + '</div>' +
          '<div class="cmp-details">' +
            '<span class="cmp-detail"><img src="' + ICONS.minerals + '" />' + fmt.format(splRes.total.mineral) + '</span>' +
            '<span class="cmp-detail"><img src="' + ICONS.erons + '" />' + fmt.format(splRes.total.eron) + '</span>' +
            '<span class="cmp-detail">' + fmtDec.format(splRes.total.ea) + ' Vers.</span>' +
          '</div>';

        if (mixRes) {
          const splCost = wTotalPenya(mixRes.splPart, 'sProtectLow', dt);
          const spCost  = wTotalPenya(mixRes.spPart,  'sProtect',    dt);
          document.getElementById('w-mixSummary').innerHTML =
            '<div class="cmp-value"><img src="' + ICONS.penya + '" />' + fmt.format(mixPenya) + '</div>' +
            '<div class="cmp-details">' +
              '<span style="width:100%;font-size:10px;color:rgba(var(--ar),.6)">SPLow bis +' + (mixRes.switchAt-1) + ', dann SProtect</span>' +
              '<span class="cmp-detail"><img src="' + ICONS.lowsprotect + '" />SPLow: ' + fmt.format(splCost) + '</span>' +
              '<span class="cmp-detail"><img src="' + ICONS.sprotect + '" />SProtect: ' + fmt.format(spCost) + '</span>' +
            '</div>';
          mixCard.style.display = '';
        } else {
          mixCard.style.display = 'none';
        }
        document.getElementById('w-cheaperText').innerHTML = cheaperHtml;

      } else {
        document.getElementById('w-cmpSection').classList.add('hidden');
        const sinSec = document.getElementById('w-singleSection');
        sinSec.classList.remove('hidden');
        const isSP       = mode === 'sProtect';
        const res        = isSP ? wCalcSP(from, to, probs, costFn, alreadyDone) : wCalcSPLow(from, to, probs, costFn);
        const protectType = isSP ? 'sProtect' : 'sProtectLow';
        const icon        = isSP ? ICONS.sprotect : ICONS.lowsprotect;
        const label       = isSP ? STR.sProtect   : STR.sProtectLow;
        document.getElementById('w-singleTitle').innerHTML =
          '<img src="' + icon + '" style="width:14px;height:14px;margin-right:5px;vertical-align:middle" />' + label;
        wRenderTable(res, probs, from, protectType, dt, alreadyDone);
      }
    }

    document.getElementById('w-calcBtn').addEventListener('click', wCalculate);
    document.getElementById('w-from').addEventListener('change', function() {
      const from = parseInt(this.value);
      const toSel = document.getElementById('w-to');
      if (from >= parseInt(toSel.value)) toSel.value = Math.min(from + 1, 11);
      wSave();
    });
    document.getElementById('w-to').addEventListener('change', function() {
      const to = parseInt(this.value);
      const fromSel = document.getElementById('w-from');
      if (parseInt(fromSel.value) >= to) fromSel.value = Math.max(to - 1, 1);
      wSave();
    });
    // Power Dice 12 can only be applied from +5 → +6 onwards (from >= 6)
    diceSegInit('w-diceType', val => {
      if (val === 'dice12') {
        const fromSel = document.getElementById('w-from');
        if (parseInt(fromSel.value) < 6) fromSel.value = 6;
        const toSel = document.getElementById('w-to');
        if (parseInt(toSel.value) <= 6) toSel.value = 7;
      }
      wSave();
    });
    document.getElementById('w-mode').addEventListener('change', wSave);

    // ================================================================
    // PITY TABS — shared renderer (Jewelry, Armor Piercing, Weapon Piercing)
    // ================================================================
    function pitySetupLevels(fromId, toId, max) {
      const fromSel = document.getElementById(fromId);
      const toSel   = document.getElementById(toId);
      const oldFrom = parseInt(fromSel.value) || 1;
      const oldTo   = parseInt(toSel.value)   || max;
      fromSel.innerHTML = Array.from({length: max}, (_, i) =>
        \`<option value="\${i+1}"\${i+1===oldFrom?' selected':''}>+\${i}</option>\`
      ).join('');
      toSel.innerHTML = Array.from({length: max}, (_, i) =>
        \`<option value="\${i+2}"\${i+2===Math.min(oldTo,max+1)?' selected':''}>+\${i+1}</option>\`
      ).join('');
    }

    function pityRender(tbodyId, resultsId, probs, penyaArr, from, to, dicePrice, alreadyDone) {
      alreadyDone = alreadyDone || 0;
      const tbody = document.getElementById(tbodyId);
      tbody.innerHTML = '';
      let total = 0;
      for (let lvl = from; lvl < to; lvl++) {
        const p           = probs[lvl - 1];
        const ad          = lvl === from ? alreadyDone : 0;
        const ea          = calcEA(p, ad);
        const base        = (penyaArr[lvl - 1] || 0) + dicePrice;
        const avg         = ea * base;
        total += avg;
        const adHtml = ad > 0 ? \` <span class="already-done" title="Bereits \${ad} Versuche gemacht">ab V.\${ad+1}</span>\` : '';
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td class="lvc">+\${lvl-1} → +\${lvl}\${adHtml}</td>
          <td class="r">\${(p*100).toFixed(4)}%</td>
          <td class="r">\${fmtDec.format(ea)}</td>
          <td class="r">\${fmt.format(base)}</td>
          <td class="r">\${fmt.format(Math.round(avg))}</td>\`;
        tbody.appendChild(tr);
      }
      const tot = document.createElement('tr');
      tot.className = 'total-row';
      tot.innerHTML = \`<td colspan="4">GESAMT</td><td class="r">\${fmt.format(Math.round(total))}</td>\`;
      tbody.appendChild(tot);
      document.getElementById(resultsId).classList.remove('hidden');
    }

    // Jewelry
    diceSegInit('j-dice');
    pitySetupLevels('j-from', 'j-to', GD.jewelry.max);
    document.getElementById('j-calcBtn').addEventListener('click', () => {
      const probs = applyBonus(GD.jewelry[diceSegVal('j-dice')]);
      const from  = parseInt(document.getElementById('j-from').value);
      const to    = parseInt(document.getElementById('j-to').value);
      const dp    = parseNum(document.getElementById('j-price').value);
      const ad    = Math.max(0, parseInt(document.getElementById('j-alreadyDone').value) || 0);
      if (from >= to) return;
      pityRender('j-tbody', 'j-results', probs, GD.jewelry.penya, from, to, dp, ad);
    });

    // Armor Piercing
    diceSegInit('ap-dice');
    pitySetupLevels('ap-from', 'ap-to', GD.armorPiercing.max);
    document.getElementById('ap-calcBtn').addEventListener('click', () => {
      const probs = applyBonus(GD.armorPiercing[diceSegVal('ap-dice')]);
      const from  = parseInt(document.getElementById('ap-from').value);
      const to    = parseInt(document.getElementById('ap-to').value);
      const dp    = parseNum(document.getElementById('ap-price').value);
      const ad    = Math.max(0, parseInt(document.getElementById('ap-alreadyDone').value) || 0);
      if (from >= to) return;
      pityRender('ap-tbody', 'ap-results', probs, GD.armorPiercing.penya, from, to, dp, ad);
    });

    // Weapon / Shield Piercing
    diceSegInit('wp-dice');
    diceSegInit('wp-type', wpUpdate);
    function wpUpdate() {
      const is2h = diceSegVal('wp-type') === '2h';
      pitySetupLevels('wp-from', 'wp-to', is2h ? GD.weaponPiercing.max2h : GD.weaponPiercing.max1h);
    }
    wpUpdate();
    document.getElementById('wp-calcBtn').addEventListener('click', () => {
      const dt    = diceSegVal('wp-dice');
      const is2h  = diceSegVal('wp-type') === '2h';
      const from  = parseInt(document.getElementById('wp-from').value);
      const to    = parseInt(document.getElementById('wp-to').value);
      const dp    = parseNum(document.getElementById('wp-price').value);
      const ad    = Math.max(0, parseInt(document.getElementById('wp-alreadyDone').value) || 0);
      if (from >= to) return;
      pityRender('wp-tbody', 'wp-results',
        applyBonus(GD.weaponPiercing[dt]),
        is2h ? GD.weaponPiercing.p2h : GD.weaponPiercing.p1h,
        from, to, dp, ad);
    });

    // ================================================================
    // ULTIMATE Waffe
    // ================================================================
    function ultwSetupLevels() {
      const fromSel = document.getElementById('ultw-from');
      const toSel   = document.getElementById('ultw-to');
      fromSel.innerHTML = Array.from({length:10}, (_, i) => \`<option value="\${i+1}">+\${i}</option>\`).join('');
      toSel.innerHTML = Array.from({length:10}, (_, i) => \`<option value="\${i+2}"\${i+1===9?' selected':''}>+\${i+1}</option>\`).join('');
    }
    ultwSetupLevels();
    document.getElementById('ultw-calcBtn').addEventListener('click', () => {
      const probs    = applyBonus(GD.ultimate.wProbs);
      const penya    = GD.ultimate.wPenya;
      const minArr   = GD.ultimate.wMin;
      const from     = parseInt(document.getElementById('ultw-from').value);
      const to       = parseInt(document.getElementById('ultw-to').value);
      const sunP     = parseNum(document.getElementById('ultw-sunstone').value);
      const xpP      = parseNum(document.getElementById('ultw-xprotect').value);
      const minP     = parseNum(document.getElementById('ultw-mineral').value);
      const ad       = Math.max(0, parseInt(document.getElementById('ultw-alreadyDone').value) || 0);
      if (from >= to) return;

      const tbody = document.getElementById('ultw-tbody');
      tbody.innerHTML = '';
      let totalPenya = 0;

      for (let lvl = from; lvl < to; lvl++) {
        const p          = probs[lvl - 1];
        const ea         = calcEA(p, lvl === from ? ad : 0);
        const minCost    = minArr[lvl-1] * minP;
        const perAttempt = penya[lvl-1] + sunP + xpP;
        const avgTotal   = ea * perAttempt + ea * minCost;
        totalPenya += avgTotal;
        const adHtml = (lvl === from && ad > 0) ? \` <span class="already-done" title="Bereits \${ad} Versuche gemacht">ab V.\${ad+1}</span>\` : '';
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td class="lvc">+\${lvl-1} → +\${lvl}\${adHtml}</td>
          <td class="r">\${(p*100).toFixed(4)}%</td>
          <td class="r">\${fmtDec.format(ea)}</td>
          <td class="r">\${fmt.format(Math.round(ea*(minArr[lvl-1]||0)))}</td>
          <td class="r">\${fmt.format(perAttempt)}</td>
          <td class="r">\${fmt.format(Math.round(avgTotal))}</td>\`;
        tbody.appendChild(tr);
      }
      const tot = document.createElement('tr');
      tot.className = 'total-row';
      tot.innerHTML = \`<td colspan="4">GESAMT</td><td class="r">\${fmt.format(Math.round(totalPenya))}</td>\`;
      tbody.appendChild(tot);
      document.getElementById('ultw-results').classList.remove('hidden');
    });

    // ================================================================
    // ULTIMATE Schmuck
    // ================================================================
    function ultjSetupLevels() {
      const fromSel = document.getElementById('ultj-from');
      const toSel   = document.getElementById('ultj-to');
      fromSel.innerHTML = Array.from({length:10}, (_, i) => \`<option value="\${i+1}">+\${i}</option>\`).join('');
      toSel.innerHTML = Array.from({length:10}, (_, i) => \`<option value="\${i+2}"\${i+1===9?' selected':''}>+\${i+1}</option>\`).join('');
    }
    ultjSetupLevels();
    document.getElementById('ultj-calcBtn').addEventListener('click', () => {
      const probs    = applyBonus(GD.ultimate.jProbs);
      const penya    = GD.ultimate.jPenya;
      const from     = parseInt(document.getElementById('ultj-from').value);
      const to       = parseInt(document.getElementById('ultj-to').value);
      const sunP     = parseNum(document.getElementById('ultj-sunstone').value);
      const xpP      = parseNum(document.getElementById('ultj-xprotect').value);
      const ad       = Math.max(0, parseInt(document.getElementById('ultj-alreadyDone').value) || 0);
      if (from >= to) return;

      const tbody = document.getElementById('ultj-tbody');
      tbody.innerHTML = '';
      let totalPenya = 0;

      for (let lvl = from; lvl < to; lvl++) {
        const p          = probs[lvl - 1];
        const ea         = calcEA(p, lvl === from ? ad : 0);
        const perAttempt = penya[lvl-1] + sunP + xpP;
        const avgTotal   = ea * perAttempt;
        totalPenya += avgTotal;
        const adHtml = (lvl === from && ad > 0) ? \` <span class="already-done" title="Bereits \${ad} Versuche gemacht">ab V.\${ad+1}</span>\` : '';
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td class="lvc">+\${lvl-1} → +\${lvl}\${adHtml}</td>
          <td class="r">\${(p*100).toFixed(4)}%</td>
          <td class="r">\${fmtDec.format(ea)}</td>
          <td class="r">\${fmt.format(perAttempt)}</td>
          <td class="r">\${fmt.format(Math.round(avgTotal))}</td>\`;
        tbody.appendChild(tr);
      }
      const tot = document.createElement('tr');
      tot.className = 'total-row';
      tot.innerHTML = \`<td colspan="3">GESAMT</td><td class="r">\${fmt.format(Math.round(totalPenya))}</td>\`;
      tbody.appendChild(tot);
      document.getElementById('ultj-results').classList.remove('hidden');
    });

    // === Init ===
    switchTab('weapon');
    wLoad().then(wCalculate);
  </script>
</body></html>`;
}
