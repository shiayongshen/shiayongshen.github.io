# 夏永紳 (Vincent Hsia) - 個人網站

歡迎來到我的個人網站！這是一個展示我的專業背景、技術技能、學術研究和職業經歷的現代化個人首頁。

## 📋 目錄

- [功能特性](#功能特性)
- [技術棧](#技術棧)
- [網站結構](#網站結構)
- [快速開始](#快速開始)
- [頁面說明](#頁面說明)
- [優化建議](#優化建議)

## ✨ 功能特性

- **響應式設計** - 完全適配桌面、平板和手機屏幕
- **現代化 UI** - 玻璃態效果 (Glassmorphism) 和漸變動畫
- **深淺主題** - 支持明亮和深色主題切換
- **粒子效果** - AI 風格的背景粒子動畫
- **多語言支持** - 中文和英文版本
- **SEO 優化** - 完整的 SEO 元數據和 Sitemap

## 🛠️ 技術棧

### 前端技術
- **HTML5** - 語義化結構
- **CSS3** - 現代樣式 (Grid, Flexbox, Animation)
- **JavaScript (ES6+)** - 交互功能

### 設計工具
- Glassmorphism 玻璃態效果
- CSS Grid 和 Flexbox 佈局
- CSS 動畫和過渡效果
- SVG 圖標支持

### 開發特性
- 共享 CSS 文件 (`css/common.css`)
- 共享 JavaScript 文件 (`js/common.js`)
- 模組化代碼結構
- 版本控制 (Git)

## 📁 網站結構

```
shiayongshen.github.io/
├── index.html                  # 首頁（中文）
├── index-en.html              # 首頁（英文）
├── research.html              # 研究詳情（中文）
├── research-en.html           # 研究詳情（英文）
├── conference-acm.html        # ACM 會議（中文）
├── conference-acm-en.html     # ACM 會議（英文）
├── conference-kdd2025.html    # KDD 2025（中文）
├── conference-kdd2025-en.html # KDD 2025（英文）
├── conference-tosem.html      # TOSEM（中文）
├── conference-tosem-en.html   # TOSEM（英文）
├── css/
│   └── common.css             # 共享樣式表
├── js/
│   └── common.js              # 共享 JavaScript
├── pic/                       # 圖片資料夾
│   ├── personal/              # 個人照片
│   ├── school/                # 學校 logo
│   ├── company/               # 公司 logo
│   └── conf/                  # 會議照片
├── conf_material/             # 會議材料
├── robots.txt                 # SEO 爬蟲配置
├── sitemap.xml                # 網站地圖
└── README.md                  # 本文件
```

## 🚀 快速開始

### 本地開發

由於使用了 HTML 文件和靜態資源，建議使用本地伺服器進行開發：

```bash
# 使用 Python 3
python -m http.server 8000

# 或使用 Python 2
python -m SimpleHTTPServer 8000

# 或使用 Node.js http-server
npx http-server
```

然後在瀏覽器中訪問 `http://localhost:8000`

### 部署到 GitHub Pages

該網站已配置為 GitHub Pages，只需：

```bash
# 提交並推送到 main 分支
git add .
git commit -m "更新網站內容"
git push origin main
```

## 📄 頁面說明

### 首頁 (index.html / index-en.html)

主頁面包含：
- **英雄區** - 個人介紹和核心優勢
- **關於我** - 個人背景和專業簡介
- **技術技能** - 編程語言、框架和工具
- **教育背景** - 時間線式的教育經歷
- **實習經歷** - 企業實習和項目經驗
- **研究經歷** - 學術研究項目
- **會議發表** - 學術會議論文展示
- **聯絡資訊** - 聯繫方式和社群連結

### 研究頁面 (research.html / research-en.html)

詳細展示三篇學術論文：
1. KDD 2025 - 財務監管合規框架
2. ACM Conference - 神經符號合規方法（獲得卓越論文獎）
3. TOSEM 期刊 - 代理 AI 合規管道

### 會議頁面 (conference-*.html)

各個會議和發表的詳細頁面，包含：
- 論文摘要
- 技術堆棧
- 會議照片
- 相關資源連結

## 🎨 設計特色

### 主題系統

- **Light Theme** - 明亮藍色和白色調
- **Dark Theme** - 深色背景和青藍色調

### 色彩方案

```css
--primary-cyan: #00d4ff
--primary-blue: #0099ff
--primary-pink: #ff006e
```

### 響應式設計

- **Desktop** - 完整布局，所有元素可見
- **Tablet** - 調整導航和網格布局
- **Mobile** - 單列布局，優化觸摸交互

## 🔧 優化建議

### 代碼優化

- ✅ **CSS 重構** - 提取共享樣式到 `css/common.css`
- ✅ **JavaScript 模組化** - 通用函數集中到 `js/common.js`
- ✅ **HTML 簡化** - 移除重複代碼
- ✅ **拼寫檢查** - 修復 `conference-acm.html` 中的 CSS 錯誤

### SEO 優化

- ✅ **robots.txt** - 搜尋引擎爬蟲配置
- ✅ **sitemap.xml** - 網站地圖提交
- ⏳ **Meta 標籤** - 建議添加更多 Open Graph 和 Twitter Card 標籤
- ⏳ **結構化數據** - 建議添加 Schema.org JSON-LD

### 性能優化

- 📊 **圖片優化** - 建議使用 WebP 格式和懶加載
- 📦 **代碼分割** - 考慮為大頁面創建單獨的 CSS 檔案
- 🔄 **緩存策略** - 設置適當的 HTTP 緩存頭

### 功能增強

- 🌙 **主題切換按鈕** - 添加頁面上的主題切換 UI
- 🔍 **搜尋功能** - 添加網站內搜尋
- 📧 **聯繫表單** - 完整的聯繫表單（使用 Formspree 或類似服務）
- 📱 **Progressive Web App** - 添加 PWA 支持

## 📝 更新日誌

### v2.0.0 (2025-12-07)

**重大改進：**
- 創建共享 CSS 檔案，減少代碼重複
- 創建共享 JavaScript 檔案，實現模組化
- 修復 `conference-acm.html` 中的 CSS 拼寫錯誤
- 添加 SEO 檔案（robots.txt, sitemap.xml）
- 創建專業 README 文檔
- 新增 .gitignore 配置

### v1.0.0

- 初始版本發佈

## 💡 開發提示

### 添加新頁面

1. 在 HTML 文件中添加：
   ```html
   <link rel="stylesheet" href="css/common.css">
   ```

2. 在 body 標籤中添加主題類：
   ```html
   <body class="light-theme">
   ```

3. 引用共享 JavaScript：
   ```html
   <script src="js/common.js"></script>
   ```

### 自定義主題

修改 `css/common.css` 中的 CSS 變數：

```css
:root {
    --primary-cyan: #00d4ff;
    --primary-blue: #0099ff;
    --primary-pink: #ff006e;
    /* ... 其他變數 */
}
```

### 添加新的粒子效果

修改 `js/common.js` 中的 `createParticles()` 函數。

## 📞 聯繫方式

- **Email**: 113356046@g.nccu.edu.tw
- **Phone**: +886-988-512-200
- **Location**: 台灣
- **LinkedIn**: [連接到 LinkedIn](https://www.linkedin.com/in/yungshenhsia/)
- **GitHub**: [連接到 GitHub](https://github.com)

## 📄 許可證

本網站代碼和設計版權所有 © 2025 Yung Shen (Vincent) HSIA。保留所有權利。

## 🤝 貢獻

歡迎提交問題和改進建議！請透過 GitHub Issues 或直接聯繫我。

---

最後更新：2025-12-07

由 Vincent Hsia 用 ❤️ 和代碼創建
