from __future__ import annotations

import io
import json
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from PIL import Image, ImageOps
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .assistant import answer_question, determine_show_sources, stream_answer_question, sync_knowledge_base
from .auth import authenticate_admin, create_access_token, get_current_admin
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .models import BlogComment, BlogPost, GuestbookEntry, Profile, SkillCard, UploadedImage
from .schemas import (
    AskAssistantRequest,
    AskAssistantResponse,
    AssistantRelatedLink,
    AssistantSkillCardRead,
    BlogCommentCreate,
    BlogCommentRead,
    BlogCommentUpdate,
    BlogPostCreate,
    BlogPostMetricResponse,
    BlogPostRead,
    BlogPostUpdate,
    GuestbookCreate,
    GuestbookRead,
    GuestbookUpdate,
    LoginResponse,
    ProfileRead,
    ProfileUpdate,
    TokenResponse,
    UploadDeleteRequest,
)
from .seed import seed_database

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ensure_profile_schema() -> None:
    inspector = inspect(engine)
    if "profiles" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("profiles")}
    default_order = '["research_interests", "skills", "publications", "projects"]'
    with engine.begin() as connection:
        if "overview_section_order_json" not in columns:
            connection.execute(
                text(
                    "ALTER TABLE profiles "
                    "ADD COLUMN overview_section_order_json TEXT "
                    f"DEFAULT '{default_order}'"
                )
            )
            connection.execute(
                text(
                    "UPDATE profiles "
                    f"SET overview_section_order_json = '{default_order}' "
                    "WHERE overview_section_order_json IS NULL"
                )
            )
        if "education_json" not in columns:
            connection.execute(text("ALTER TABLE profiles ADD COLUMN education_json TEXT DEFAULT '[]'"))
            connection.execute(text("UPDATE profiles SET education_json = '[]' WHERE education_json IS NULL"))


def ensure_blog_post_metrics_schema() -> None:
    inspector = inspect(engine)
    if "blog_posts" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("blog_posts")}
    with engine.begin() as connection:
        if "view_count" not in columns:
            connection.execute(text("ALTER TABLE blog_posts ADD COLUMN view_count INTEGER DEFAULT 0"))
            connection.execute(text("UPDATE blog_posts SET view_count = 0 WHERE view_count IS NULL"))
        if "like_count" not in columns:
            connection.execute(text("ALTER TABLE blog_posts ADD COLUMN like_count INTEGER DEFAULT 0"))
            connection.execute(text("UPDATE blog_posts SET like_count = 0 WHERE like_count IS NULL"))


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_profile_schema()
    ensure_blog_post_metrics_schema()
    with SessionLocal() as db:
        seed_database(db)
        sync_knowledge_base(db)
        db.commit()


def serialize_post(post: BlogPost) -> BlogPostRead:
    return BlogPostRead(
        title=post.title,
        slug=post.slug,
        summary=post.summary,
        category=post.category,
        cover_image_url=post.cover_image_url,
        content_markdown=post.content_markdown,
        tags=json.loads(post.tags_json),
        published=post.published,
        view_count=post.view_count,
        like_count=post.like_count,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def serialize_blog_comment(comment: BlogComment) -> BlogCommentRead:
    return BlogCommentRead(
        id=comment.id,
        post_slug=comment.post_slug,
        name=comment.name,
        message=comment.message,
        approved=comment.approved,
        created_at=comment.created_at,
    )


def serialize_skill_card(card: SkillCard) -> AssistantSkillCardRead:
    return AssistantSkillCardRead(
        id=card.id,
        skill_name=card.skill_name,
        skill_type=card.skill_type,
        summary=card.summary,
        tags=json.loads(card.tags_json),
        evidence_points=json.loads(card.evidence_json),
        url=card.url,
    )


def serialize_profile(profile: Profile) -> ProfileRead:
    return ProfileRead(
        id=profile.id,
        full_name=profile.full_name,
        headline=profile.headline,
        intro_markdown=profile.intro_markdown,
        location=profile.location,
        email=profile.email,
        avatar_url=profile.avatar_url,
        links=json.loads(profile.links_json),
        education=json.loads(profile.education_json or "[]"),
        experiences=json.loads(profile.experiences_json),
        research_interests_markdown=profile.research_interests_markdown,
        publications=json.loads(profile.publications_json),
        projects=json.loads(profile.projects_json),
        overview_section_order=json.loads(profile.overview_section_order_json),
        skills_markdown=profile.skills_markdown,
        updated_at=profile.updated_at,
    )


def serialize_guestbook(entry: GuestbookEntry) -> GuestbookRead:
    return GuestbookRead(
        id=entry.id,
        name=entry.name,
        message=entry.message,
        approved=entry.approved,
        created_at=entry.created_at,
    )


def optimize_image_upload(content: bytes, content_type: str) -> tuple[bytes, str, str]:
    fallback_ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }.get(content_type, ".bin")
    try:
        with Image.open(io.BytesIO(content)) as source:
            normalized = ImageOps.exif_transpose(source)
            is_animated = bool(getattr(normalized, "is_animated", False))
            if content_type == "image/gif" and is_animated:
                return content, content_type, ".gif"

            max_width = 1600
            max_height = 1600
            normalized.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
            if normalized.mode not in {"RGB", "L"}:
                normalized = normalized.convert("RGB")

            buffer = io.BytesIO()
            normalized.save(buffer, format="WEBP", quality=82, method=6)
            return buffer.getvalue(), "image/webp", ".webp"
    except Exception:
        return content, content_type, fallback_ext


