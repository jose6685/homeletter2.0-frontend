// 配置前端 API 基底位址（Vercel 前端連線 Render 後端）。
// 部署到 Vercel 時，將此設定為你的 Render 服務網址。
// 例如：https://homeletter2-0-backend.onrender.com
window.API_BASE = 'https://homeletter2-0-backend.onrender.com';

// Google Ad Manager Rewarded 單元路徑（Web 版 GPT Rewarded）。
// 範例格式：'/NETWORK_CODE/AD_UNIT_NAME'。請替換為正式路徑。
// 內測階段：使用 Google 測試聯盟的示例路徑（NETWORK_CODE=6355419）。
// 注意：Web 版 Rewarded 需要在 Ad Manager 後台建立「Rewarded」頁外單元；示例路徑僅用於測試不保證有填充。
// 參考：https://developers.google.com/publisher-tag/guides/get-started
window.GPT_REWARDED_AD_UNIT = window.GPT_REWARDED_AD_UNIT || '/6355419/Travel';

// AdSense 參數（底部靜態橫幅 Option B）
// 請替換為正式的 Client 與 Slot（由 AdSense 後台提供）。
window.ADSENSE_CLIENT = window.ADSENSE_CLIENT || 'ca-pub-9507923681356448';
window.ADSENSE_SLOT = window.ADSENSE_SLOT || '8178860305';

// AdSense 測試模式：在預覽/內測階段以測試廣告替代（不計入收益）。
// 將於 main.js 中自動為 <ins class="adsbygoogle"> 加上 data-adtest="on"。
window.ADSENSE_TEST_MODE = true;

// 不發行 Web 版：前端停用廣告與付費 API，以 Android 原生為主。
// 若需重啟 Web 廣告，請改用 config.live.js 或 enable_ads.bat。
window.SAFE_MODE = true;