// 配置前端 API 基底位址（Vercel 前端連線 Render 後端）。
// 部署到 Vercel 時，將此設定為你的 Render 服務網址。
// 例如：https://homeletter2-0-backend.onrender.com
window.API_BASE = 'https://homeletter2-0-backend.onrender.com';

// Google Ad Manager Rewarded 單元路徑（Web 版 GPT Rewarded）。
// 範例格式：'/NETWORK_CODE/AD_UNIT_NAME'。請替換為正式路徑。
// 例如：window.GPT_REWARDED_AD_UNIT = '/21800000000/homeletter_rewarded';
window.GPT_REWARDED_AD_UNIT = window.GPT_REWARDED_AD_UNIT || '/21800000000/homeletter_rewarded';

// AdSense 參數（底部靜態橫幅 Option B）
// 請替換為正式的 Client 與 Slot（由 AdSense 後台提供）。
window.ADSENSE_CLIENT = window.ADSENSE_CLIENT || 'ca-pub-9507923681356448';
window.ADSENSE_SLOT = window.ADSENSE_SLOT || '8178860305';

// SAFE MODE：正式部署改為關閉，避免使用相對路徑造成誤呼叫前端域名下的 /api。
// 若需本地預覽安全模式，請改用 config.safe.js 與批次檔切換。
window.SAFE_MODE = false;