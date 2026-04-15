from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass
from typing import Any
from collections.abc import Iterator
from urllib import error, request

from sqlalchemy.orm import Session

from .config import settings
from .models import BlogPost, KnowledgeItem, Profile, SkillCard
from .schemas import AssistantConversationTurn


TOKEN_PATTERN = re.compile(r"[a-z0-9][a-z0-9\-\+#\.]{1,}")
SOCIAL_TOKENS = {
    "hi",
    "hello",
    "hey",
    "thanks",
    "thank",
    "thx",
    "yo",
    "ok",
    "okay",
    "cool",
    "nice",
}


@dataclass
class RankedSkillCard:
    card: SkillCard
    tags: list[str]
    questions: list[str]
    evidence: list[str]
    score: float


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _tokenize(value: str) -> list[str]:
    return TOKEN_PATTERN.findall(value.lower())


def _safe_json_loads(value: str, default: list[str] | None = None) -> list[str]:
    if not value:
        return default or []
    try:
        loaded = json.loads(value)
        return loaded if isinstance(loaded, list) else (default or [])
    except json.JSONDecodeError:
        return default or []


def _build_search_text(*parts: str) -> str:
    return _normalize_whitespace(" ".join(part for part in parts if part))


def _build_profile_cards(profile: Profile) -> list[tuple[KnowledgeItem, SkillCard]]:
    items: list[tuple[KnowledgeItem, SkillCard]] = []
    links = _safe_json_loads(profile.links_json)
    experiences = _safe_json_loads(profile.experiences_json)
    projects = _safe_json_loads(profile.projects_json)
    publications = _safe_json_loads(profile.publications_json)

    profile_summary = _normalize_whitespace(f"{profile.headline}. {profile.location}. {profile.intro_markdown}")
    profile_item = KnowledgeItem(
        source_key="profile:main",
        source_type="profile",
        source_id="main",
        title=profile.full_name,
        summary=profile.headline,
        content=_build_search_text(profile.intro_markdown, profile.research_interests_markdown, profile.skills_markdown),
        url="/",
        published=True,
        updated_at=profile.updated_at,
    )
    profile_card = SkillCard(
        knowledge_source_key=profile_item.source_key,
        skill_name=f"{profile.full_name} overview",
        skill_type="profile",
        summary=profile_summary,
        tags_json=json.dumps(["profile", "bio", "ai", "engineering"], ensure_ascii=False),
        questions_json=json.dumps(
            [
                "Who is Vincent Hsia?",
                "What does Vincent build?",
                "What are Vincent's core skills?",
            ],
            ensure_ascii=False,
        ),
        evidence_json=json.dumps(
            [
                profile.headline,
                f"Based in {profile.location}",
                f"{len(links)} public links listed on the site",
            ],
            ensure_ascii=False,
        ),
        search_text=_build_search_text(
            profile.full_name,
            profile.headline,
            profile.intro_markdown,
            profile.research_interests_markdown,
            profile.skills_markdown,
        ),
        url="/",
        priority=1.0,
        enabled=True,
        updated_at=profile.updated_at,
    )
    items.append((profile_item, profile_card))

    for index, experience in enumerate(experiences):
        title = f"{experience.get('role', '')} at {experience.get('company', '')}".strip()
        summary = _normalize_whitespace(experience.get("summary", ""))
        url = f"/blog/{experience.get('story_slug')}" if experience.get("story_slug") else "/"
        item = KnowledgeItem(
            source_key=f"experience:{index}",
            source_type="experience",
            source_id=str(index),
            title=title or f"Experience {index + 1}",
            summary=experience.get("period", ""),
            content=_build_search_text(experience.get("company", ""), experience.get("role", ""), summary),
            url=url,
            published=True,
            updated_at=profile.updated_at,
        )
        card = SkillCard(
            knowledge_source_key=item.source_key,
            skill_name=title or f"Experience {index + 1}",
            skill_type="experience",
            summary=summary or experience.get("period", ""),
            tags_json=json.dumps(
                ["experience", experience.get("company", ""), experience.get("role", ""), "career"],
                ensure_ascii=False,
            ),
            questions_json=json.dumps(
                [
                    "What experience does Vincent have?",
                    f"Has Vincent worked on {experience.get('company', 'this company')} projects?",
                ],
                ensure_ascii=False,
            ),
            evidence_json=json.dumps(
                [
                    experience.get("period", ""),
                    experience.get("role", ""),
                    experience.get("company", ""),
                ],
                ensure_ascii=False,
            ),
            search_text=_build_search_text(
                title,
                experience.get("period", ""),
                summary,
                experience.get("company", ""),
                experience.get("role", ""),
            ),
            url=url,
            priority=0.9,
            enabled=True,
            updated_at=profile.updated_at,
        )
        items.append((item, card))

    for index, project in enumerate(projects):
        content = _normalize_whitespace(project.get("summary", ""))
        url = f"/blog/{project.get('blog_slug')}" if project.get("blog_slug") else (project.get("external_url") or "/")
        item = KnowledgeItem(
            source_key=f"project:{index}",
            source_type="project",
            source_id=str(index),
            title=project.get("title", f"Project {index + 1}"),
            summary=project.get("period", ""),
            content=content,
            url=url,
            published=True,
            updated_at=profile.updated_at,
        )
        card = SkillCard(
            knowledge_source_key=item.source_key,
            skill_name=item.title,
            skill_type="project",
            summary=content or project.get("period", ""),
            tags_json=json.dumps(["project", project.get("period", ""), "build"], ensure_ascii=False),
            questions_json=json.dumps(
                [
                    "What projects has Vincent built?",
                    f"Is there a project related to {project.get('title', 'this topic')}?",
                ],
                ensure_ascii=False,
            ),
            evidence_json=json.dumps([project.get("period", ""), project.get("title", "")], ensure_ascii=False),
            search_text=_build_search_text(item.title, project.get("period", ""), content),
            url=url,
            priority=0.88,
            enabled=True,
            updated_at=profile.updated_at,
        )
        items.append((item, card))

    for index, publication in enumerate(publications):
        title = publication.get("title", f"Publication {index + 1}")
        authors = publication.get("authors", "")
        venue = publication.get("venue", "")
        year = str(publication.get("year", ""))
        award = publication.get("award", "")
        summary = _build_search_text(authors, venue, year, award)
        url = f"/blog/{publication.get('blog_slug')}" if publication.get("blog_slug") else (publication.get("external_url") or "/")
        item = KnowledgeItem(
            source_key=f"publication:{index}",
            source_type="publication",
            source_id=str(index),
            title=title,
            summary=summary,
            content=summary,
            url=url,
            published=True,
            updated_at=profile.updated_at,
        )
        card = SkillCard(
            knowledge_source_key=item.source_key,
            skill_name=title,
            skill_type="publication",
            summary=summary,
            tags_json=json.dumps(["publication", venue, year, "research"], ensure_ascii=False),
            questions_json=json.dumps(
                [
                    "What has Vincent published or written academically?",
                    "Does Vincent have research output?",
                ],
                ensure_ascii=False,
            ),
            evidence_json=json.dumps([authors, venue, year, award], ensure_ascii=False),
            search_text=_build_search_text(title, authors, venue, year, award),
            url=url,
            priority=0.82,
            enabled=True,
            updated_at=profile.updated_at,
        )
        items.append((item, card))

    return items


