from __future__ import annotations

import io
import json
from datetime import date, datetime, time, timedelta, timezone
from time import perf_counter
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from PIL import Image, ImageOps
from sqlalchemy import inspect, or_, text
from sqlalchemy.orm import Session

from .assistant import (
    AssistantGenerationMetrics,
    DEFAULT_PROMPTS,
    answer_question_with_metrics,
    answer_question_with_prompt_pack,
    determine_show_sources,
    load_prompt_pack,
    stream_answer_question_with_metrics,
    stream_answer_question_with_prompt_pack,
    sync_knowledge_base,
)
from .auth import authenticate_admin, create_access_token, get_current_admin
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .models import (
    AssistantConversationSession,
    AssistantConversationTurn as AssistantConversationTurnModel,
    BlogComment,
    BlogPost,
    GuestbookEntry,
    Profile,
    PromptTemplate,
    SkillCard,
    UploadedImage,
)
from .schemas import (
    AskAssistantRequest,
    AskAssistantResponse,
    AssistantConversationTurn as AssistantConversationTurnSchema,
    AssistantConversationSessionDetail,
    AssistantConversationSessionRead,
    AssistantConversationTurnRead,
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
    PromptTemplateRead,
    PromptTemplateUpdate,
    PromptTestRunnerRequest,
    PromptTestRunnerResponse,
    PromptTestTemplateInput,
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


def ensure_assistant_conversation_schema() -> None:
    inspector = inspect(engine)
    if "assistant_conversation_sessions" not in inspector.get_table_names():
        return
    session_columns = {column["name"] for column in inspector.get_columns("assistant_conversation_sessions")}
    turn_columns = {column["name"] for column in inspector.get_columns("assistant_conversation_turns")}
    with engine.begin() as connection:
        for column_name, ddl in [
            ("last_model_name", "ALTER TABLE assistant_conversation_sessions ADD COLUMN last_model_name TEXT DEFAULT ''"),
            ("last_latency_ms", "ALTER TABLE assistant_conversation_sessions ADD COLUMN last_latency_ms INTEGER DEFAULT 0"),
            ("last_input_tokens", "ALTER TABLE assistant_conversation_sessions ADD COLUMN last_input_tokens INTEGER DEFAULT 0"),
            ("last_output_tokens", "ALTER TABLE assistant_conversation_sessions ADD COLUMN last_output_tokens INTEGER DEFAULT 0"),
            ("last_total_tokens", "ALTER TABLE assistant_conversation_sessions ADD COLUMN last_total_tokens INTEGER DEFAULT 0"),
            ("total_input_tokens", "ALTER TABLE assistant_conversation_sessions ADD COLUMN total_input_tokens INTEGER DEFAULT 0"),
            ("total_output_tokens", "ALTER TABLE assistant_conversation_sessions ADD COLUMN total_output_tokens INTEGER DEFAULT 0"),
            ("total_tokens", "ALTER TABLE assistant_conversation_sessions ADD COLUMN total_tokens INTEGER DEFAULT 0"),
        ]:
            if column_name not in session_columns:
                connection.execute(text(ddl))

        for column_name, ddl in [
            ("model_name", "ALTER TABLE assistant_conversation_turns ADD COLUMN model_name TEXT DEFAULT ''"),
            ("latency_ms", "ALTER TABLE assistant_conversation_turns ADD COLUMN latency_ms INTEGER DEFAULT 0"),
            ("input_tokens", "ALTER TABLE assistant_conversation_turns ADD COLUMN input_tokens INTEGER DEFAULT 0"),
            ("output_tokens", "ALTER TABLE assistant_conversation_turns ADD COLUMN output_tokens INTEGER DEFAULT 0"),
            ("total_tokens", "ALTER TABLE assistant_conversation_turns ADD COLUMN total_tokens INTEGER DEFAULT 0"),
            ("usage_source", "ALTER TABLE assistant_conversation_turns ADD COLUMN usage_source TEXT DEFAULT 'estimated'"),
            ("prompt_versions_json", "ALTER TABLE assistant_conversation_turns ADD COLUMN prompt_versions_json TEXT DEFAULT '{}'"),
        ]:
            if column_name not in turn_columns:
                connection.execute(text(ddl))


def ensure_prompt_template_schema() -> None:
    inspector = inspect(engine)
    if "prompt_templates" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("prompt_templates")}
    with engine.begin() as connection:
        if "enabled" not in columns:
            connection.execute(text("ALTER TABLE prompt_templates ADD COLUMN enabled BOOLEAN DEFAULT 1"))
        if "version" not in columns:
            connection.execute(text("ALTER TABLE prompt_templates ADD COLUMN version INTEGER DEFAULT 1"))


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_profile_schema()
    ensure_blog_post_metrics_schema()
    ensure_assistant_conversation_schema()
    ensure_prompt_template_schema()
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


