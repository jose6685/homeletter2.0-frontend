const topics = [
  "工作 / 職場", "家庭 / 關係", "壓力 / 焦慮", "病痛 / 醫治",
  "供應 / 需要", "饒恕 / 和好", "方向 / 抉擇", "信心 / 盼望",
  "平安 / 安息", "感恩 / 敬拜", "經濟 / 財富", "出行 / 旅遊",
  "人際關係", "憂傷 / 煩悶"
];

const btnRandom = document.getElementById("btnRandom");
const btnGenerate = document.getElementById("btnGenerate");
const topicSelect = document.getElementById("topicSelect");
const letterEl = document.getElementById("letter");
const letterContentEl = document.getElementById("letterContent");
const letterBodyEl = document.getElementById("letterBody");
const btnSave = document.getElementById("btnSave");
const btnShare = document.getElementById("btnShare");
const btnShareLine = document.getElementById("btnShareLine");
const btnShareFacebook = document.getElementById("btnShareFacebook");
const btnSpeakToggle = document.getElementById("btnSpeakToggle");
const btnOpenMailbox = document.getElementById("btnOpenMailbox");
const metaEl = document.getElementById("meta");
const loadingEl = document.getElementById("loading");
const adNotice = document.getElementById("adNotice");
const lottieContainer = document.getElementById("lottieContainer");
const timeMessageEl = document.getElementById("timeMessage");
const timeMarqueeEl = document.getElementById("timeMarquee");
const clockEl = document.getElementById("clock");
const fabMailboxBtn = document.getElementById("fabMailbox");
const mailboxPopover = document.getElementById("mailboxPopover");
const closePopoverBtn = document.getElementById("closePopover");
const btnGoHomeTop = document.getElementById("btnGoHomeTop");
const goHomeFromMailbox = document.getElementById("goHomeFromMailbox");
const mailboxList = document.getElementById("mailboxList");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const pageIndicator = document.getElementById("pageIndicator");
const mailboxFooter = document.getElementById("mailboxFooter");
const bottomAdBanner = document.getElementById("bottomAdBanner");

let lottieAnim = null;
let lastGenerated = null;
let mailboxCache = [];
let mailboxPage = 1;
const MAILBOX_PAGE_SIZE = 6;