def _build_post_cards(posts: list[BlogPost]) -> list[tuple[KnowledgeItem, SkillCard]]:
    items: list[tuple[KnowledgeItem, SkillCard]] = []
    for post in posts:
        tags = json.loads(post.tags_json)
        item = KnowledgeItem(
            source_key=f"post:{post.slug}",
            source_type="post",
            source_id=post.slug,
            title=post.title,
            summary=post.summary,
            content=post.content_markdown,
            url=f"/blog/{post.slug}",
            published=post.published,
            updated_at=post.updated_at,
        )
        card = SkillCard(
            knowledge_source_key=item.source_key,
            skill_name=post.title,
            skill_type="post",
            summary=post.summary,
            tags_json=json.dumps(tags + [post.category, "blog"], ensure_ascii=False),
            questions_json=json.dumps(
                [
                    f"What should I read about {post.category}?",
                    f"Which post covers {post.title}?",
                ],
                ensure_ascii=False,
            ),
            evidence_json=json.dumps(
                [post.summary, f"Category: {post.category}"] + [f"Tag: {tag}" for tag in tags[:3]],
                ensure_ascii=False,
            ),
            search_text=_build_search_text(post.title, post.summary, post.content_markdown, post.category, " ".join(tags)),
            url=item.url,
            priority=0.86 if post.published else 0.2,
            enabled=post.published,
            updated_at=post.updated_at,
        )
        items.append((item, card))
    return items