def serialize_assistant_turn(turn: AssistantConversationTurnModel) -> AssistantConversationTurnRead:
    return AssistantConversationTurnRead(
        id=turn.id,
        turn_index=turn.turn_index,
        question=turn.question,
        answer=turn.answer,
        show_sources=turn.show_sources,
        model_name=turn.model_name,
        latency_ms=turn.latency_ms,
        input_tokens=turn.input_tokens,
        output_tokens=turn.output_tokens,
        total_tokens=turn.total_tokens,
        usage_source=turn.usage_source,
        prompt_versions=json.loads(turn.prompt_versions_json or "{}"),
        selected_skills=[
            AssistantSkillCardRead.model_validate(item) for item in json.loads(turn.selected_skills_json or "[]")
        ],
        related_links=[AssistantRelatedLink.model_validate(item) for item in json.loads(turn.related_links_json or "[]")],
        history=[AssistantConversationTurnSchema.model_validate(item) for item in json.loads(turn.history_json or "[]")],
        created_at=turn.created_at,
    )


def serialize_assistant_session(session: AssistantConversationSession) -> AssistantConversationSessionRead:
    return AssistantConversationSessionRead(
        id=session.id,
        session_id=session.session_key,
        title=session.title,
        first_question=session.first_question,
        last_question=session.last_question,
        last_answer_preview=session.last_answer_preview,
        last_model_name=session.last_model_name,
        last_latency_ms=session.last_latency_ms,
        last_input_tokens=session.last_input_tokens,
        last_output_tokens=session.last_output_tokens,
        last_total_tokens=session.last_total_tokens,
        last_prompt_versions=json.loads(session.last_prompt_versions_json or "{}"),
        total_input_tokens=session.total_input_tokens,
        total_output_tokens=session.total_output_tokens,
        total_tokens=session.total_tokens,
        turn_count=session.turn_count,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


def serialize_prompt_template(prompt: PromptTemplate) -> PromptTemplateRead:
    return PromptTemplateRead(
        id=prompt.id,
        prompt_key=prompt.prompt_key,
        title=prompt.title,
        description=prompt.description,
        content=prompt.content,
        version=prompt.version,
        enabled=prompt.enabled,
        created_at=prompt.created_at,
        updated_at=prompt.updated_at,
    )


def _build_related_links(ranked_cards) -> list[AssistantRelatedLink]:
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
    return related_links


def _prompt_overrides_from_payload(prompts: list[PromptTestTemplateInput]) -> dict[str, str]:
    return {prompt.prompt_key: prompt.content for prompt in prompts if prompt.enabled}


def _normalize_assistant_session_title(question: str) -> str:
    cleaned = " ".join(question.split())
    return cleaned[:80] if cleaned else "Conversation"


def _store_assistant_turn(
    db: Session,
    *,
    session_key: str | None,
    question: str,
    answer: str,
    metrics: AssistantGenerationMetrics,
    latency_ms: int,
    prompt_versions: dict[str, int],
    show_sources: bool,
    selected_skills: list[AssistantSkillCardRead],
    related_links: list[AssistantRelatedLink],
    history: list[AssistantConversationTurnSchema],
) -> str:
    key = session_key or uuid4().hex
    session = db.query(AssistantConversationSession).filter(AssistantConversationSession.session_key == key).first()
    if not session:
        session = AssistantConversationSession(
            session_key=key,
            title=_normalize_assistant_session_title(question),
            first_question=question,
            last_question=question,
            last_answer_preview=answer[:500],
            turn_count=0,
        )
        db.add(session)
        db.flush()
    elif not session.title:
        session.title = _normalize_assistant_session_title(question)

    session.last_question = question
    session.last_answer_preview = answer[:500]
    session.last_model_name = metrics.model_name
    session.last_latency_ms = latency_ms
    session.last_input_tokens = metrics.input_tokens or 0
    session.last_output_tokens = metrics.output_tokens or 0
    session.last_total_tokens = metrics.total_tokens or 0
    session.last_prompt_versions_json = json.dumps(prompt_versions, ensure_ascii=False)
    session.total_input_tokens += metrics.input_tokens or 0
    session.total_output_tokens += metrics.output_tokens or 0
    session.total_tokens += metrics.total_tokens or 0
    session.turn_count += 1
    turn = AssistantConversationTurnModel(
        session_id=session.id,
        turn_index=session.turn_count,
        question=question,
        answer=answer,
        show_sources=show_sources,
        model_name=metrics.model_name,
        latency_ms=latency_ms,
        input_tokens=metrics.input_tokens or 0,
        output_tokens=metrics.output_tokens or 0,
        total_tokens=metrics.total_tokens or 0,
        usage_source=metrics.usage_source,
        prompt_versions_json=json.dumps(prompt_versions, ensure_ascii=False),
        selected_skills_json=json.dumps([item.model_dump() for item in selected_skills], ensure_ascii=False),
        related_links_json=json.dumps([item.model_dump() for item in related_links], ensure_ascii=False),
        history_json=json.dumps([item.model_dump() for item in history], ensure_ascii=False),
    )
    db.add(turn)
    db.commit()
    return key


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
    prompt_pack = load_prompt_pack(db)
    started_at = perf_counter()
    answer, metrics, show_sources, ranked_cards = answer_question_with_metrics(
        db,
        payload.question,
        history=payload.history,
    )
    selected_cards = [serialize_skill_card(item.card) for item in ranked_cards]
    related_links = _build_related_links(ranked_cards)

    _store_assistant_turn(
        db,
        session_key=payload.session_id,
        question=payload.question,
        answer=answer,
        metrics=metrics,
        latency_ms=int((perf_counter() - started_at) * 1000),
        prompt_versions=prompt_pack.prompt_versions,
        show_sources=show_sources,
        selected_skills=selected_cards,
        related_links=related_links,
        history=payload.history,
    )

    return AskAssistantResponse(
        answer=answer,
        show_sources=show_sources,
        selected_skills=selected_cards,
        related_links=related_links,
    )


@app.post(f"{settings.api_prefix}/ask/stream")
def ask_assistant_stream(payload: AskAssistantRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    prompt_pack = load_prompt_pack(db)
    fallback_answer, fallback_show_sources, ranked_cards, answer_stream, metrics_holder = stream_answer_question_with_metrics(
        db,
        payload.question,
        history=payload.history,
    )
    selected_cards = [serialize_skill_card(item.card) for item in ranked_cards]
    related_links = _build_related_links(ranked_cards)

    def stream():
        started_at = perf_counter()
        answer_parts: list[str] = []
        for delta in answer_stream:
            answer_parts.append(delta)
            yield json.dumps({"type": "text_delta", "delta": delta}, ensure_ascii=False) + "\n"

        final_answer = "".join(answer_parts).strip() or fallback_answer
        show_sources = (
            determine_show_sources(payload.question, final_answer, ranked_cards, payload.history, prompt_pack.source_visibility_prompt)
            if answer_parts
            else fallback_show_sources
        )
        if not answer_parts and fallback_answer:
            yield json.dumps({"type": "text_delta", "delta": fallback_answer}, ensure_ascii=False) + "\n"

        metrics = metrics_holder["metrics"] or AssistantGenerationMetrics(
            model_name="fallback",
            input_tokens=0,
            output_tokens=0,
            total_tokens=0,
            usage_source="estimated",
        )
        metrics_holder["metrics"] = metrics

        with SessionLocal() as log_db:
            _store_assistant_turn(
                log_db,
                session_key=payload.session_id,
                question=payload.question,
                answer=final_answer,
                metrics=metrics,
                latency_ms=int((perf_counter() - started_at) * 1000),
                prompt_versions=prompt_pack.prompt_versions,
                show_sources=show_sources,
                selected_skills=selected_cards,
                related_links=related_links,
                history=payload.history,
            )

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


@app.post(f"{settings.api_prefix}/admin/prompts/test", response_model=PromptTestRunnerResponse)
def admin_test_prompt_runner(
    payload: PromptTestRunnerRequest,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> PromptTestRunnerResponse:
    prompt_pack = load_prompt_pack(db, _prompt_overrides_from_payload(payload.prompts))
    started_at = perf_counter()
    answer, metrics, show_sources, ranked_cards = answer_question_with_prompt_pack(
        db,
        payload.question,
        payload.history,
        prompt_pack,
        limit=payload.limit,
    )
    related_links = _build_related_links(ranked_cards)
    selected_cards = [serialize_skill_card(item.card) for item in ranked_cards]
    return PromptTestRunnerResponse(
        answer=answer,
        show_sources=show_sources,
        selected_skills=selected_cards,
        related_links=related_links,
        model_name=metrics.model_name,
        input_tokens=metrics.input_tokens or 0,
        output_tokens=metrics.output_tokens or 0,
        total_tokens=metrics.total_tokens or 0,
        usage_source=metrics.usage_source,
        latency_ms=int((perf_counter() - started_at) * 1000),
        prompt_versions=prompt_pack.prompt_versions,
    )


@app.post(f"{settings.api_prefix}/admin/prompts/test/stream")
def admin_test_prompt_runner_stream(
    payload: PromptTestRunnerRequest,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    prompt_pack = load_prompt_pack(db, _prompt_overrides_from_payload(payload.prompts))
    normalized_history = [AssistantConversationTurnSchema(role=item.role, text=item.text) for item in payload.history]
    fallback_answer, fallback_show_sources, ranked_cards, answer_stream, metrics_holder = stream_answer_question_with_prompt_pack(
        db,
        payload.question,
        normalized_history,
        prompt_pack,
        limit=payload.limit,
    )
    selected_cards = [serialize_skill_card(item.card) for item in ranked_cards]
    related_links = _build_related_links(ranked_cards)

    def stream():
        started_at = perf_counter()
        answer_parts: list[str] = []
        for delta in answer_stream:
            answer_parts.append(delta)
            yield json.dumps({"type": "text_delta", "delta": delta}, ensure_ascii=False) + "\n"

        final_answer = "".join(answer_parts).strip() or fallback_answer
        show_sources = (
            determine_show_sources(
                payload.question,
                final_answer,
                ranked_cards,
                normalized_history,
                prompt_pack.source_visibility_prompt,
            )
            if answer_parts
            else fallback_show_sources
        )
        if not answer_parts and fallback_answer:
            yield json.dumps({"type": "text_delta", "delta": fallback_answer}, ensure_ascii=False) + "\n"

        metrics = metrics_holder["metrics"] or AssistantGenerationMetrics(
            model_name="fallback",
            input_tokens=0,
            output_tokens=0,
            total_tokens=0,
            usage_source="estimated",
        )
        yield json.dumps(
            {
                "type": "meta",
                "response": PromptTestRunnerResponse(
                    answer=final_answer,
                    show_sources=show_sources,
                    selected_skills=selected_cards,
                    related_links=related_links,
                    model_name=metrics.model_name,
                    input_tokens=metrics.input_tokens or 0,
                    output_tokens=metrics.output_tokens or 0,
                    total_tokens=metrics.total_tokens or 0,
                    usage_source=metrics.usage_source,
                    latency_ms=int((perf_counter() - started_at) * 1000),
                    prompt_versions=prompt_pack.prompt_versions,
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


@app.get(f"{settings.api_prefix}/admin/prompts", response_model=list[PromptTemplateRead])
def admin_list_prompts(
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[PromptTemplateRead]:
    prompts = db.query(PromptTemplate).order_by(PromptTemplate.prompt_key.asc()).all()
    return [serialize_prompt_template(prompt) for prompt in prompts]


@app.get(f"{settings.api_prefix}/admin/prompts/{{prompt_key}}", response_model=PromptTemplateRead)
def admin_get_prompt(
    prompt_key: str,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> PromptTemplateRead:
    prompt = db.query(PromptTemplate).filter(PromptTemplate.prompt_key == prompt_key).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return serialize_prompt_template(prompt)


@app.put(f"{settings.api_prefix}/admin/prompts/{{prompt_key}}", response_model=PromptTemplateRead)
def admin_update_prompt(
    prompt_key: str,
    payload: PromptTemplateUpdate,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> PromptTemplateRead:
    prompt = db.query(PromptTemplate).filter(PromptTemplate.prompt_key == prompt_key).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    prompt.title = payload.title
    prompt.description = payload.description
    prompt.content = payload.content
    prompt.enabled = payload.enabled
    prompt.version += 1
    db.commit()
    db.refresh(prompt)
    return serialize_prompt_template(prompt)


@app.post(f"{settings.api_prefix}/admin/prompts/{{prompt_key}}/reset", response_model=PromptTemplateRead)
def admin_reset_prompt(
    prompt_key: str,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> PromptTemplateRead:
    prompt = db.query(PromptTemplate).filter(PromptTemplate.prompt_key == prompt_key).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    default_prompt = DEFAULT_PROMPTS.get(prompt_key)
    if not default_prompt:
        raise HTTPException(status_code=404, detail="Default prompt not found")
    prompt.title = default_prompt["title"]
    prompt.description = default_prompt["description"]
    prompt.content = default_prompt["content"]
    prompt.enabled = True
    prompt.version += 1
    db.commit()
    db.refresh(prompt)
    return serialize_prompt_template(prompt)


@app.get(f"{settings.api_prefix}/admin/assistant/conversations", response_model=list[AssistantConversationSessionRead])
def admin_list_assistant_conversations(
    query: str = "",
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = 50,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[AssistantConversationSessionRead]:
    safe_limit = max(1, min(limit, 100))
    conversation_query = db.query(AssistantConversationSession)
    if query.strip():
        pattern = f"%{query.strip()}%"
        conversation_query = conversation_query.filter(
            or_(
                AssistantConversationSession.title.ilike(pattern),
                AssistantConversationSession.first_question.ilike(pattern),
                AssistantConversationSession.last_question.ilike(pattern),
                AssistantConversationSession.last_answer_preview.ilike(pattern),
            )
        )
    if start_date:
        conversation_query = conversation_query.filter(
            AssistantConversationSession.updated_at >= datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        )
    if end_date:
        conversation_query = conversation_query.filter(
            AssistantConversationSession.updated_at < datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
        )
    sessions = conversation_query.order_by(AssistantConversationSession.updated_at.desc()).limit(safe_limit).all()
    return [serialize_assistant_session(session) for session in sessions]


@app.get(
    f"{settings.api_prefix}/admin/assistant/conversations/{{session_id}}",
    response_model=AssistantConversationSessionDetail,
)
def admin_get_assistant_conversation(
    session_id: str,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> AssistantConversationSessionDetail:
    session = db.query(AssistantConversationSession).filter(AssistantConversationSession.session_key == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Conversation not found")
    turns = (
        db.query(AssistantConversationTurnModel)
        .filter(AssistantConversationTurnModel.session_id == session.id)
        .order_by(AssistantConversationTurnModel.turn_index.asc())
        .all()
    )
    return AssistantConversationSessionDetail(
        **serialize_assistant_session(session).model_dump(),
        turns=[serialize_assistant_turn(turn) for turn in turns],
    )


@app.delete(
    f"{settings.api_prefix}/admin/assistant/conversations/{{session_id}}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def admin_delete_assistant_conversation(
    session_id: str,
    _admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> None:
    session = db.query(AssistantConversationSession).filter(AssistantConversationSession.session_key == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.query(AssistantConversationTurnModel).filter(AssistantConversationTurnModel.session_id == session.id).delete()
    db.delete(session)
    db.commit()


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
