# Personal Website Monorepo

前後端分離的個人網站骨架，包含：

- 公開前台：個人資料 / 履歷、Markdown 部落格、留言板
- 後端管理：登入後可編輯個人資料、文章與留言審核
- 後端：`FastAPI + PostgreSQL/SQLite + JWT`
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

第一次啟動會自動建立資料表並塞入示範資料。

本地如果沒有設定 `DATABASE_URL`，預設仍會使用 `site.db`。
正式部署時請把 `DATABASE_URL` 指到你的 PostgreSQL。

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
- 部落格正文儲存在資料庫
  - 履歷與研究區塊混合使用 Markdown 與結構化資料
  - experience 區塊使用卡片式資料，可連到心得文章
  - publications 使用結構化資料，可連到 blog 或外部連結

## Markdown Post Format

如果你是從舊版升級，第一次啟動時若資料庫內還沒有文章，系統會自動把 `content/posts/*.md` 匯入 PostgreSQL。

文章資料格式如下：

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

後台新增/編輯文章時，API 會直接更新資料庫中的 `blog_posts`。

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