def sync_knowledge_base(db: Session) -> None:
    profile = db.query(Profile).first()
    posts = db.query(BlogPost).order_by(BlogPost.created_at.desc()).all()
    if not profile:
        return

    db.query(SkillCard).delete()
    db.query(KnowledgeItem).delete()

    built_items = _build_profile_cards(profile) + _build_post_cards(posts)
    knowledge_items: list[KnowledgeItem] = []
    skill_cards: list[SkillCard] = []
    for knowledge_item, skill_card in built_items:
        knowledge_items.append(knowledge_item)
        skill_cards.append(skill_card)

    db.add_all(knowledge_items)
    db.add_all(skill_cards)
    db.flush()


def search_skill_cards(db: Session, question: str, limit: int = 5) -> list[RankedSkillCard]:
    cards = db.query(SkillCard).filter(SkillCard.enabled.is_(True)).all()
    if not cards:
        return []

    question_tokens = _tokenize(question)
    question_counter = Counter(question_tokens)
    ranked: list[RankedSkillCard] = []

    for card in cards:
        tags = [tag for tag in _safe_json_loads(card.tags_json) if tag]
        questions = [item for item in _safe_json_loads(card.questions_json) if item]
        evidence = [item for item in _safe_json_loads(card.evidence_json) if item]
        searchable = _build_search_text(card.skill_name, card.summary, card.search_text, " ".join(tags), " ".join(questions))
        searchable_tokens = _tokenize(searchable)
        if not searchable_tokens:
            continue

        searchable_counter = Counter(searchable_tokens)
        overlap = sum(min(question_counter[token], searchable_counter[token]) for token in question_counter)
        if not overlap:
            lower_searchable = searchable.lower()
            overlap = sum(1 for token in question_tokens if token in lower_searchable)

        score = float(overlap) + (card.priority or 0)
        if card.skill_type in {"profile", "experience"} and {"who", "about", "background"} & set(question_tokens):
            score += 0.6
        if card.skill_type == "post" and {"read", "article", "blog", "post"} & set(question_tokens):
            score += 0.5
        if card.skill_type == "project" and {"project", "build", "built", "system"} & set(question_tokens):
            score += 0.5

        if score <= 0:
            continue

        ranked.append(
            RankedSkillCard(
                card=card,
                tags=tags,
                questions=questions,
                evidence=evidence,
                score=score,
            )
        )

    ranked.sort(key=lambda item: (item.score, item.card.priority, item.card.updated_at), reverse=True)
    return ranked[: max(1, min(limit, 8))]


def _extract_response_text(payload: dict[str, Any]) -> str:
    output = payload.get("output", [])
    chunks: list[str] = []
    for item in output:
        if item.get("type") != "message":
            continue
        for content_item in item.get("content", []):
            if content_item.get("type") == "output_text":
                chunks.append(content_item.get("text", ""))
    return _normalize_whitespace("\n".join(chunks))


def _normalize_history(history: list[AssistantConversationTurn]) -> list[AssistantConversationTurn]:
    normalized: list[AssistantConversationTurn] = []
    for turn in history[-12:]:
        text = _normalize_whitespace(turn.text)
        if not text:
            continue
        normalized.append(AssistantConversationTurn(role=turn.role, text=text[:4000]))
    return normalized


def _build_contextual_question(question: str, history: list[AssistantConversationTurn]) -> str:
    recent_user_turns = [turn.text for turn in history if turn.role == "user"]
    search_parts = recent_user_turns[-3:] + [question]
    return _build_search_text(*search_parts)


