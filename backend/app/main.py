from __future__ import annotations

import json
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .auth import authenticate_admin, create_access_token, get_current_admin
from .config import settings
from .content import MarkdownPost, delete_post, get_post, list_posts, save_post
from .database import Base, SessionLocal, engine, get_db
from .models import GuestbookEntry, Profile
from .schemas import (
    BlogPostCreate,
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
settings.uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.uploads_path), name="uploads")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)


def serialize_post(post: MarkdownPost) -> BlogPostRead:
    return BlogPostRead(
        title=post.title,
        slug=post.slug,
        summary=post.summary,
        category=post.category,
        cover_image_url=post.cover_image_url,
        content_markdown=post.content_markdown,
        tags=post.tags,
        published=post.published,
        created_at=post.created_at,
        updated_at=post.updated_at,
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
        experiences=json.loads(profile.experiences_json),
        research_interests_markdown=profile.research_interests_markdown,
        publications=json.loads(profile.publications_json),
        projects=json.loads(profile.projects_json),
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


@app.get(f"{settings.api_prefix}/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post(f"{settings.api_prefix}/admin/uploads/image")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    _admin=Depends(get_current_admin),
) -> dict[str, str]:
    allowed_types = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    suffix = allowed_types.get(file.content_type or "")
    if not suffix:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    filename = f"{uuid4().hex}{suffix}"
    destination = settings.uploads_path / filename
    content = await file.read()
    destination.write_bytes(content)

    url = str(request.base_url).rstrip("/") + f"/uploads/{filename}"
    return {"url": url}


@app.delete(f"{settings.api_prefix}/admin/uploads/image")
def delete_uploaded_image(
    payload: UploadDeleteRequest,
    _admin=Depends(get_current_admin),
) -> dict[str, str]:
    marker = "/uploads/"
    if marker not in payload.url:
        return {"status": "ignored"}
    relative_name = payload.url.split(marker, 1)[1]
    target = (settings.uploads_path / relative_name).resolve()
    uploads_root = settings.uploads_path.resolve()
    if uploads_root not in target.parents or not target.exists():
        return {"status": "ignored"}
    target.unlink()
    return {"status": "deleted"}


@app.post(f"{settings.api_prefix}/auth/login", response_model=LoginResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> LoginResponse:
    user = authenticate_admin(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_access_token(user.username)
    return LoginResponse(token=TokenResponse(access_token=token), username=user.username)


@app.get(f"{settings.api_prefix}/profile", response_model=ProfileRead)
def get_profile(db: Session = Depends(get_db)) -> ProfileRead:
    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return serialize_profile(profile)


@app.get(f"{settings.api_prefix}/blog-posts", response_model=list[BlogPostRead])
def list_blog_posts() -> list[BlogPostRead]:
    return [serialize_post(post) for post in list_posts(include_drafts=False)]


@app.get(f"{settings.api_prefix}/blog-posts/{{slug}}", response_model=BlogPostRead)
def get_blog_post(slug: str) -> BlogPostRead:
    post = get_post(slug, include_drafts=False)
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return serialize_post(post)


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
    profile.skills_markdown = payload.skills_markdown
    db.commit()
    db.refresh(profile)
    return serialize_profile(profile)


@app.get(f"{settings.api_prefix}/admin/blog-posts", response_model=list[BlogPostRead])
def admin_list_posts(
    _admin=Depends(get_current_admin),
) -> list[BlogPostRead]:
    return [serialize_post(post) for post in list_posts(include_drafts=True)]


@app.post(f"{settings.api_prefix}/admin/blog-posts", response_model=BlogPostRead, status_code=status.HTTP_201_CREATED)
def admin_create_post(
    payload: BlogPostCreate,
    _admin=Depends(get_current_admin),
) -> BlogPostRead:
    try:
        post = save_post(
            {
                **payload.model_dump(),
                "created_at": payload.created_at.isoformat() if payload.created_at else None,
            }
        )
    except FileExistsError as exc:
        raise HTTPException(status_code=400, detail="Slug already exists") from exc
    return serialize_post(post)


@app.put(f"{settings.api_prefix}/admin/blog-posts/{{slug}}", response_model=BlogPostRead)
def admin_update_post(
    slug: str,
    payload: BlogPostUpdate,
    _admin=Depends(get_current_admin),
) -> BlogPostRead:
    existing = get_post(slug, include_drafts=True)
    if not existing:
        raise HTTPException(status_code=404, detail="Blog post not found")
    try:
        post = save_post(
            {
                **payload.model_dump(),
                "created_at": payload.created_at.isoformat() if payload.created_at else existing.created_at.isoformat(),
            },
            original_slug=slug,
        )
    except FileExistsError as exc:
        raise HTTPException(status_code=400, detail="Slug already exists") from exc
    return serialize_post(post)


@app.delete(f"{settings.api_prefix}/admin/blog-posts/{{slug}}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_post(
    slug: str,
    _admin=Depends(get_current_admin),
) -> None:
    try:
        delete_post(slug)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Blog post not found") from exc


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
