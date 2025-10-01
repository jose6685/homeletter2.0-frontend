const topics = [
  "工作 / 職場", "家庭 / 關係", "壓力 / 焦慮", "病痛 / 醫治",
  "供應 / 需要", "饒恕 / 和好", "方向 / 抉擇", "信心 / 盼望",
  "平安 / 安息", "感恩 / 敬拜"
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

let lottieAnim = null;
let lastGenerated = null;
let mailboxCache = [];
let mailboxPage = 1;
const MAILBOX_PAGE_SIZE = 6;

// 部署支援：在 Vercel 前端 / Render 後端環境下設定 API 基底
const API_BASE = (window.API_BASE || ((location.port === '8000') ? 'http://localhost:3000' : ''));
function apiFetch(path, options){
  const url = (API_BASE && path.startsWith('/')) ? (API_BASE + path) : path;
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
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ topic })
    });
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
  topicSelect.value = t; generate(t);
});
btnGenerate.addEventListener("click", () => {
  const t = (topicSelect && topicSelect.value) ? topicSelect.value : topics[0];
  // 即時反饋：按鈕暫時停用並改文字
  const originalText = btnGenerate.textContent;
  btnGenerate.disabled = true;
  btnGenerate.textContent = "抽中…";
  Promise.resolve()
    .then(()=>generate(t))
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
  if(synth.speaking && !synth.paused){ try { synth.pause(); } catch{} updateSpeakButton(); return; }
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