def _build_openai_request_body(
    question: str,
    ranked_cards: list[RankedSkillCard],
    history: list[AssistantConversationTurn],
    *,
    stream: bool,
) -> dict[str, Any]:
    card_context = []
    for item in ranked_cards:
        card_context.append(
            {
                "skill_name": item.card.skill_name,
                "skill_type": item.card.skill_type,
                "summary": item.card.summary,
                "tags": item.tags,
                "evidence": item.evidence,
                "url": item.card.url,
            }
        )

    inputs: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "You are a site assistant for Vincent Hsia. "
                "Use conversation history only to resolve context like pronouns, follow-up references, or topic continuity. "
                "Answer using only the provided site knowledge. "
                "Keep replies short by default: 1 short paragraph or 2-4 bullets. "
                "Decide the response style from the user's message yourself. "
                "If the user is only greeting you, thanking you, or making a vague social opener, reply in one short sentence and invite a more specific question. "
                "If the user asks what you can do, reply briefly with examples of what they can ask. "
                "Use longer answers only when the question is actually substantive. "
                "If the current message depends on earlier turns, acknowledge the reference naturally. "
                "Do not invent details."
            ),
        }
    ]

    for turn in history:
        inputs.append({"role": turn.role, "content": turn.text})

    inputs.append(
        {
            "role": "user",
            "content": json.dumps(
                {"question": question, "selected_skill_cards": card_context},
                ensure_ascii=False,
            ),
        }
    )

    return {
        "model": settings.openai_model,
        "stream": stream,
        "input": inputs,
    }


def _extract_json_object(payload: dict[str, Any]) -> dict[str, Any] | None:
    text = _extract_response_text(payload)
    if not text:
        return None
    try:
        loaded = json.loads(text)
    except json.JSONDecodeError:
        return None
    return loaded if isinstance(loaded, dict) else None


