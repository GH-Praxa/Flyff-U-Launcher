import type { TranslationKey } from "../../i18n/translations";
import { t } from "../i18n";
import penyaIcon from "../../assets/penya.png";
import mineralsIcon from "../../assets/minerals.png";
import eronsIcon from "../../assets/erons.png";
import powerdice4Icon from "../../assets/powerdice4.png";
import powerdice6Icon from "../../assets/powerdice6.png";
import powerdice12Icon from "../../assets/powerdice12.png";
import sprotectIcon from "../../assets/sprotect.png";
import lowsprotectIcon from "../../assets/lowsprotect.png";

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

export function buildUpgradeCalculatorHtml(locale: string, theme: ThemeVars): string {
    const intlLocale = localeToIntl(locale);
    const fmt = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
    const upgradeTexts = {
        title: tr("tools.upgrade.title" as TranslationKey),
        diceTypeLabel: tr("tools.upgrade.diceTypeLabel" as TranslationKey),
        dice4_6: tr("tools.upgrade.dice4_6" as TranslationKey),
        dice12: tr("tools.upgrade.dice12" as TranslationKey),
        systemLabel: tr("tools.upgrade.systemLabel" as TranslationKey),
        sProtect: tr("tools.upgrade.sProtect" as TranslationKey),
        sProtectLow: tr("tools.upgrade.sProtectLow" as TranslationKey),
        compare: tr("tools.upgrade.compare" as TranslationKey),
        fromLevel: tr("tools.upgrade.fromLevel" as TranslationKey),
        toLevel: tr("tools.upgrade.toLevel" as TranslationKey),
        sProtectPrice: tr("tools.upgrade.sProtectPrice" as TranslationKey),
        sProtectLowPrice: tr("tools.upgrade.sProtectLowPrice" as TranslationKey),
        dice4Price: tr("tools.upgrade.dice4Price" as TranslationKey),
        dice6Price: tr("tools.upgrade.dice6Price" as TranslationKey),
        dice12Price: tr("tools.upgrade.dice12Price" as TranslationKey),
        owned: tr("tools.upgrade.owned" as TranslationKey),
        materials: tr("tools.upgrade.materials" as TranslationKey),
        calculate: tr("tools.upgrade.calculate" as TranslationKey),
        level: tr("tools.upgrade.level" as TranslationKey),
        chance: tr("tools.upgrade.chance" as TranslationKey),
        attempts: tr("tools.upgrade.attempts" as TranslationKey),
        mineral: tr("tools.upgrade.mineral" as TranslationKey),
        eron: tr("tools.upgrade.eron" as TranslationKey),
        penya: tr("tools.upgrade.penya" as TranslationKey),
        protects: tr("tools.upgrade.protects" as TranslationKey),
        totalCost: tr("tools.upgrade.totalCost" as TranslationKey),
        total: tr("tools.upgrade.total" as TranslationKey),
        cheaper: tr("tools.upgrade.cheaper" as TranslationKey),
    };
    const ar = theme.accentRgb;

    const GAME_DATA = {
        dice4_6: [0.88888889, 0.82352941, 0.75, 0.34736999, 0.20622583, 0.09782638, 0.04562014, 0.01201637, 0.00308911, 0.00050293],
        dice12: [1.0, 1.0, 0.86363636, 0.42264973, 0.24440677, 0.11894919, 0.06385147, 0.01773627, 0.00442309, 0.00067675],
        costs: [
            { level: 1, mineral: 10, penya: 2000 },
            { level: 2, mineral: 14, penya: 4000 },
            { level: 3, mineral: 20, penya: 8000 },
            { level: 4, mineral: 27, penya: 15000 },
            { level: 5, mineral: 38, penya: 30000 },
            { level: 6, mineral: 54, penya: 60000 },
            { level: 7, mineral: 75, penya: 75000 },
            { level: 8, mineral: 105, penya: 125000 },
            { level: 9, mineral: 148, penya: 250000 },
            { level: 10, mineral: 207, penya: 300000 },
        ]
    };

    const ICONS = {
        penya: penyaIcon,
        minerals: mineralsIcon,
        erons: eronsIcon,
        powerdice4: powerdice4Icon,
        powerdice6: powerdice6Icon,
        powerdice12: powerdice12Icon,
        sprotect: sprotectIcon,
        lowsprotect: lowsprotectIcon,
    };

    const DEFAULT_SETTINGS = {
        prices: { mineral: 1000, eron: 1000, sProtect: 18000000, sProtectLow: 10000000, dice4: 500000, dice6: 500000, dice12: 1000000 },
        owned: { mineral: false, eron: false, sProtect: false, sProtectLow: false, dice4: false, dice6: false, dice12: false },
        diceType: "dice4_6",
        systemMode: "compare"
    };

    return `<!doctype html>
<html lang="${intlLocale}">
<head>
  <meta charset="utf-8" />
  <title>${upgradeTexts.title}</title>
  <style>
    :root { color-scheme: dark; --ar: ${ar}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: ${theme.bg}; color: ${theme.text}; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .container { flex: 1; overflow-y: auto; padding: 16px; max-width: 1000px; margin: 0 auto; width: 100%; }
    .container::-webkit-scrollbar { width: 6px; }
    .container::-webkit-scrollbar-thumb { background: rgba(var(--ar), 0.25); border-radius: 3px; }
    h1 { margin: 0 0 16px; font-size: 16px; font-weight: 700; text-align: center; color: rgba(var(--ar), 0.9); letter-spacing: 0.02em; }
    .card { background: ${theme.panel}; border-radius: 12px; padding: 16px; margin-bottom: 12px; border: 1px solid ${theme.stroke}; }
    .card-title { font-size: 13px; font-weight: 700; color: rgba(var(--ar), 0.7); margin-bottom: 12px; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px; }
    .card-title img { width: 20px; height: 20px; object-fit: contain; }
    .form-row { display: flex; gap: 12px; margin-bottom: 8px; }
    .form-group { flex: 1; min-width: 0; }
    label { display: flex; align-items: center; gap: 6px; margin: 8px 0 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(var(--ar), 0.55); }
    label img { width: 16px; height: 16px; object-fit: contain; }
    input, select { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(var(--ar), 0.25); background: ${theme.panel2}; color: ${theme.text}; font-size: 13px; }
    input:focus, select:focus { outline: none; border-color: rgba(var(--ar), 0.7); box-shadow: 0 0 0 2px rgba(var(--ar), 0.15); }
    button { padding: 8px 16px; border-radius: 8px; border: none; background: rgba(var(--ar), 0.2); color: rgba(var(--ar), 0.9); font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
    button:hover { background: rgba(var(--ar), 0.35); }
    button img { width: 18px; height: 18px; object-fit: contain; }
    .btn-calculate { width: 100%; background: rgba(var(--ar), 0.25); padding: 10px; margin-top: 8px; }
    .btn-calculate:hover { background: rgba(var(--ar), 0.45); }
    .hidden { display: none !important; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; padding: 8px 6px; color: rgba(var(--ar), 0.5); font-weight: 700; border-bottom: 1px solid rgba(var(--ar), 0.15); }
    th.img-header { padding: 8px 4px; width: 28px; }
    th img { width: 16px; height: 16px; object-fit: contain; vertical-align: middle; }
    td { padding: 6px; border-bottom: 1px solid rgba(var(--ar), 0.06); }
    td.img-cell { padding: 4px; text-align: center; }
    td.img-cell img { width: 18px; height: 18px; object-fit: contain; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .number { text-align: right; font-variant-numeric: tabular-nums; }
    .total-row { background: rgba(var(--ar), 0.08); font-weight: 700; }
    .total-row td { border-bottom: none; }
    .comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .comparison-card { background: rgba(var(--ar), 0.05); border-radius: 10px; padding: 14px; border: 2px solid transparent; transition: all 0.2s ease; }
    .comparison-card.cheaper { border-color: rgba(76, 175, 80, 0.6); background: rgba(76, 175, 80, 0.1); }
    .comparison-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .comparison-header img { width: 24px; height: 24px; object-fit: contain; }
    .comparison-title { font-size: 12px; font-weight: 700; color: rgba(var(--ar), 0.8); }
    .comparison-value { font-size: 16px; font-weight: 700; color: rgba(var(--ar), 0.95); display: flex; align-items: center; gap: 6px; }
    .comparison-value img { width: 18px; height: 18px; object-fit: contain; }
    .comparison-details { font-size: 10px; color: rgba(var(--ar), 0.5); margin-top: 6px; display: flex; flex-wrap: wrap; gap: 8px; }
    .comparison-detail { display: flex; align-items: center; gap: 3px; }
    .comparison-detail img { width: 14px; height: 14px; object-fit: contain; }
    .cheaper-badge { background: rgba(76, 175, 80, 0.25); color: #6fcf73; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }
    .price-input { width: 100%; }
    .level-cell { font-weight: 600; color: rgba(var(--ar), 0.8); }
    .dice-select { position: relative; }
    .dice-icons { display: flex; gap: 4px; align-items: center; }
    .dice-icons img { width: 16px; height: 16px; object-fit: contain; }
    .materials-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .material-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: rgba(var(--ar), 0.04); border-radius: 8px; }
    .material-row.disabled { opacity: 0.4; }
    .material-icon { width: 20px; height: 20px; object-fit: contain; flex-shrink: 0; }
    .material-price { flex: 1; min-width: 0; }
    .material-price input { padding: 6px 8px; font-size: 12px; }
    .material-check { display: flex; align-items: center; gap: 4px; font-size: 10px; color: rgba(var(--ar), 0.6); cursor: pointer; }
    .material-check input { width: 14px; height: 14px; accent-color: rgba(var(--ar), 0.8); cursor: pointer; }
    .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(var(--ar), 0.5); margin: 12px 0 8px; padding-top: 8px; border-top: 1px solid rgba(var(--ar), 0.1); }
  </style>
</head>
<body>
  <div class="container">
    <h1>${upgradeTexts.title}</h1>

    <div class="card">
      <div class="card-title">
        <img src="${ICONS.powerdice6}" alt="Dice" />
        ${upgradeTexts.systemLabel}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>
            <div class="dice-icons"><img src="${ICONS.powerdice4}" /><img src="${ICONS.powerdice6}" /></div>
            ${upgradeTexts.diceTypeLabel}
          </label>
          <select id="diceType">
            <option value="dice4_6">${upgradeTexts.dice4_6}</option>
            <option value="dice12">${upgradeTexts.dice12}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${upgradeTexts.fromLevel}</label>
          <select id="fromLevel">
            ${Array.from({length: 10}, (_, i) => `<option value="${i+1}"${i===0?' selected':''}>+${i}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>${upgradeTexts.toLevel}</label>
          <select id="toLevel">
            ${Array.from({length: 10}, (_, i) => `<option value="${i+2}"${i===9?' selected':''}>+${i+1}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Modus</label>
          <select id="systemMode">
            <option value="compare">${upgradeTexts.compare}</option>
            <option value="sProtect">${upgradeTexts.sProtect}</option>
            <option value="sProtectLow">${upgradeTexts.sProtectLow}</option>
          </select>
        </div>
      </div>
      
      <div class="section-label">${upgradeTexts.materials}</div>
      <div class="materials-grid" id="materialsGrid"></div>
      
      <button class="btn-calculate" id="calculateBtn">
        <img src="${ICONS.penya}" alt="Calculate" />
        ${upgradeTexts.calculate}
      </button>
    </div>

    <div class="card hidden" id="resultsCard">
      <div class="card-title" id="resultsTitle">Ergebnisse</div>
      <div id="singleResults"></div>
      <div id="comparisonResults" class="hidden">
        <div class="comparison-grid">
          <div class="comparison-card" id="sProtectCard">
            <div class="comparison-header">
              <img src="${ICONS.sprotect}" alt="SProtect" />
              <span class="comparison-title">${upgradeTexts.sProtect}</span>
            </div>
            <div id="sProtectSummary"></div>
          </div>
          <div class="comparison-card" id="sProtectLowCard">
            <div class="comparison-header">
              <img src="${ICONS.lowsprotect}" alt="Low SProtect" />
              <span class="comparison-title">${upgradeTexts.sProtectLow}</span>
            </div>
            <div id="sProtectLowSummary"></div>
          </div>
        </div>
        <div style="margin-top: 12px; font-size: 12px; color: rgba(var(--ar), 0.6); text-align: center;" id="cheaperText"></div>
      </div>
      <table id="resultsTable">
        <thead>
          <tr>
            <th>${upgradeTexts.level}</th>
            <th class="number">${upgradeTexts.chance}</th>
            <th class="number">${upgradeTexts.attempts}</th>
            <th class="img-header"><img src="${ICONS.minerals}" alt="Minerals" title="${upgradeTexts.mineral}" /></th>
            <th class="img-header"><img src="${ICONS.erons}" alt="Erons" title="${upgradeTexts.eron}" /></th>
            <th class="img-header"><img src="${ICONS.penya}" alt="Penya" title="${upgradeTexts.penya}" /></th>
          </tr>
        </thead>
        <tbody id="resultsBody"></tbody>
      </table>
    </div>
  </div>

  <script>
    const intlLocale = '${intlLocale}';
    const fmt = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
    const fmtDecimal = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 });
    const GAME_DATA = ${JSON.stringify(GAME_DATA)};
    const STR = ${JSON.stringify({
        total: upgradeTexts.total,
        totalCost: upgradeTexts.totalCost,
        cheaper: upgradeTexts.cheaper,
        sProtect: upgradeTexts.sProtect,
        sProtectLow: upgradeTexts.sProtectLow,
        owned: upgradeTexts.owned
    })};
    const ICONS = ${JSON.stringify(ICONS)};
    const DEFAULT_SETTINGS = ${JSON.stringify(DEFAULT_SETTINGS)};
    
    const MATERIALS = [
      { key: 'mineral', icon: ICONS.minerals },
      { key: 'eron', icon: ICONS.erons },
      { key: 'sProtect', icon: ICONS.sprotect },
      { key: 'sProtectLow', icon: ICONS.lowsprotect },
      { key: 'dice4', icon: ICONS.powerdice4 },
      { key: 'dice6', icon: ICONS.powerdice6 },
      { key: 'dice12', icon: ICONS.powerdice12 }
    ];

    let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const api = window.opener?.api;

    class UpgradeCalculator {
      constructor() {
        this.levelCosts = new Map();
      }
      setLevelCosts(costs) {
        this.levelCosts.clear();
        costs.forEach(c => this.levelCosts.set(c.level, { level: c.level, mineral: c.mineral, eron: c.mineral, penya: c.penya }));
      }
      getCost(level) {
        const cost = this.levelCosts.get(level);
        if (!cost) throw new Error('Keine Kosten für Level ' + level);
        return cost;
      }
      calculateExpectedAttemptsSProtect(baseProb) {
        if (baseProb <= 0 || baseProb > 1) return 1;
        if (baseProb >= 1) return 1;
        const maxAttempt = Math.ceil(1 / baseProb);
        let expectedAttempts = 0;
        let product = 1.0;
        for (let k = 1; k <= maxAttempt; k++) {
          const successProb = Math.min(k * baseProb, 1.0);
          expectedAttempts += k * product * successProb;
          if (k < maxAttempt) product *= (1 - successProb);
        }
        return expectedAttempts;
      }
      calculateSProtect(startLevel, endLevel, levelProbs) {
        const levelResults = [];
        let totalCosts = { mineral: 0, eron: 0, penya: 0, protects: 0 };
        let totalAttempts = 0;
        for (let i = 0; i < levelProbs.length; i++) {
          const level = startLevel + i;
          const baseProb = levelProbs[i];
          const cost = this.getCost(level);
          const expectedAttempts = this.calculateExpectedAttemptsSProtect(baseProb);
          const levelCost = {
            expectedAttempts,
            costs: {
              mineral: expectedAttempts * cost.mineral,
              eron: expectedAttempts * cost.eron,
              penya: expectedAttempts * cost.penya,
              protects: expectedAttempts
            }
          };
          levelResults.push(levelCost);
          totalAttempts += expectedAttempts;
          totalCosts.mineral += levelCost.costs.mineral;
          totalCosts.eron += levelCost.costs.eron;
          totalCosts.penya += levelCost.costs.penya;
          totalCosts.protects += levelCost.costs.protects;
        }
        return { system: 'sProtect', fromLevel: startLevel, toLevel: endLevel, levelResults, total: { expectedAttempts: totalAttempts, costs: totalCosts } };
      }
      calculateExpectedCostsWithDowngradeFixed(targetLevel, startLevel, allProbs, memo) {
        if (targetLevel === startLevel) {
          const probIndex = targetLevel - startLevel;
          const prob = allProbs[probIndex];
          const cost = this.getCost(targetLevel);
          const expectedAttempts = 1 / prob;
          return {
            expectedAttempts,
            costs: {
              mineral: expectedAttempts * cost.mineral,
              eron: expectedAttempts * cost.eron,
              penya: expectedAttempts * cost.penya,
              protects: expectedAttempts
            }
          };
        }
        if (memo.has(targetLevel)) return memo.get(targetLevel);
        const probIndex = targetLevel - startLevel;
        const p = allProbs[probIndex];
        const cost = this.getCost(targetLevel);
        const prevLevelCosts = this.calculateExpectedCostsWithDowngradeFixed(targetLevel - 1, startLevel, allProbs, memo);
        const expectedAttempts = (1 + (1 - p) * (prevLevelCosts.expectedAttempts + 1)) / p;
        const levelCost = {
          expectedAttempts,
          costs: {
            mineral: (cost.mineral + (1 - p) * (cost.mineral + prevLevelCosts.costs.mineral)) / p,
            eron: (cost.eron + (1 - p) * (cost.eron + prevLevelCosts.costs.eron)) / p,
            penya: (cost.penya + (1 - p) * (cost.penya + prevLevelCosts.costs.penya)) / p,
            protects: expectedAttempts
          }
        };
        memo.set(targetLevel, levelCost);
        return levelCost;
      }
      calculateSProtectLow(startLevel, endLevel, levelProbs) {
        const levelResults = [];
        let totalCosts = { mineral: 0, eron: 0, penya: 0, protects: 0 };
        let totalAttempts = 0;
        const memo = new Map();
        for (let i = 0; i < levelProbs.length; i++) {
          const level = startLevel + i;
          const levelCost = this.calculateExpectedCostsWithDowngradeFixed(level, startLevel, levelProbs, memo);
          levelResults.push(levelCost);
          totalAttempts += levelCost.expectedAttempts;
          totalCosts.mineral += levelCost.costs.mineral;
          totalCosts.eron += levelCost.costs.eron;
          totalCosts.penya += levelCost.costs.penya;
          totalCosts.protects += levelCost.costs.protects;
        }
        return { system: 'sProtectLow', fromLevel: startLevel, toLevel: endLevel, levelResults, total: { expectedAttempts: totalAttempts, costs: totalCosts } };
      }
    }

    const calculator = new UpgradeCalculator();

    function parseLocalizedNumber(val) {
      const cleaned = val.replace(/\\./g, '').replace(',', '.');
      return Number(cleaned);
    }

    function formatNumber(num) {
      return fmt.format(Math.round(num));
    }

    function formatDecimal(num) {
      return fmtDecimal.format(num);
    }

    function formatPercent(prob) {
      return (prob * 100).toFixed(2) + '%';
    }

    function getProbs(diceType, fromLevel, toLevel) {
      const probs = diceType === 'dice12' ? GAME_DATA.dice12 : GAME_DATA.dice4_6;
      return probs.slice(fromLevel - 1, toLevel - 1);
    }

    function getCosts(fromLevel, toLevel) {
      return GAME_DATA.costs.filter(c => c.level >= fromLevel && c.level < toLevel);
    }

    function calcTotalPenya(result, owned) {
      let total = result.total.costs.penya;
      if (!owned.mineral) total += result.total.costs.mineral * settings.prices.mineral;
      if (!owned.eron) total += result.total.costs.eron * settings.prices.eron;
      return total;
    }

    function calcTotalPenyaWithProtect(result, protectType, owned) {
      let total = calcTotalPenya(result, owned);
      if (protectType === 'sProtect' && !owned.sProtect) {
        total += result.total.costs.protects * settings.prices.sProtect;
      } else if (protectType === 'sProtectLow' && !owned.sProtectLow) {
        total += result.total.costs.protects * settings.prices.sProtectLow;
      }
      if (!owned.dice4) total += result.total.costs.protects * settings.prices.dice4;
      if (!owned.dice6) total += result.total.costs.protects * settings.prices.dice6;
      return total;
    }

    function renderMaterialsGrid() {
      const grid = document.getElementById('materialsGrid');
      grid.innerHTML = '';
      MATERIALS.forEach(m => {
        const row = document.createElement('div');
        row.className = 'material-row' + (settings.owned[m.key] ? ' disabled' : '');
        row.innerHTML = 
          '<img class="material-icon" src="' + m.icon + '" alt="" />' +
          '<div class="material-price"><input type="text" inputmode="decimal" id="price_' + m.key + '" value="' + fmt.format(settings.prices[m.key]) + '" /></div>' +
          '<label class="material-check"><input type="checkbox" id="owned_' + m.key + '"' + (settings.owned[m.key] ? ' checked' : '') + ' />' + STR.owned + '</label>';
        grid.appendChild(row);
        
        const priceInput = row.querySelector('#price_' + m.key);
        priceInput.addEventListener('input', () => {
          settings.prices[m.key] = parseLocalizedNumber(priceInput.value) || 0;
          saveSettings();
        });
        priceInput.addEventListener('blur', () => {
          priceInput.value = fmt.format(settings.prices[m.key]);
        });
        
        const ownedCheck = row.querySelector('#owned_' + m.key);
        ownedCheck.addEventListener('change', () => {
          settings.owned[m.key] = ownedCheck.checked;
          row.className = 'material-row' + (settings.owned[m.key] ? ' disabled' : '');
          saveSettings();
        });
      });
    }

    function renderTable(result, probs, protectType) {
      const tbody = document.getElementById('resultsBody');
      tbody.innerHTML = '';
      
      result.levelResults.forEach((r, i) => {
        const level = result.fromLevel + i;
        const prob = probs[i];
        let levelPenya = r.costs.penya;
        if (!settings.owned.mineral) levelPenya += r.costs.mineral * settings.prices.mineral;
        if (!settings.owned.eron) levelPenya += r.costs.eron * settings.prices.eron;
        if (protectType === 'sProtect' && !settings.owned.sProtect) levelPenya += r.expectedAttempts * settings.prices.sProtect;
        if (protectType === 'sProtectLow' && !settings.owned.sProtectLow) levelPenya += r.expectedAttempts * settings.prices.sProtectLow;
        
        const row = document.createElement('tr');
        row.innerHTML = '<td class="level-cell">+' + (level - 1) + ' &rarr; +' + level + '</td>' +
          '<td class="number">' + formatPercent(prob) + '</td>' +
          '<td class="number">' + formatDecimal(r.expectedAttempts) + '</td>' +
          '<td class="number">' + formatNumber(r.costs.mineral) + '</td>' +
          '<td class="number">' + formatNumber(r.costs.eron) + '</td>' +
          '<td class="number">' + formatNumber(levelPenya) + '</td>';
        tbody.appendChild(row);
      });
      
      let totalPenya = calcTotalPenyaWithProtect(result, protectType, settings.owned);
      
      const totalRow = document.createElement('tr');
      totalRow.className = 'total-row';
      totalRow.innerHTML = '<td>' + STR.total + '</td>' +
        '<td class="number">-</td>' +
        '<td class="number">' + formatDecimal(result.total.expectedAttempts) + '</td>' +
        '<td class="number">' + formatNumber(result.total.costs.mineral) + '</td>' +
        '<td class="number">' + formatNumber(result.total.costs.eron) + '</td>' +
        '<td class="number">' + formatNumber(totalPenya) + '</td>';
      tbody.appendChild(totalRow);
    }

    async function loadSettings() {
      if (api?.upgradeCalcLoadSettings) {
        try {
          const saved = await api.upgradeCalcLoadSettings();
          if (saved) {
            settings = { ...DEFAULT_SETTINGS, ...saved };
            settings.prices = { ...DEFAULT_SETTINGS.prices, ...saved.prices };
            settings.owned = { ...DEFAULT_SETTINGS.owned, ...saved.owned };
          }
        } catch (e) { console.error('Failed to load settings:', e); }
      }
      document.getElementById('diceType').value = settings.diceType;
      document.getElementById('systemMode').value = settings.systemMode;
      renderMaterialsGrid();
    }

    async function saveSettings() {
      settings.diceType = document.getElementById('diceType').value;
      settings.systemMode = document.getElementById('systemMode').value;
      if (api?.upgradeCalcSaveSettings) {
        try {
          await api.upgradeCalcSaveSettings(settings);
        } catch (e) { console.error('Failed to save settings:', e); }
      }
    }

    function calculate() {
      const diceType = document.getElementById('diceType').value;
      const fromLevel = parseInt(document.getElementById('fromLevel').value);
      const toLevel = parseInt(document.getElementById('toLevel').value);
      const mode = document.getElementById('systemMode').value;

      if (fromLevel >= toLevel) {
        alert('Start-Level muss kleiner als Ziel-Level sein');
        return;
      }

      saveSettings();

      const probs = getProbs(diceType, fromLevel, toLevel);
      const costs = getCosts(fromLevel, toLevel);
      calculator.setLevelCosts(costs);

      const resultsCard = document.getElementById('resultsCard');
      const singleResults = document.getElementById('singleResults');
      const comparisonResults = document.getElementById('comparisonResults');
      const resultsTitle = document.getElementById('resultsTitle');

      resultsCard.classList.remove('hidden');

      if (mode === 'compare') {
        singleResults.classList.add('hidden');
        comparisonResults.classList.remove('hidden');
        resultsTitle.textContent = STR.totalCost;

        const sProtectResult = calculator.calculateSProtect(fromLevel, toLevel, probs);
        const sProtectLowResult = calculator.calculateSProtectLow(fromLevel, toLevel, probs);

        const sProtectTotalPenya = calcTotalPenyaWithProtect(sProtectResult, 'sProtect', settings.owned);
        const sProtectLowTotalPenya = calcTotalPenyaWithProtect(sProtectLowResult, 'sProtectLow', settings.owned);

        const sProtectCard = document.getElementById('sProtectCard');
        const sProtectLowCard = document.getElementById('sProtectLowCard');
        sProtectCard.classList.remove('cheaper');
        sProtectLowCard.classList.remove('cheaper');

        let cheaperText = '';
        if (sProtectTotalPenya < sProtectLowTotalPenya) {
          sProtectCard.classList.add('cheaper');
          const diff = sProtectLowTotalPenya - sProtectTotalPenya;
          cheaperText = '<span class="cheaper-badge">' + STR.sProtect + ' cheaper</span> Save ' + formatNumber(diff) + ' Penya';
        } else if (sProtectLowTotalPenya < sProtectTotalPenya) {
          sProtectLowCard.classList.add('cheaper');
          const diff = sProtectTotalPenya - sProtectLowTotalPenya;
          cheaperText = '<span class="cheaper-badge">' + STR.sProtectLow + ' cheaper</span> Save ' + formatNumber(diff) + ' Penya';
        } else {
          cheaperText = 'Both systems cost the same';
        }

        document.getElementById('sProtectSummary').innerHTML =
          '<div class="comparison-value"><img src="' + ICONS.penya + '" alt="Penya" />' + formatNumber(sProtectTotalPenya) + '</div>' +
          '<div class="comparison-details">' +
            '<span class="comparison-detail"><img src="' + ICONS.minerals + '" />' + formatNumber(sProtectResult.total.costs.mineral) + '</span>' +
            '<span class="comparison-detail"><img src="' + ICONS.erons + '" />' + formatNumber(sProtectResult.total.costs.eron) + '</span>' +
            '<span class="comparison-detail">' + formatDecimal(sProtectResult.total.expectedAttempts) + ' tries</span>' +
          '</div>';

        document.getElementById('sProtectLowSummary').innerHTML =
          '<div class="comparison-value"><img src="' + ICONS.penya + '" alt="Penya" />' + formatNumber(sProtectLowTotalPenya) + '</div>' +
          '<div class="comparison-details">' +
            '<span class="comparison-detail"><img src="' + ICONS.minerals + '" />' + formatNumber(sProtectLowResult.total.costs.mineral) + '</span>' +
            '<span class="comparison-detail"><img src="' + ICONS.erons + '" />' + formatNumber(sProtectLowResult.total.costs.eron) + '</span>' +
            '<span class="comparison-detail">' + formatDecimal(sProtectLowResult.total.expectedAttempts) + ' tries</span>' +
          '</div>';

        document.getElementById('cheaperText').innerHTML = cheaperText;
        document.getElementById('resultsTable').classList.add('hidden');

      } else {
        singleResults.classList.remove('hidden');
        comparisonResults.classList.add('hidden');
        document.getElementById('resultsTable').classList.remove('hidden');

        let result, protectType, title, icon;
        if (mode === 'sProtect') {
          result = calculator.calculateSProtect(fromLevel, toLevel, probs);
          protectType = 'sProtect';
          title = STR.sProtect;
          icon = ICONS.sprotect;
        } else {
          result = calculator.calculateSProtectLow(fromLevel, toLevel, probs);
          protectType = 'sProtectLow';
          title = STR.sProtectLow;
          icon = ICONS.lowsprotect;
        }

        resultsTitle.innerHTML = '<img src="' + icon + '" alt="" style="width:20px;height:20px;margin-right:8px;" />' + title;
        renderTable(result, probs, protectType);
      }
    }

    document.getElementById('calculateBtn').addEventListener('click', calculate);
    document.querySelectorAll('select').forEach(el => {
      el.addEventListener('change', saveSettings);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') calculate(); });
    });

    document.getElementById('fromLevel').addEventListener('change', function() {
      const from = parseInt(this.value);
      const toSelect = document.getElementById('toLevel');
      const to = parseInt(toSelect.value);
      if (from >= to) toSelect.value = Math.min(from + 1, 11);
    });

    document.getElementById('toLevel').addEventListener('change', function() {
      const to = parseInt(this.value);
      const fromSelect = document.getElementById('fromLevel');
      const from = parseInt(fromSelect.value);
      if (from >= to) fromSelect.value = Math.max(to - 1, 1);
    });

    document.getElementById('diceType').addEventListener('change', function() {
      const label = this.previousElementSibling;
      if (this.value === 'dice12') {
        label.innerHTML = '<img src="' + ICONS.powerdice12 + '" style="width:16px;height:16px;" />' + label.textContent.trim();
      } else {
        label.innerHTML = '<div class="dice-icons"><img src="' + ICONS.powerdice4 + '" /><img src="' + ICONS.powerdice6 + '" /></div>' + label.textContent.trim();
      }
    });

    loadSettings().then(calculate);
  </script>
</body>
</html>`;
}
