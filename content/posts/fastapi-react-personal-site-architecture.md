---
title: FastAPI + React Personal Site Architecture
slug: fastapi-react-personal-site-architecture
summary: 記錄這個個人網站的基本架構與取捨。
category: engineering
cover_image_url: https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80
tags: fastapi, react, architecture
published: true
created_at: 2026-04-05T09:00:00Z
updated_at: 2026-04-05T09:00:00Z
---

# Architecture Notes

- Frontend: React SPA
- Backend: FastAPI
- Content: Markdown files under `content/posts`

## Why this split?

因為個人網站的寫作內容適合用檔案管理，而留言板與履歷資料仍然適合走 API。