def _build_source_visibility_request_body(
    question: str,
    answer: str,
    ranked_cards: list[RankedSkillCard],
    history: list[AssistantConversationTurn],
) -> dict[str, Any]:
    card_context = [
        {
            "skill_name": item.card.skill_name,
            "skill_type": item.card.skill_type,
            "summary": item.card.summary,
            "url": item.card.url,
        }
        for item in ranked_cards
    ]
    history_context = [{"role": turn.role, "text": turn.text} for turn in history[-6:]]
    return {
        "model": settings.openai_model,
        "input": [
            {
                "role": "system",
                "content": (
                    "You decide whether a UI should show source cards for an assistant reply. "
                    "Return strict JSON only with one boolean field: {\"show_sources\": true|false}. "
                    "Return true only when the answer materially relies on the provided site knowledge cards. "
                    "Return false for greetings, thanks, vague social replies, generic follow-ups, or answers that do not really use the cards."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "question": question,
                        "answer": answer,
                        "history": history_context,
                        "selected_skill_cards": card_context,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
    }


def _should_force_hide_sources(question: str, answer: str, ranked_cards: list[RankedSkillCard]) -> bool:
    if not ranked_cards:
        return True

    normalized_question = _normalize_whitespace(question).lower()
    normalized_answer = _normalize_whitespace(answer).lower()
    question_tokens = set(_tokenize(normalized_question))

    if normalized_question in {"hi", "hello", "hey", "thanks", "thank you", "ok", "okay"}:
        return True
    if question_tokens and question_tokens.issubset(SOCIAL_TOKENS) and len(question_tokens) <= 3:
        return True
    if len(normalized_answer) < 40 and any(token in SOCIAL_TOKENS for token in question_tokens):
        return True
    return False


def decide_show_sources_with_openai(
    question: str,
    answer: str,
    ranked_cards: list[RankedSkillCard],
    history: list[AssistantConversationTurn],
) -> bool | None:
    if not settings.openai_api_key or not settings.openai_model:
        return None

    body = _build_source_visibility_request_body(question, answer, ranked_cards, history)
    req = request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (error.HTTPError, error.URLError, TimeoutError, json.JSONDecodeError):
        return None

    parsed = _extract_json_object(payload)
    if not parsed or not isinstance(parsed.get("show_sources"), bool):
        return None
    return parsed["show_sources"]


def determine_show_sources(
    question: str,
    answer: str,
    ranked_cards: list[RankedSkillCard],
    history: list[AssistantConversationTurn],
) -> bool:
    if _should_force_hide_sources(question, answer, ranked_cards):
        return False

    llm_decision = decide_show_sources_with_openai(question, answer, ranked_cards, history)
    if llm_decision is None:
        return bool(ranked_cards)
    if not ranked_cards:
        return False
    return llm_decision


def iter_openai_stream(
    question: str,
    ranked_cards: list[RankedSkillCard],
    history: list[AssistantConversationTurn],
) -> Iterator[str]:
    if not settings.openai_api_key or not settings.openai_model:
        return

    body = _build_openai_request_body(question, ranked_cards, history, stream=True)
    req = request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=60) as response:
            data_lines: list[str] = []
            for raw_line in response:
                line = raw_line.decode("utf-8")
                stripped = line.strip()
                if not stripped:
                    if not data_lines:
                        continue
                    data = "\n".join(data_lines)
                    data_lines = []
                    if data == "[DONE]":
                        break
                    try:
                        payload = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    if payload.get("type") == "response.output_text.delta":
                        delta = payload.get("delta", "")
                        if delta:
                            yield delta
                    continue

                if stripped.startswith("data:"):
                    data_lines.append(stripped[5:].lstrip())
    except (error.HTTPError, error.URLError, TimeoutError):
        return


def generate_answer_with_openai(
    question: str,
    ranked_cards: list[RankedSkillCard],
    history: list[AssistantConversationTurn],
) -> str | None:
    if not settings.openai_api_key or not settings.openai_model:
        return None
    body = _build_openai_request_body(question, ranked_cards, history, stream=False)
    req = request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (error.HTTPError, error.URLError, TimeoutError, json.JSONDecodeError):
        return None

    return _extract_response_text(payload) or None


def generate_fallback_answer(question: str, ranked_cards: list[RankedSkillCard]) -> str:
    if not ranked_cards:
        return (
            "I could not find enough site content to answer that yet. "
            "Try asking about Vincent's background, projects, publications, or blog posts."
        )

    lead = ranked_cards[0]
    supporting = ranked_cards[1:3]
    lines = [f"Based on the site content, {lead.card.summary or lead.card.skill_name}."]
    if supporting:
        support_names = ", ".join(item.card.skill_name for item in supporting)
        lines.append(f"Relevant follow-up context comes from {support_names}.")
    if any(item.card.skill_type == "post" for item in ranked_cards):
        lines.append("The related blog posts below are the best starting points for deeper reading.")
    else:
        lines.append(f"The strongest match for this question is `{lead.card.skill_name}`.")
    return " ".join(lines)


def answer_question(
    db: Session,
    question: str,
    history: list[AssistantConversationTurn] | None = None,
    limit: int = 4,
) -> tuple[str, bool, list[RankedSkillCard]]:
    normalized_history = _normalize_history(history or [])
    contextual_question = _build_contextual_question(question, normalized_history)
    ranked_cards = search_skill_cards(db, contextual_question, limit=limit)
    answer = generate_answer_with_openai(question, ranked_cards, normalized_history)
    if not answer:
        answer = generate_fallback_answer(question, ranked_cards)
    show_sources = determine_show_sources(question, answer, ranked_cards, normalized_history)
    return answer, show_sources, ranked_cards


def stream_answer_question(
    db: Session,
    question: str,
    history: list[AssistantConversationTurn] | None = None,
    limit: int = 4,
) -> tuple[str, bool, list[RankedSkillCard], Iterator[str]]:
    normalized_history = _normalize_history(history or [])
    contextual_question = _build_contextual_question(question, normalized_history)
    ranked_cards = search_skill_cards(db, contextual_question, limit=limit)
    if settings.openai_api_key and settings.openai_model:
        return "", True, ranked_cards, iter_openai_stream(question, ranked_cards, normalized_history)

    fallback_answer = generate_fallback_answer(question, ranked_cards)
    show_sources = determine_show_sources(question, fallback_answer, ranked_cards, normalized_history)

    def fallback_stream() -> Iterator[str]:
        words = fallback_answer.split(" ")
        for index, word in enumerate(words):
            yield word if index == len(words) - 1 else f"{word} "

    return fallback_answer, show_sources, ranked_cards, fallback_stream()
