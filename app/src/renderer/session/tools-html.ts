import type { TranslationKey } from "../../i18n/translations";
import { t } from "../i18n";

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
    const sampleRate = 200_000;
    const sampleAmount = 60;
    const sampleResult = sampleRate * sampleAmount;
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
    const fmt=new Intl.NumberFormat(intlLocale);
    let internalUpdate=false;
    const parseVal=(val)=>{const cleaned=val.replace(/\\./g,'').replace(',','.');return Number(cleaned);};
    const fmtVal=(num)=>Number.isFinite(num)?fmt.format(num):'';
    function calcFromRateAmount(){
      if(internalUpdate)return;
      const rate=parseVal(rateInput.value);
      const amount=parseVal(amountInput.value);
      if(!Number.isFinite(rate)||rate<=0){penyaInput.value='';return;}
      if(!Number.isFinite(amount)||amount<0){penyaInput.value='';return;}
      const total=rate*amount;
      const kTotal=rate*1000;
      internalUpdate=true;
      penyaInput.value=fmtVal(total);
      penyaInput.title=fmt.format(amount)+" FC ≈ "+fmt.format(total)+" Penya (1000 FC ≈ "+fmt.format(kTotal)+")";
      internalUpdate=false;
    }
    function calcFromPenya(){
      if(internalUpdate)return;
      const rate=parseVal(rateInput.value);
      const penya=parseVal(penyaInput.value);
      if(!Number.isFinite(rate)||rate<=0){amountInput.value='';return;}
      if(!Number.isFinite(penya)||penya<0){amountInput.value='';return;}
      const amount=penya/rate;
      internalUpdate=true;
      amountInput.value=fmtVal(amount);
      internalUpdate=false;
    }
    rateInput.addEventListener('input',()=>{calcFromRateAmount();});
    amountInput.addEventListener('input',()=>{calcFromRateAmount();});
    penyaInput.addEventListener('input',()=>{calcFromPenya();});
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
