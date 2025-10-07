// 配置前端 API 基底位址（Vercel 前端連線 Render 後端）。
// 部署到 Vercel 時，將此設定為你的 Render 服務網址。
// 例如：https://homeletter2-0-backend.onrender.com
// 正式／手機安裝：連線到雲端後端（避免 localhost 無法連線與混合內容問題）
// 若你使用其他後端域名，請改為該 HTTPS 位址
window.API_BASE = 'https://homeletter2-0-backend.onrender.com';

// 正式模式：關閉安全模式（不使用安全替代資料）
window.SAFE_MODE = false;