import json

from sqlalchemy.orm import Session

from .auth import hash_password
from .config import settings
from .content import POSTS_DIR, ensure_posts_dir
from .models import AdminUser, GuestbookEntry, Profile


def seed_database(db: Session) -> None:
    if not db.query(AdminUser).filter(AdminUser.username == settings.admin_username).first():
        db.add(
            AdminUser(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
            )
        )

    if not db.query(Profile).first():
        db.add(
            Profile(
                full_name="Shia Yong Shen",
                headline="Software Engineer / Builder",
                intro_markdown=(
                    "我喜歡把想法快速做成可運行的產品，關注的主題包含產品設計、"
                    "工程效率、AI 應用與內容創作。這個網站會放我的筆記、履歷與近況。"
                ),
                location="Taipei, Taiwan",
                email="hello@example.com",
                avatar_url="",
                links_json=json.dumps(
                    [
                        {"label": "GitHub", "url": "https://github.com/yourname"},
                        {"label": "LinkedIn", "url": "https://linkedin.com/in/yourname"},
                    ],
                    ensure_ascii=False,
                ),
                experiences_json=json.dumps(
                    [
                        {
                            "company": "Example Studio",
                            "role": "Senior Engineer",
                            "period": "2023 - Now",
                            "summary": "帶領產品從想法到上線，重點放在 AI 功能設計與開發效率。",
                            "company_logo_url": "https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=200&q=80",
                            "project_image_url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
                            "story_slug": "fastapi-react-personal-site-architecture",
                        },
                        {
                            "company": "Another Team",
                            "role": "Full-stack Developer",
                            "period": "2020 - 2023",
                            "summary": "負責前後端協作、內容系統與內部工具。",
                            "company_logo_url": "https://images.unsplash.com/photo-1572021335469-31706a17aaef?auto=format&fit=crop&w=200&q=80",
                            "project_image_url": "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
                            "story_slug": "welcome-to-my-digital-garden",
                        },
                    ],
                    ensure_ascii=False,
                ),
                research_interests_markdown=(
                    "- Multimodal AI systems\n"
                    "- Human-AI interaction\n"
                    "- Retrieval-augmented generation\n"
                    "- Developer tools and applied ML systems"
                ),
                publications_json=json.dumps(
                    [
                        {
                            "title": "Human-Centered Tooling for LLM Workflows",
                            "authors": "Shia Yong Shen, Advisor Name",
                            "venue": "Manuscript in preparation",
                            "year": 2026,
                            "external_url": "",
                            "blog_slug": "fastapi-react-personal-site-architecture",
                        },
                        {
                            "title": "Interactive AI Systems Reading Notes",
                            "authors": "Shia Yong Shen",
                            "venue": "Research blog series",
                            "year": 2026,
                            "external_url": "",
                            "blog_slug": "welcome-to-my-digital-garden",
                        },
                    ],
                    ensure_ascii=False,
                ),
                projects_json=json.dumps(
                    [
                        {
                            "title": "LLM Workflow Interface",
                            "summary": "研究如何把語言模型能力整合到真實使用者工作流程中，重點在互動設計與可驗證性。",
                            "period": "2025 - 2026",
                            "external_url": "",
                            "blog_slug": "fastapi-react-personal-site-architecture",
                        },
                        {
                            "title": "RAG Experiment Platform",
                            "summary": "建立 retrieval pipeline、評估指標與 demo 介面，支援研究原型快速測試。",
                            "period": "2024 - 2025",
                            "external_url": "",
                            "blog_slug": "welcome-to-my-digital-garden",
                        },
                    ],
                    ensure_ascii=False,
                ),
                skills_markdown=(
                    "- Python / FastAPI\n"
                    "- TypeScript / React\n"
                    "- Product thinking\n"
                    "- Technical writing"
                ),
            )
        )

    seed_markdown_posts()

    if not db.query(GuestbookEntry).first():
        db.add(
            GuestbookEntry(
                name="First Visitor",
                message="網站開張順利，期待看到更多文章。",
                approved=True,
            )
        )

    db.commit()


def seed_markdown_posts() -> None:
    ensure_posts_dir()
    posts: dict[str, str] = {
        "welcome-to-my-digital-garden.md": """---
title: Welcome to My Digital Garden
slug: welcome-to-my-digital-garden
summary: 第一篇文章，用來介紹這個網站的內容方向與寫作方式。
category: writing
cover_image_url: https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80
tags: intro, writing
published: true
created_at: 2026-04-01T09:00:00Z
updated_at: 2026-04-01T09:00:00Z
---

# Welcome

這個網站會持續整理我的技術筆記、工作方法與一些長篇文章。

## Why Markdown?

因為可攜、簡單、版本控制友善。

![Desk setup](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80)
""",
        "fastapi-react-personal-site-architecture.md": """---
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
""",
    }

    for filename, content in posts.items():
        path = POSTS_DIR / filename
        if not path.exists():
            path.write_text(content, encoding="utf-8")
