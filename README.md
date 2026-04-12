# Personal Website Monorepo

前後端分離的個人網站骨架，包含：

- 公開前台：個人資料 / 履歷、Markdown 部落格、留言板
- 後端管理：登入後可編輯個人資料、文章與留言審核
- 後端：`FastAPI + SQLite + JWT`
- 前端：`Vite + React + TypeScript`
- 部落格文章來源：`content/posts/*.md`
- 上傳圖片會存到：`content/uploads/`

## Structure

```text
backend/
  app/
content/
  posts/
frontend/
  src/
pyproject.toml
```

## Backend Setup

1. 建立虛擬環境並安裝依賴：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

2. 建立環境變數：

```bash
cp backend/.env.example .env
```

3. 啟動 API：

```bash
uvicorn backend.app.main:app --reload
```

預設管理帳號：

- Username: `admin`
- Password: `changeme123`

第一次啟動會自動建立 `site.db` 並塞入示範資料。

如果你先前已經啟動過舊版本、產生了舊 schema 的 `site.db`，現在改版後建議先刪掉它再重跑一次。

## Frontend Setup

1. 安裝前端依賴：

```bash
cd frontend
npm install
```

2. 設定 API base URL：

```bash
cp .env.example .env
```

3. 啟動前端：

```bash
npm run dev
```

預設前端位址是 `http://localhost:5173`。

## Current Features

- 公開頁：
  - About / Resume / Academic profile
  - Blog list + article detail
  - Guestbook submit + approved list
- 後台：
  - JWT login
  - Profile update
  - Blog CRUD
  - Guestbook approve / edit / delete
- 內容格式：
  - 部落格正文使用實體 Markdown 檔案
  - 履歷與研究區塊混合使用 Markdown 與結構化資料
  - experience 區塊使用卡片式資料，可連到心得文章
  - publications 使用結構化資料，可連到 blog 或外部連結

## Markdown Post Format

文章放在 `content/posts/*.md`，格式如下：

```md
---
title: My Post
slug: my-post
summary: Short summary
category: engineering
cover_image_url: https://...
tags: fastapi, react, notes
published: true
created_at: 2026-04-12T08:00:00Z
updated_at: 2026-04-12T08:00:00Z
---

# Markdown Content
```

欄位說明：

- `cover_image_url`: 文章封面圖
- `category`: 分類
- `tags`: 逗號分隔 tag
- `published`: 是否公開

後台新增/編輯文章時，API 會直接更新對應的 Markdown 檔案。

## Image Uploads

- 封面圖、experience logo、project image 現在可直接在後台選檔上傳
- 後端會把檔案存到 `content/uploads/`
- 對外存取路徑是 `/uploads/...`

## Experience Cards

個人資料中的 experience 改成卡片式資料，每張卡可設定：

- `company`
- `role`
- `period`
- `summary`
- `story_slug`

如果 `story_slug` 有值，前台卡片就會連到 `/blog/{story_slug}`，可用來放該工作/專案的心得分享。

## Next Steps

如果要把它做成正式上線版本，建議下一步補：

- 檔案上傳或圖床管理
- 更完整的角色權限
- Markdown 檔案改為檔案系統或 headless CMS
- 留言防 spam / rate limit / captcha
- CI/CD 與正式部署設定