// --- 廣告門檻：每日各一次免廣告（隨機 / 主題） + 累積次數記錄 ---
const DRAW_KEYS = { random: 'homeletter_draw_random', topic: 'homeletter_draw_topic' }; // 累積次數（非門檻）
const FREE_KEYS = { random: 'homeletter_free_random_date', topic: 'homeletter_free_topic_date' }; // 當日是否已用免廣告
function getDrawCount(type){
  const v = parseInt(localStorage.getItem(DRAW_KEYS[type])||'0',10);
  return Number.isFinite(v) ? v : 0;
}
function incDrawCount(type){
  const v = getDrawCount(type) + 1;
  localStorage.setItem(DRAW_KEYS[type], String(v));
  return v;
}
function todayStr(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function isFreeToday(type){
  const k = FREE_KEYS[type];
  const v = localStorage.getItem(k) || '';
  return v !== todayStr();
}
function consumeFree(type){
  const k = FREE_KEYS[type];
  localStorage.setItem(k, todayStr());
}

function setNotice(msg){
  if (!adNotice) return;
  if (msg){
    adNotice.textContent = msg;
    adNotice.classList.remove('hidden');
  } else {
    adNotice.textContent = '';
    adNotice.classList.add('hidden');
  }
}

// GPT Rewarded 初始化與播放（修正 API 調用，使用 OutOfPageSlot REWARDED）
let gptInitialized = false;
function initGPT(){
  return new Promise((resolve)=>{
    window.googletag = window.googletag || { cmd: [] };
    googletag.cmd.push(function(){
      if (!gptInitialized){
        try { googletag.pubads().enableSingleRequest(); } catch{}
        try { googletag.enableServices(); } catch{}
        gptInitialized = true;
      }
      resolve();
    });
  });
}

function playRewardedAd(){
  return new Promise(async (resolve)=>{
    // SAFE MODE：不觸發實際廣告，直接授予獎勵
    if (window.SAFE_MODE) { resolve(true); return; }

    // 若是從原生 Rewarded 返回（TWA Activity 會帶上 ?rewarded=1），授予獎勵並清理參數
    try {
      const usp = new URLSearchParams(location.search || '');
      const fromNative = usp.get('rewarded');
      if (fromNative === '1') {
        try {
          const url = new URL(location.href);
          url.searchParams.delete('rewarded');
          history.replaceState(null, document.title, url.toString());
        } catch {}
        resolve(true);
        return;
      }
    } catch {}

    let granted = false;
    let done = false;
    const TIMEOUT_MS = 12000; // 逾時保護，避免卡住
    let slotRef = null;

    // ANDROID：先嘗試喚起原生 Rewarded（homeletter://rewarded），若 1.2 秒內未離開則回退到 GPT
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    if (isAndroid) {
      try {
        const intentUrl = 'intent://rewarded#Intent;scheme=homeletter;package=org.homeletter.app;end';
        // 以導向方式觸發，若 App 未能處理則會留在原頁面
        window.location.href = intentUrl;
      } catch {}
      // 短暫等待，若仍在頁面則回退到 GPT
      await new Promise(r => setTimeout(r, 1200));
      // 若使用者已離開去看原生廣告，這段不會執行；否則繼續走 GPT 流程
    }

    await initGPT();
    googletag.cmd.push(function(){
      let timeoutId = null;
      const cleanupAndResolve = (ok)=>{
        if (done) return; done = true;
        if (timeoutId) { try { clearTimeout(timeoutId); } catch{} }
        try {
          if (slotRef) { googletag.destroySlots([slotRef]); }
        } catch{}
        resolve(!!ok);
      };

      try {
        const adUnit = (window.GPT_REWARDED_AD_UNIT || '/21800000000/homeletter_rewarded');
        const slot = googletag.defineOutOfPageSlot(
          adUnit,
          googletag.enums.OutOfPageFormat.REWARDED
        );
        if (!slot) { console.warn('GPT Rewarded 未建立 slot'); cleanupAndResolve(false); return; }
        slotRef = slot;
        slot.addService(googletag.pubads());

        // 設置逾時：若事件未到達，回傳失敗避免流程卡住
        timeoutId = setTimeout(()=>{
          console.warn('GPT Rewarded 逾時未顯示，回傳失敗');
          cleanupAndResolve(false);
        }, TIMEOUT_MS);

        // 事件監聽
        googletag.pubads().addEventListener('rewardedSlotGranted', function(){
          granted = true;
          console.debug('GPT Rewarded: granted');
        });
        googletag.pubads().addEventListener('rewardedSlotClosed', function(){
          console.debug('GPT Rewarded: closed, granted =', granted);
          cleanupAndResolve(granted);
        });
        googletag.pubads().addEventListener('rewardedSlotReady', function(event){
          try {
            console.debug('GPT Rewarded: ready, show');
            googletag.pubads().showRewarded(slot);
          } catch(e){ console.error('GPT Rewarded 顯示失敗：', e); }
        });

      } catch (e) {
        console.error('GPT Rewarded 初始化失敗：', e);
        cleanupAndResolve(false);
      }
    });
  });
}

// AdSense 底部橫幅初始化（Option B）
function initBottomBanner(){
  try {
    if (bottomAdBanner && !window.SAFE_MODE) {
      const ins = bottomAdBanner.querySelector('ins.adsbygoogle');
      if (ins) {
        const client = window.ADSENSE_CLIENT || ins.getAttribute('data-ad-client');
        const slot = window.ADSENSE_SLOT || ins.getAttribute('data-ad-slot');
        if (client) ins.setAttribute('data-ad-client', client);
        if (slot) ins.setAttribute('data-ad-slot', slot);
      }
      if (window.adsbygoogle) {
        try {
          (adsbygoogle = window.adsbygoogle || []).push({});
          console.debug('AdSense banner push');
        } catch(e) {
          console.warn('AdSense push 異常：', e);
        }
      } else {
        console.warn('AdSense 物件未載入，稍後再試');
        setTimeout(()=>{
          try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch{}
        }, 3000);
      }
    }
  } catch{}
}

// 部署策略：固定使用後端 API_BASE（由 config.js 提供），不再依賴前端域名下的 /api 重寫
const API_BASE = window.API_BASE;
// 讓 Console 檢視更直觀：保留到 window（與既有行為相容）
if (!window.API_BASE) { window.API_BASE = API_BASE; }
function apiFetch(path, options){
  const url = (API_BASE && path.startsWith('/')) ? (API_BASE + path) : path;
  // SAFE MODE：回傳本地假資料以避免付費 API 呼叫
  if (window.SAFE_MODE) {
    // 生成卡片（POST /api/generate）
    if (path.startsWith('/api/generate')) {
      const demo = {
        data: {
          "完整信件": "【安全模式示例】孩子，我時常與你同在。你所遇見的一切，我都知道並看顧。當你疲憊時，來到我面前，我必使你得安息。願我的平安如河水一般流入你的心。",
          "三方向": "安慰；盼望；同行",
          "兩經文": "詩篇23:1；羅馬書8:28",
          "兩個行動呼籲": "為家人禱告；發一則感謝訊息"
        }
      };
      return Promise.resolve({ json: async ()=> demo });
    }
    // 信箱寫入（POST /api/mailbox）
    if (path.startsWith('/api/mailbox') && options && options.method === 'POST') {
      return Promise.resolve({ json: async ()=> ({ ok: true }) });
    }
    // 信箱讀取（GET /api/mailbox）
    if (path.startsWith('/api/mailbox')) {
      const now = Date.now();
      const list = [
        { id: 'demo-1', topic: '家庭 / 關係', text: '【安全模式】主與我們同在，彼此相愛、彼此擔待。', directions: '和好；溝通；代求', verses: '約13:34；西3:13', actions: '擁抱家人；寫下感謝', createdAt: now-3600_000 },
        { id: 'demo-2', topic: '平安 / 安息', text: '【安全模式】凡勞苦擔重擔的人到主這裡來，主使你得安息。', directions: '安靜；交託；休息', verses: '太11:28；腓4:6-7', actions: '深呼吸禱告；早睡一點', createdAt: now-7200_000 }
      ];
      return Promise.resolve({ json: async ()=> ({ ok:true, list }) });
    }
    return Promise.resolve({ json: async ()=> ({ ok:true }) });
  }
  return fetch(url, options);
}

// 初始化主題
function initTopics(){
  topicSelect.innerHTML = topics.map(t => `<option>${t}</option>`).join("");
}

// 時段文案（依 PRD）
function timeMessage(){
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  if(h<4 || (h===4 && m<30)) return "你是我夜間的歌 患難中隨時的幫助。";
  if(h<9) return "每早晨這都是新的 你信實極其廣大";
  if(h<12) return "耶和華與他同在，他就百事順利。";
  if(h<18) return "應當仰望神，因他笑臉幫助我，我還要稱讚他。";
  return "給家人一個笑臉吧~";
}

function showLoading(show){
  loadingEl.classList.toggle("hidden", !show);
  if(show){
    // 若外部CDN不可用，跳過動畫避免錯誤
    if (window.lottie) {
      if(!lottieAnim){
        lottieAnim = lottie.loadAnimation({
          container: lottieContainer,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: 'lotties/finger_touch.json'
        });
      } else {
        lottieAnim.play();
      }
    }
  } else {
    if(lottieAnim){ lottieAnim.stop(); }
  }
}

// 文字清理：修正後端或資料中的 /n、\n 與過多換行
function sanitizeText(text){
  return (text||"")
    .replace(/\\n/g, "\n")   // 字串中的反斜線 n
    .replace(/\/n/g, "\n")     // 斜線 n
    .replace(/\n{3,}/g, "\n\n") // 過多換行壓縮為雙換行
    .trim();
}

// 文字分段與行動解析（支援多維度顯示）
function splitIntoParas(text){
  if(!text) return [];
  text = sanitizeText(text);
  // 以雙換行優先分段，其次單換行；移除空白
  const parts = text.split(/\n{2,}|\r?\n/).map(s=>s.trim()).filter(Boolean);
  return parts.length ? parts : [text];
}
function extractActions(text){
  if(!text) return [];
  text = sanitizeText(text);
  // 先以換行分割，若只有一行再嘗試以常見分隔符或序號分割
  let items = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(items.length <= 1){
    items = text
      .split(/[、；;•・\u2022]|\s?\d+\.?\s?|[①②③④⑤]/)
      .map(s=>s.trim()).filter(Boolean);
  }
  // 僅取前兩個以符合「兩個行動呼籱」
  return items.slice(0,2);
}

// 顯示指定卡片到主視圖（供「回看」使用）
function displayCard(item){
  if(!item || !letterBodyEl) return;
  const text = sanitizeText(item.text || "");
  const directions = item.directions;
  const verses = item.verses;
  const actionsText = sanitizeText(item.actions);
  const actionsArr = extractActions(actionsText);

  // 清理現有內容
  letterBodyEl.textContent = "";
  const oldMeta = letterBodyEl.querySelector('.meta-inline');
  if (oldMeta) oldMeta.remove();

  // 段落化主文
  const paras = splitIntoParas(text);
  paras.forEach(p=>{
    const el = document.createElement('p');
    el.className = 'para';
    el.textContent = p;
    letterBodyEl.appendChild(el);
  });

  // 維度附加區塊
  if (directions || verses || actionsArr.length){
    const metaDiv = document.createElement('div');
    metaDiv.className = 'meta-inline';
    if(directions){ const d=document.createElement('div'); d.textContent=directions; metaDiv.appendChild(d); }
    if(verses){ const v=document.createElement('div'); v.textContent=verses; metaDiv.appendChild(v); }
    if(actionsArr.length){
      const ul = document.createElement('ul'); ul.className='actions-list';
      actionsArr.forEach(a=>{ const li=document.createElement('li'); li.textContent=a; ul.appendChild(li); });
      metaDiv.appendChild(ul);
    }
    letterBodyEl.appendChild(metaDiv);
  }

  lastGenerated = { topic: item.topic, text, directions, verses, actions: actionsText, createdAt: item.createdAt };
}

// 生成信件
async function generate(topic){
  showLoading(true);
  if (letterBodyEl) {
    letterBodyEl.textContent = "";
    const oldMeta = letterBodyEl.querySelector('.meta-inline');
    if (oldMeta) oldMeta.remove();
  }
  try {
    const res = await apiFetch("/api/generate",{
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json"},
      body: JSON.stringify({ topic })
    });
    const ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
    if (!res.ok) {
      let text = '';
      try { text = await res.text(); } catch {}
      console.error('生成 API 失敗：', res.status, text || '(無文字)');
      throw new Error('生成 API 回應非 2xx，狀態碼 ' + res.status);
    }
    if (ct && ct.indexOf('application/json') === -1) {
      let text = '';
      try { text = await res.text(); } catch {}
      console.error('生成 API 內容型別非 JSON：', ct, text.slice(0,200));
      throw new Error('生成 API 回傳非 JSON 格式');
    }
    const json = await res.json();
    const data = json.data || {}; // 盡量使用後端解析的 JSON
    const text = sanitizeText(data["完整信件"] || data.letter || "(未取得內容)");
    // 以段落顯示完整信件
    if (letterBodyEl) {
      const paras = splitIntoParas(text);
      letterBodyEl.textContent = "";
      paras.forEach(p=>{
        const el = document.createElement('p');
        el.className = 'para';
        el.textContent = p;
        letterBodyEl.appendChild(el);
      });
    }

    const directions = sanitizeText(data["三方向"]||""); 
    const verses = sanitizeText(data["兩經文"]||""); 
    const actionsText = sanitizeText(data["兩個行動呼籲"] || data["兩個行動呼籱"]||""); 
    const actionsArr = extractActions(actionsText);

    // 與本文同欄顯示的附加維度：方向、經文、行動清單
    if (letterBodyEl && (directions || verses || actionsArr.length)) {
      const metaDiv = document.createElement('div');
      metaDiv.className = 'meta-inline';

      if(directions){
        const d = document.createElement('div');
        d.textContent = directions;
        metaDiv.appendChild(d);
      }
      if(verses){
        const v = document.createElement('div');
        v.textContent = verses;
        metaDiv.appendChild(v);
      }
      if(actionsArr.length){
        const ul = document.createElement('ul');
        ul.className = 'actions-list';
        actionsArr.forEach(a=>{
          const li = document.createElement('li');
          li.textContent = a;
          ul.appendChild(li);
        });
        metaDiv.appendChild(ul);
      }
      letterBodyEl.appendChild(metaDiv);
    }

    lastGenerated = { topic, text, directions, verses, actions: actionsText, createdAt: Date.now() };
    await saveToMailbox(lastGenerated);
  } catch (e) {
    if (letterContentEl) { letterContentEl.textContent = "抱歉，生成時發生錯誤，稍後再試。"; }
    console.error(e);
  } finally { showLoading(false); }
}

// 僅取得生成資料，不立即渲染（用於 Rewarded 門檻）
async function fetchGeneratedItem(topic){
  showLoading(true);
  try{
    const res = await apiFetch('/api/generate',{
      method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify({ topic })
    });
    const ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
    if (!res.ok) {
      let text = '';
      try { text = await res.text(); } catch {}
      console.error('生成 API 失敗：', res.status, text || '(無文字)');
      throw new Error('生成 API 回應非 2xx，狀態碼 ' + res.status);
    }
    if (ct && ct.indexOf('application/json') === -1) {
      let text = '';
      try { text = await res.text(); } catch {}
      console.error('生成 API 內容型別非 JSON：', ct, text.slice(0,200));
      throw new Error('生成 API 回傳非 JSON 格式');
    }
    const json = await res.json();
    const data = json.data || {};
    const text = sanitizeText(data["完整信件"] || data.letter || "(未取得內容)");
    const directions = sanitizeText(data["三方向"]||"");
    const verses = sanitizeText(data["兩經文"]||"");
    const actionsText = sanitizeText(data["兩個行動呼籲"] || data["兩個行動呼籱"]||"");
    const createdAt = Date.now();
    return { topic, text, directions, verses, actions: actionsText, createdAt };
  }finally{
    // 不在此處隱藏 loading，待整體門檻流程完成後再隱藏
  }
}

// 抽卡嘗試：每日各一次免廣告；其餘需 Rewarded；同步並行 AI 與廣告
async function attemptDraw(type, topic){
  const freeAvailable = isFreeToday(type);
  const needReward = !freeAvailable;
  const aiPromise = fetchGeneratedItem(topic);
  let rewardOk = true;
  if (needReward){
    setNotice('今日免廣告次數已用盡，需觀看廣告才能抽卡');
    rewardOk = await playRewardedAd();
  } else {
    setNotice('');
  }
  const item = await aiPromise;
  showLoading(false);
  if (rewardOk){
    displayCard(item);
    setNotice('');
    if (freeAvailable) { consumeFree(type); }
    incDrawCount(type);
  } else {
    setNotice('完成觀看即可抽卡');
  }
}

// 信箱本地儲存
async function saveToMailbox(item){
  try {
    await apiFetch('/api/mailbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
  } catch (e) {
    const box = JSON.parse(localStorage.getItem("homeletter_mailbox")||"[]");
    box.unshift(item);
    localStorage.setItem("homeletter_mailbox", JSON.stringify(box.slice(0,200)));
  }
}
function previewText(txt, n){
  const t = (txt||"").replace(/\s+/g,' ').trim();
  return t.length > n ? (t.slice(0,n) + '…') : t;
}
function renderMailboxList(box){
  const total = box.length;
  const totalPages = Math.max(1, Math.ceil(total/MAILBOX_PAGE_SIZE));
  mailboxPage = Math.min(Math.max(1, mailboxPage), totalPages);
  const start = (mailboxPage - 1) * MAILBOX_PAGE_SIZE;
  const slice = box.slice(start, start + MAILBOX_PAGE_SIZE);
  mailboxList.innerHTML = slice.map(x => {
    const date = new Date(x.createdAt).toLocaleString();
    const idAttr = x.id ? ` data-id="${x.id}"` : '';
    const preview = previewText(x.text || '', 90);
    return `<li${idAttr}>
      <div><strong>${x.topic||''}</strong>｜<small>${date}</small></div>
      ${preview?`<div class="preview">${preview}</div>`:''}
      <div class="letter-actions"><button class="secondary view-card">查看</button><button class="secondary delete-card">刪除</button></div>
    </li>`;
  }).join("");

  if (pageIndicator) {
    pageIndicator.textContent = total ? `第 ${mailboxPage} / ${totalPages} 頁` : '第 0 / 0 頁';
  }
  if (prevPageBtn) { prevPageBtn.disabled = (mailboxPage <= 1) || !total; }
  if (nextPageBtn) { nextPageBtn.disabled = (mailboxPage >= totalPages) || !total; }
  if (mailboxFooter) { mailboxFooter.classList.toggle('hidden', !total); }
  if (!total) { mailboxList.innerHTML = '<li>尚無卡片，先抽一封吧。</li>'; }
}
async function renderMailbox(){
  try {
    const res = await apiFetch('/api/mailbox');
    const json = await res.json();
    const box = (json && json.ok && Array.isArray(json.list)) ? json.list : [];
    mailboxCache = box;
    renderMailboxList(box);
  } catch (e) {
    const box = JSON.parse(localStorage.getItem("homeletter_mailbox")||"[]");
    // 以建立時間倒序
    box.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
    mailboxCache = box;
    renderMailboxList(box);
  }
}

// 刪除指定卡片（伺服器優先，失敗則本地）
async function deleteCard(id, fallbackItem){
  try {
    if (id) {
      await apiFetch(`/api/mailbox/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } else if (fallbackItem) {
      const box = JSON.parse(localStorage.getItem("homeletter_mailbox")||"[]");
      const next = box.filter(x=> !(x.text===fallbackItem.text && x.createdAt===fallbackItem.createdAt));
      localStorage.setItem("homeletter_mailbox", JSON.stringify(next));
    }
  } catch (err) {
    // 伺服器刪除失敗，嘗試本地刪除
    if (fallbackItem) {
      const box = JSON.parse(localStorage.getItem("homeletter_mailbox")||"[]");
      const next = box.filter(x=> !(x.text===fallbackItem.text && x.createdAt===fallbackItem.createdAt));
      localStorage.setItem("homeletter_mailbox", JSON.stringify(next));
    }
  }
  // 重新載入清單
  renderMailbox();
}

// 事件綁定
btnRandom.addEventListener("click", () => {
  const t = topics[Math.floor(Math.random()*topics.length)];
  topicSelect.value = t;
  attemptDraw('random', t);
});
btnGenerate.addEventListener("click", () => {
  const t = (topicSelect && topicSelect.value) ? topicSelect.value : topics[0];
  // 即時反饋：按鈕暫時停用並改文字
  const originalText = btnGenerate.textContent;
  btnGenerate.disabled = true;
  btnGenerate.textContent = "抽中…";
  Promise.resolve()
    .then(()=>attemptDraw('topic', t))
    .finally(()=>{
      btnGenerate.disabled = false;
      btnGenerate.textContent = originalText;
    });
});
if (fabMailboxBtn) {
  const openMailboxHandler = (e) => { if(e) e.stopPropagation(); mailboxPage = 1; if (mailboxList) { mailboxList.innerHTML = '<li>載入中…</li>'; } showPopover(true); renderMailbox(); };
  ["click","pointerup","touchend"].forEach(evt=> fabMailboxBtn.addEventListener(evt, openMailboxHandler));
}
if (closePopoverBtn) {
  closePopoverBtn.addEventListener("click", () => showPopover(false));
}
// 回到首頁按鈕：頂部與信箱視窗
if (btnGoHomeTop) { btnGoHomeTop.addEventListener('click', goHome); }
if (goHomeFromMailbox) { goHomeFromMailbox.addEventListener('click', goHome); }
if (btnOpenMailbox) {
  const openMailboxHandler = (e) => { if(e) e.stopPropagation(); mailboxPage = 1; if (mailboxList) { mailboxList.innerHTML = '<li>載入中…</li>'; } showPopover(true); renderMailbox(); };
  ["click","pointerup","touchend"].forEach(evt=> btnOpenMailbox.addEventListener(evt, openMailboxHandler));
}
document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") showPopover(false); });
document.addEventListener("click", (e)=>{
  if(!mailboxPopover.classList.contains("hidden")){
    const panel = mailboxPopover.querySelector('.popover-panel');
    const within = (panel && panel.contains(e.target)) || (fabMailboxBtn && fabMailboxBtn.contains(e.target)) || (btnOpenMailbox && btnOpenMailbox.contains(e.target));
    if(!within) showPopover(false);
  }
});

// 信箱清單事件代理：查看、刪除
if (mailboxList) {
  mailboxList.addEventListener('click', (e)=>{
    const viewBtn = e.target.closest('.view-card');
    const delBtn = e.target.closest('.delete-card');
    if (!viewBtn && !delBtn) return;
    const li = e.target.closest('li');
    if (!li) return;
    const id = li.getAttribute('data-id');
    let item = null;
    if (id) { item = mailboxCache.find(x=> x.id === id) || null; }
    else {
      // 無 id 的本地項，使用索引對應
      const idx = Array.prototype.indexOf.call(mailboxList.children, li);
      item = mailboxCache[idx] || null;
    }
    if (viewBtn) {
      if (item) { displayCard(item); showPopover(false); }
      return;
    }
    if (delBtn) {
      deleteCard(item?.id, item || null);
    }
  });
}
// 分頁控制事件
if (prevPageBtn) {
  ["click","pointerup","touchend"].forEach(evt=> prevPageBtn.addEventListener(evt, (e)=>{ if(e) e.stopPropagation(); if (mailboxPage > 1) { mailboxPage--; renderMailboxList(mailboxCache); } }));
}
if (nextPageBtn) {
  ["click","pointerup","touchend"].forEach(evt=> nextPageBtn.addEventListener(evt, (e)=>{ if(e) e.stopPropagation(); const totalPages = Math.max(1, Math.ceil((mailboxCache.length||0)/MAILBOX_PAGE_SIZE)); if (mailboxPage < totalPages) { mailboxPage++; renderMailboxList(mailboxCache); } }));
}

function showPopover(show){
  mailboxPopover.classList.toggle("hidden", !show);
  if (show) { mailboxPopover.classList.add('fullscreen'); }
  else { mailboxPopover.classList.remove('fullscreen'); }
  mailboxPopover.setAttribute('aria-modal', show ? 'true' : 'false');
  document.body.style.overflow = show ? 'hidden' : '';
}

// 回到首頁：關閉信箱並讓抽卡按鈕進入視野
function goHome(){
  // 關閉信箱彈窗
  showPopover(false);
  // 捲動到抽卡按鈕並聚焦，便於直接操作
  if (btnGenerate) {
    try { btnGenerate.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch{}
    try { btnGenerate.focus(); } catch{}
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// 朗讀功能（Web Speech API）
function getSpeakText(){
  // 優先朗讀目前生成的卡片完整內容
  const content = composeShareText(lastGenerated);
  if(content && content.trim()) return content;
  // 其次讀取畫面上的文字
  const fallback = (letterBodyEl?.innerText || letterContentEl?.innerText || '').trim();
  return fallback || '目前尚未有內容可朗讀';
}
function startSpeak(){
  const synth = window.speechSynthesis;
  if(!synth){ alert('此瀏覽器不支援語音朗讀'); return; }
  if(synth.paused){ synth.resume(); updateSpeakButton(); return; }
  const text = getSpeakText();
  try { synth.cancel(); } catch{}
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-TW';
  utter.rate = 1.0;
  utter.pitch = 1.0;
  utter.onend = ()=>{ updateSpeakButton(); };
  utter.onerror = ()=>{ updateSpeakButton(); };
  synth.speak(utter);
  updateSpeakButton();
}
function toggleSpeak(){
  const synth = window.speechSynthesis;
  if(!synth){ alert('此瀏覽器不支援語音朗讀'); return; }
  // Android 修正：若目前是暫停狀態，優先恢復而非重啟
  if (synth.paused) {
    try { synth.resume(); } catch{}
    // 若恢復失敗，短暫延遲後重啟朗讀
    setTimeout(()=>{
      if (synth.paused || !synth.speaking) { startSpeak(); }
    }, 600);
    updateSpeakButton();
    return;
  }
  // 正在說話且未暫停 → 暫停
  if (synth.speaking && !synth.paused){ try { synth.pause(); } catch{} updateSpeakButton(); return; }
  // 其餘情況 → 開始朗讀
  startSpeak();
}
function updateSpeakButton(){
  const synth = window.speechSynthesis;
  if(!btnSpeakToggle) return;
  const isPaused = !!(synth && synth.paused);
  const isSpeaking = !!(synth && synth.speaking);
  btnSpeakToggle.textContent = (isSpeaking && !isPaused) ? '暫停' : '播放';
}

// 綁定朗讀切換按鈕事件
if(btnSpeakToggle){ btnSpeakToggle.addEventListener('click', toggleSpeak); updateSpeakButton(); }

// 保存/分享功能
function composeShareText(item){
  if(!item) return "(尚未生成內容)";
  const parts = [
    sanitizeText(item.text),
    [sanitizeText(item.directions), sanitizeText(item.verses), sanitizeText(item.actions)].filter(Boolean).join("\n")
  ].filter(Boolean);
  return parts.join("\n\n");
}
function downloadCurrent(){
  const content = composeShareText(lastGenerated);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  const now = new Date();
  const fileName = `天父的信_${(lastGenerated?.topic||'主題')}_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.txt`;
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}
async function shareCurrent(){
  const content = composeShareText(lastGenerated);
  const title = `天父的信 - ${(lastGenerated?.topic||'主題')}`;
  if (navigator.share) {
    try { await navigator.share({ title, text: content }); } catch{}
  } else {
    try { await navigator.clipboard.writeText(content); alert('內容已複製到剪貼簿'); } catch { alert('複製失敗，請手動複製'); }
  }
}
if (btnSave) btnSave.addEventListener('click', downloadCurrent);
if (btnShare) btnShare.addEventListener('click', shareCurrent);
async function shareLine(){
  const content = composeShareText(lastGenerated);
  const url = 'https://line.me/R/msg/text/?' + encodeURIComponent(content);
  try { window.open(url, '_blank'); }
  catch { try { await navigator.clipboard.writeText(content); alert('已複製，可貼到 LINE'); } catch { alert('分享失敗，請手動複製'); } }
}
function shareFacebook(){
  const shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(location.href);
  try { window.open(shareUrl, '_blank'); }
  catch { alert('無法開啟 Facebook 分享，請手動複製網址'); }
}
if (btnShareLine) btnShareLine.addEventListener('click', shareLine);
if (btnShareFacebook) btnShareFacebook.addEventListener('click', shareFacebook);

// 啟動
initTopics();
if (timeMessageEl) { timeMessageEl.textContent = timeMessage(); }
if (timeMarqueeEl) { timeMarqueeEl.textContent = timeMessage(); }
// 右側時間面板：每秒更新一次目前時間
if (clockEl) {
  const updateClock = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleString();
    // 同步更新底部時間文案（跨時段時即時切換）
    if (timeMessageEl) {
      const msg = timeMessage();
      if (timeMessageEl.textContent !== msg) timeMessageEl.textContent = msg;
    }
    // 同步更新頂部跑馬燈內容
    if (timeMarqueeEl) {
      const msg = timeMessage();
      if (timeMarqueeEl.textContent !== msg) timeMarqueeEl.textContent = msg;
    }
  };
  updateClock();
 setInterval(updateClock, 1000);
}

// 背景場景初始化（PRD 5.2）
function initBackground(){
  const scene = document.getElementById('bgScene');
  if(!scene) return;
  const sky = scene.querySelector('.layer.sky');
  const mid = scene.querySelector('.layer.mid');
  const fg = scene.querySelector('.layer.fg');
  const birdsBox = scene.querySelector('.birds');

  // 生成 12 隻鴿子（🕊️）並設定不同速度與延遲
  if (birdsBox){
    const count = 12;
    for(let i=0;i<count;i++){
      const b = document.createElement('span');
      b.className = 'bird';
      b.textContent = '🕊️';
      const top = 35 + Math.random()*25; // 35% - 60%
      b.style.setProperty('--top', top+'%');
      b.style.setProperty('--fly-dur', (18 + Math.random()*12)+'s');
      b.style.setProperty('--fly-delay', (Math.random()*10)+'s');
      birdsBox.appendChild(b);
    }
  }

  // 視差效果：近景移動多、遠景移動少
  const onScroll = () => {
    const y = window.scrollY || 0;
    if (sky) sky.style.transform = `translateY(${y*-0.015}px)`;
    if (mid) mid.style.transform = `translateY(${y*-0.03}px)`;
    if (fg) fg.style.transform = `translateY(${y*-0.06}px)`;
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// 啟動背景場景
initBackground();
initBottomBanner();