@app.get(f"{settings.api_prefix}/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post(f"{settings.api_prefix}/admin/uploads/image")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    raw_content = await file.read()
    content, stored_content_type, suffix = optimize_image_upload(raw_content, file.content_type or "application/octet-stream")
    image_id = uuid4().hex
    image = UploadedImage(
        id=image_id,
        filename=file.filename or f"{image_id}{suffix}",
        content_type=stored_content_type,
        file_ext=suffix,
        data=content,
    )
    db.add(image)
    db.commit()

    url = str(request.base_url).rstrip("/") + f"/uploads/{image_id}{suffix}"
    return {"url": url}


@app.delete(f"{settings.api_prefix}/admin/uploads/image")
def delete_uploaded_image(
    payload: UploadDeleteRequest,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    marker = "/uploads/"
    if marker not in payload.url:
        return {"status": "ignored"}
    image_ref = payload.url.split(marker, 1)[1].split("?", 1)[0]
    image_id = image_ref.split(".", 1)[0]
    if not image_id:
        return {"status": "ignored"}
    image = db.query(UploadedImage).filter(UploadedImage.id == image_id).first()
    if not image:
        return {"status": "ignored"}
    db.delete(image)
    db.commit()
    return {"status": "deleted"}


@app.get("/uploads/{image_name}")
def get_uploaded_image(image_name: str, db: Session = Depends(get_db)) -> Response:
    image_id = image_name.split(".", 1)[0]
    image = db.query(UploadedImage).filter(UploadedImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return Response(
        content=image.data,
        media_type=image.content_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@app.post(f"{settings.api_prefix}/auth/login", response_model=LoginResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> LoginResponse:
    user = authenticate_admin(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_access_token(user.username)
    return LoginResponse(token=TokenResponse(access_token=token), username=user.username)


@app.post(f"{settings.api_prefix}/ask", response_model=AskAssistantResponse)
def ask_assistant(payload: AskAssistantRequest, db: Session = Depends(get_db)) -> AskAssistantResponse:
    answer, show_sources, ranked_cards = answer_question(db, payload.question, history=payload.history)
    selected_cards = [serialize_skill_card(item.card) for item in ranked_cards]
    seen_links: set[str] = set()
    related_links: list[AssistantRelatedLink] = []
    for item in ranked_cards:
        if not item.card.url or item.card.url in seen_links:
            continue
        seen_links.add(item.card.url)
        related_links.append(
            AssistantRelatedLink(
                title=item.card.skill_name,
                url=item.card.url,
                type=item.card.skill_type,
            )
        )

    return AskAssistantResponse(
        answer=answer,
        show_sources=show_sources,
        selected_skills=selected_cards,
        related_links=related_links,
    )


@app.post(f"{settings.api_prefix}/ask/stream")
def ask_assistant_stream(payload: AskAssistantRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    fallback_answer, fallback_show_sources, ranked_cards, answer_stream = stream_answer_question(
        db,
        payload.question,
        history=payload.history,
    )
    selected_cards = [serialize_skill_card(item.card) for item in ranked_cards]
    seen_links: set[str] = set()
    related_links: list[AssistantRelatedLink] = []
    for item in ranked_cards:
        if not item.card.url or item.card.url in seen_links:
            continue
        seen_links.add(item.card.url)
        related_links.append(
            AssistantRelatedLink(
                title=item.card.skill_name,
                url=item.card.url,
                type=item.card.skill_type,
            )
        )

    def stream():
        answer_parts: list[str] = []
        for delta in answer_stream:
            answer_parts.append(delta)
            yield json.dumps({"type": "text_delta", "delta": delta}, ensure_ascii=False) + "\n"

        final_answer = "".join(answer_parts).strip() or fallback_answer
        show_sources = (
            determine_show_sources(payload.question, final_answer, ranked_cards, payload.history)
            if answer_parts
            else fallback_show_sources
        )
        if not answer_parts and fallback_answer:
            yield json.dumps({"type": "text_delta", "delta": fallback_answer}, ensure_ascii=False) + "\n"

        yield json.dumps(
            {
                "type": "meta",
                "response": AskAssistantResponse(
                    answer=final_answer,
                    show_sources=show_sources,
                    selected_skills=selected_cards,
                    related_links=related_links,
                ).model_dump(),
            },
            ensure_ascii=False,
        ) + "\n"
        yield json.dumps({"type": "done"}, ensure_ascii=False) + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")


@app.get(f"{settings.api_prefix}/profile", response_model=ProfileRead)
def get_profile(db: Session = Depends(get_db)) -> ProfileRead:
    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return serialize_profile(profile)


@app.get(f"{settings.api_prefix}/blog-posts", response_model=list[BlogPostRead])
def list_blog_posts(db: Session = Depends(get_db)) -> list[BlogPostRead]:
    posts = (
        db.query(BlogPost)
        .filter(BlogPost.published.is_(True))
        .order_by(BlogPost.created_at.desc())
        .all()
    )
    return [serialize_post(post) for post in posts]


@app.get(f"{settings.api_prefix}/blog-posts/{{slug}}", response_model=BlogPostRead)
def get_blog_post(slug: str, db: Session = Depends(get_db)) -> BlogPostRead:
    post = (
        db.query(BlogPost)
        .filter(BlogPost.slug == slug, BlogPost.published.is_(True))
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return serialize_post(post)


@app.get(f"{settings.api_prefix}/blog-posts/{{slug}}/comments", response_model=list[BlogCommentRead])
def list_blog_comments(slug: str, db: Session = Depends(get_db)) -> list[BlogCommentRead]:
    post = (
        db.query(BlogPost)
        .filter(BlogPost.slug == slug, BlogPost.published.is_(True))
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    comments = (
        db.query(BlogComment)
        .filter(BlogComment.post_slug == slug, BlogComment.approved.is_(True))
        .order_by(BlogComment.created_at.desc())
        .all()
    )
    return [serialize_blog_comment(comment) for comment in comments]


@app.post(
    f"{settings.api_prefix}/blog-posts/{{slug}}/comments",
    response_model=BlogCommentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_blog_comment(slug: str, payload: BlogCommentCreate, db: Session = Depends(get_db)) -> BlogCommentRead:
    post = (
        db.query(BlogPost)
        .filter(BlogPost.slug == slug, BlogPost.published.is_(True))
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    comment = BlogComment(post_slug=slug, name=payload.name, message=payload.message, approved=False)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return serialize_blog_comment(comment)


@app.post(f"{settings.api_prefix}/blog-posts/{{slug}}/view", response_model=BlogPostMetricResponse)
def track_blog_post_view(slug: str, db: Session = Depends(get_db)) -> BlogPostMetricResponse:
    post = (
        db.query(BlogPost)
        .filter(BlogPost.slug == slug, BlogPost.published.is_(True))
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    post.view_count += 1
    db.commit()
    db.refresh(post)
    return BlogPostMetricResponse(view_count=post.view_count, like_count=post.like_count)


@app.post(f"{settings.api_prefix}/blog-posts/{{slug}}/like", response_model=BlogPostMetricResponse)
def like_blog_post(slug: str, db: Session = Depends(get_db)) -> BlogPostMetricResponse:
    post = (
        db.query(BlogPost)
        .filter(BlogPost.slug == slug, BlogPost.published.is_(True))
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    post.like_count += 1
    db.commit()
    db.refresh(post)
    return BlogPostMetricResponse(view_count=post.view_count, like_count=post.like_count)


@app.get(f"{settings.api_prefix}/guestbook", response_model=list[GuestbookRead])
def list_guestbook_entries(db: Session = Depends(get_db)) -> list[GuestbookRead]:
    entries = (
        db.query(GuestbookEntry)
        .filter(GuestbookEntry.approved.is_(True))
        .order_by(GuestbookEntry.created_at.desc())
        .all()
    )
    return [serialize_guestbook(entry) for entry in entries]


@app.post(f"{settings.api_prefix}/guestbook", response_model=GuestbookRead, status_code=status.HTTP_201_CREATED)
def create_guestbook_entry(payload: GuestbookCreate, db: Session = Depends(get_db)) -> GuestbookRead:
    entry = GuestbookEntry(name=payload.name, message=payload.message, approved=False)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return serialize_guestbook(entry)


@app.get(f"{settings.api_prefix}/admin/profile", response_model=ProfileRead)
def admin_get_profile(
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ProfileRead:
    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return serialize_profile(profile)


@app.put(f"{settings.api_prefix}/admin/profile", response_model=ProfileRead)
def admin_update_profile(
    payload: ProfileUpdate,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> ProfileRead:
    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile.full_name = payload.full_name
    profile.headline = payload.headline
    profile.intro_markdown = payload.intro_markdown
    profile.location = payload.location
    profile.email = payload.email
    profile.avatar_url = payload.avatar_url
    profile.links_json = json.dumps([link.model_dump() for link in payload.links], ensure_ascii=False)
    profile.education_json = json.dumps([item.model_dump() for item in payload.education], ensure_ascii=False)
    profile.experiences_json = json.dumps(
        [experience.model_dump() for experience in payload.experiences],
        ensure_ascii=False,
    )
    profile.research_interests_markdown = payload.research_interests_markdown
    profile.publications_json = json.dumps(
        [publication.model_dump() for publication in payload.publications],
        ensure_ascii=False,
    )
    profile.projects_json = json.dumps(
        [project.model_dump() for project in payload.projects],
        ensure_ascii=False,
    )
    profile.overview_section_order_json = json.dumps(payload.overview_section_order, ensure_ascii=False)
    profile.skills_markdown = payload.skills_markdown
    sync_knowledge_base(db)
    db.commit()
    db.refresh(profile)
    return serialize_profile(profile)


@app.get(f"{settings.api_prefix}/admin/blog-posts", response_model=list[BlogPostRead])
def admin_list_posts(
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[BlogPostRead]:
    posts = db.query(BlogPost).order_by(BlogPost.created_at.desc()).all()
    return [serialize_post(post) for post in posts]


@app.post(f"{settings.api_prefix}/admin/blog-posts", response_model=BlogPostRead, status_code=status.HTTP_201_CREATED)
def admin_create_post(
    payload: BlogPostCreate,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> BlogPostRead:
    if db.query(BlogPost).filter(BlogPost.slug == payload.slug).first():
        raise HTTPException(status_code=400, detail="Slug already exists")

    post = BlogPost(
        title=payload.title,
        slug=payload.slug,
        summary=payload.summary,
        category=payload.category,
        cover_image_url=payload.cover_image_url,
        content_markdown=payload.content_markdown,
        tags_json=json.dumps(payload.tags, ensure_ascii=False),
        published=payload.published,
    )
    if payload.created_at:
        post.created_at = payload.created_at
        post.updated_at = payload.created_at
    db.add(post)
    db.flush()
    sync_knowledge_base(db)
    db.commit()
    db.refresh(post)
    return serialize_post(post)


@app.put(f"{settings.api_prefix}/admin/blog-posts/{{slug}}", response_model=BlogPostRead)
def admin_update_post(
    slug: str,
    payload: BlogPostUpdate,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> BlogPostRead:
    post = db.query(BlogPost).filter(BlogPost.slug == slug).first()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    slug_conflict = db.query(BlogPost).filter(BlogPost.slug == payload.slug, BlogPost.id != post.id).first()
    if slug_conflict:
        raise HTTPException(status_code=400, detail="Slug already exists")

    post.title = payload.title
    post.slug = payload.slug
    post.summary = payload.summary
    post.category = payload.category
    post.cover_image_url = payload.cover_image_url
    post.content_markdown = payload.content_markdown
    post.tags_json = json.dumps(payload.tags, ensure_ascii=False)
    post.published = payload.published
    if payload.slug != slug:
        comments = db.query(BlogComment).filter(BlogComment.post_slug == slug).all()
        for comment in comments:
            comment.post_slug = payload.slug
    if payload.created_at:
        post.created_at = payload.created_at
    sync_knowledge_base(db)
    db.commit()
    db.refresh(post)
    return serialize_post(post)


@app.delete(f"{settings.api_prefix}/admin/blog-posts/{{slug}}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_post(
    slug: str,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    post = db.query(BlogPost).filter(BlogPost.slug == slug).first()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    db.query(BlogComment).filter(BlogComment.post_slug == slug).delete()
    db.delete(post)
    sync_knowledge_base(db)
    db.commit()


@app.get(f"{settings.api_prefix}/admin/blog-posts/{{slug}}/comments", response_model=list[BlogCommentRead])
def admin_list_blog_comments(
    slug: str,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[BlogCommentRead]:
    post = db.query(BlogPost).filter(BlogPost.slug == slug).first()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    comments = (
        db.query(BlogComment)
        .filter(BlogComment.post_slug == slug)
        .order_by(BlogComment.created_at.desc())
        .all()
    )
    return [serialize_blog_comment(comment) for comment in comments]


@app.put(
    f"{settings.api_prefix}/admin/blog-posts/{{slug}}/comments/{{comment_id}}",
    response_model=BlogCommentRead,
)
def admin_update_blog_comment(
    slug: str,
    comment_id: int,
    payload: BlogCommentUpdate,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> BlogCommentRead:
    comment = (
        db.query(BlogComment)
        .filter(BlogComment.id == comment_id, BlogComment.post_slug == slug)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    comment.name = payload.name
    comment.message = payload.message
    comment.approved = payload.approved
    db.commit()
    db.refresh(comment)
    return serialize_blog_comment(comment)


@app.delete(
    f"{settings.api_prefix}/admin/blog-posts/{{slug}}/comments/{{comment_id}}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def admin_delete_blog_comment(
    slug: str,
    comment_id: int,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    comment = (
        db.query(BlogComment)
        .filter(BlogComment.id == comment_id, BlogComment.post_slug == slug)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(comment)
    db.commit()


@app.post(f"{settings.api_prefix}/admin/assistant/sync")
def admin_sync_assistant_knowledge(
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    sync_knowledge_base(db)
    db.commit()
    return {"status": "ok"}


@app.get(f"{settings.api_prefix}/admin/guestbook", response_model=list[GuestbookRead])
def admin_list_guestbook(
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[GuestbookRead]:
    entries = db.query(GuestbookEntry).order_by(GuestbookEntry.created_at.desc()).all()
    return [serialize_guestbook(entry) for entry in entries]


@app.put(f"{settings.api_prefix}/admin/guestbook/{{entry_id}}", response_model=GuestbookRead)
def admin_update_guestbook(
    entry_id: int,
    payload: GuestbookUpdate,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> GuestbookRead:
    entry = db.query(GuestbookEntry).filter(GuestbookEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Guestbook entry not found")
    entry.name = payload.name
    entry.message = payload.message
    entry.approved = payload.approved
    db.commit()
    db.refresh(entry)
    return serialize_guestbook(entry)


@app.delete(f"{settings.api_prefix}/admin/guestbook/{{entry_id}}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_guestbook(
    entry_id: int,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    entry = db.query(GuestbookEntry).filter(GuestbookEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Guestbook entry not found")
    db.delete(entry)
    db.commit()
