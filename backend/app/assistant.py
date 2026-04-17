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
from .models import BlogPost, KnowledgeItem, Profile, PromptTemplate, SkillCard
from .schemas import AssistantConversationTurn


TOKEN_PATTERN = re.compile(r"[a-z0-9][a-z0-9\-\+#\.]{1,}")
CHINESE_CHARACTER_PATTERN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
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


@dataclass
class AssistantGenerationMetrics:
    model_name: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    usage_source: str = "estimated"

    def as_dict(self) -> dict[str, int | str | None]:
        return {
            "model_name": self.model_name,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "usage_source": self.usage_source,
        }


@dataclass
class AssistantPromptPack:
    answer_system_prompt: str
    selection_system_prompt: str
    source_visibility_prompt: str
    prompt_versions: dict[str, int]


DEFAULT_PROMPTS: dict[str, dict[str, str]] = {
    "answer_system_prompt": {
        "title": "Answer Prompt",
        "description": "Main system prompt that guides the assistant's answer style and safety.",
        "content": (
            "You are a site assistant for Vincent Hsia. "
            "Use conversation history only to resolve context like pronouns, follow-up references, or topic continuity. "
            "Answer using only the provided site knowledge. "
            "Reply only in Traditional Chinese or English. "
            "If the user writes in Chinese, reply in Traditional Chinese only, never Simplified Chinese. "
            "If the user writes in English, reply in English. "
            "Do not mix Simplified Chinese into the reply. "
            "Keep replies short by default: 1 short paragraph or 2-4 bullets. "
            "Decide the response style from the user's message yourself. "
            "If the user is only greeting you, thanking you, or making a vague social opener, reply in one short sentence and invite a more specific question. "
            "If the user asks what you can do, reply briefly with examples of what they can ask. "
            "Use longer answers only when the question is actually substantive. "
            "If the current message depends on earlier turns, acknowledge the reference naturally. "
            "Do not invent details."
        ),
    },
    "skill_selection_prompt": {
        "title": "Skill Selection Prompt",
        "description": "Prompt that ranks the most relevant knowledge cards for a user question.",
        "content": (
            "You select the most relevant site knowledge cards for answering a user question. "
            "Return strict JSON only with one field: {\"source_keys\": [\"...\"]}. "
            "Choose at most the requested limit. "
            "Prefer precision over recall. "
            "Use conversation history only to resolve follow-up context. "
            "If no cards are useful, return an empty array."
        ),
    },
    "source_visibility_prompt": {
        "title": "Source Visibility Prompt",
        "description": "Prompt that decides whether the UI should show source cards for a response.",
        "content": (
            "You decide whether a UI should show source cards for an assistant reply. "
            "Return strict JSON only with one boolean field: {\"show_sources\": true|false}. "
            "Return true only when the answer materially relies on the provided site knowledge cards. "
            "Return false for greetings, thanks, vague social replies, generic follow-ups, or answers that do not really use the cards."
        ),
    },
}


def _default_prompt_content(prompt_key: str) -> str:
    return DEFAULT_PROMPTS[prompt_key]["content"]


def _default_prompt_title(prompt_key: str) -> str:
    return DEFAULT_PROMPTS[prompt_key]["title"]


def _default_prompt_description(prompt_key: str) -> str:
    return DEFAULT_PROMPTS[prompt_key]["description"]


def load_prompt_pack(db: Session, prompt_overrides: dict[str, str] | None = None) -> AssistantPromptPack:
    prompts = {item.prompt_key: item for item in db.query(PromptTemplate).filter(PromptTemplate.enabled.is_(True)).all()}
    overrides = prompt_overrides or {}
    prompt_versions: dict[str, int] = {}

    def resolve(prompt_key: str) -> str:
        prompt = prompts.get(prompt_key)
        if prompt_key in overrides:
            prompt_versions[prompt_key] = prompt.version if prompt else 1
            return overrides[prompt_key]
        if prompt:
            prompt_versions[prompt_key] = prompt.version
            return prompt.content
        prompt_versions[prompt_key] = 1
        return _default_prompt_content(prompt_key)

    return AssistantPromptPack(
        answer_system_prompt=resolve("answer_system_prompt"),
        selection_system_prompt=resolve("skill_selection_prompt"),
        source_visibility_prompt=resolve("source_visibility_prompt"),
        prompt_versions=prompt_versions,
    )


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _tokenize(value: str) -> list[str]:
    return TOKEN_PATTERN.findall(value.lower())


def _prefers_chinese(value: str) -> bool:
    return bool(CHINESE_CHARACTER_PATTERN.search(value))


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
    education = _safe_json_loads(profile.education_json)
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

    for index, entry in enumerate(education):
        school = entry.get("school", "")
        department = entry.get("department_name", "")
        lab_name = entry.get("lab_name", "")
        period = entry.get("period", "")
        thesis_title = entry.get("thesis_title", "")
        title_parts = [school, department]
        title = " - ".join(part for part in title_parts if part) or f"Education {index + 1}"
        summary = _build_search_text(period, lab_name, thesis_title)
        item = KnowledgeItem(
            source_key=f"education:{index}",
            source_type="education",
            source_id=str(index),
            title=title,
            summary=period,
            content=_build_search_text(school, department, lab_name, thesis_title),
            url="/",
            published=True,
            updated_at=profile.updated_at,
        )
        card = SkillCard(
            knowledge_source_key=item.source_key,
            skill_name=title,
            skill_type="education",
            summary=summary or period or school,
            tags_json=json.dumps(
                ["education", school, department, lab_name, "academic", "thesis"],
                ensure_ascii=False,
            ),
            questions_json=json.dumps(
                [
                    "What is Vincent's educational background?",
                    f"Where did Vincent study {department or 'this field'}?",
                    "What lab or thesis did Vincent work on?",
                ],
                ensure_ascii=False,
            ),
            evidence_json=json.dumps(
                [period, school, department, lab_name, thesis_title],
                ensure_ascii=False,
            ),
            search_text=_build_search_text(title, period, school, department, lab_name, thesis_title),
            url="/",
            priority=0.87,
            enabled=True,
            updated_at=profile.updated_at,
        )
        items.append((item, card))

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


def list_enabled_skill_cards(db: Session) -> list[RankedSkillCard]:
    cards = db.query(SkillCard).filter(SkillCard.enabled.is_(True)).all()
    ranked: list[RankedSkillCard] = []
    for card in cards:
        ranked.append(
            RankedSkillCard(
                card=card,
                tags=[tag for tag in _safe_json_loads(card.tags_json) if tag],
                questions=[item for item in _safe_json_loads(card.questions_json) if item],
                evidence=[item for item in _safe_json_loads(card.evidence_json) if item],
                score=float(card.priority or 0),
            )
        )
    return ranked


def search_skill_cards(db: Session, question: str, limit: int = 5) -> list[RankedSkillCard]:
    cards = list_enabled_skill_cards(db)
    if not cards:
        return []

    question_tokens = _tokenize(question)
    question_counter = Counter(question_tokens)
    ranked: list[RankedSkillCard] = []

    for card in cards:
        tags = card.tags
        questions = card.questions
        evidence = card.evidence
        searchable = _build_search_text(card.card.skill_name, card.card.summary, card.card.search_text, " ".join(tags), " ".join(questions))
        searchable_tokens = _tokenize(searchable)
        if not searchable_tokens:
            continue

        searchable_counter = Counter(searchable_tokens)
        overlap = sum(min(question_counter[token], searchable_counter[token]) for token in question_counter)
        if not overlap:
            lower_searchable = searchable.lower()
            overlap = sum(1 for token in question_tokens if token in lower_searchable)

        score = float(overlap) + (card.card.priority or 0)
        if card.card.skill_type in {"profile", "experience", "education"} and {"who", "about", "background"} & set(question_tokens):
            score += 0.6
        if card.card.skill_type == "education" and {"education", "study", "school", "degree", "lab", "thesis", "master", "university"} & set(question_tokens):
            score += 0.6
        if card.card.skill_type == "post" and {"read", "article", "blog", "post"} & set(question_tokens):
            score += 0.5
        if card.card.skill_type == "project" and {"project", "build", "built", "system"} & set(question_tokens):
            score += 0.5

        if score <= 0:
            continue

        ranked.append(RankedSkillCard(card=card.card, tags=tags, questions=questions, evidence=evidence, score=score))

    ranked.sort(key=lambda item: (item.score, item.card.priority, item.card.updated_at), reverse=True)
    return ranked[: max(1, min(limit, 8))]


def _build_skill_card_selection_request_body(
    question: str,
    cards: list[RankedSkillCard],
    history: list[AssistantConversationTurn],
    selection_system_prompt: str,
    *,
    limit: int,
) -> dict[str, Any]:
    history_context = [{"role": turn.role, "text": turn.text} for turn in history[-6:]]
    candidates = [
        {
            "source_key": item.card.knowledge_source_key,
            "skill_name": item.card.skill_name,
            "skill_type": item.card.skill_type,
            "summary": item.card.summary,
            "tags": item.tags[:6],
            "evidence": item.evidence[:4],
            "url": item.card.url,
        }
        for item in cards
    ]
    return {
        "model": settings.openai_model,
        "input": [
            {
                "role": "system",
                "content": selection_system_prompt,
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "question": question,
                        "history": history_context,
                        "limit": max(1, min(limit, 8)),
                        "candidate_cards": candidates,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
    }


def select_skill_cards_with_openai(
    question: str,
    cards: list[RankedSkillCard],
    history: list[AssistantConversationTurn],
    selection_system_prompt: str,
    *,
    limit: int,
) -> list[RankedSkillCard] | None:
    if not settings.openai_api_key or not settings.openai_model:
        return None
    if not cards:
        return []

    body = _build_skill_card_selection_request_body(question, cards, history, selection_system_prompt, limit=limit)
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
    source_keys = parsed.get("source_keys") if parsed else None
    if not isinstance(source_keys, list):
        return None

    key_order = [key for key in source_keys if isinstance(key, str)]
    selected_by_key = {item.card.knowledge_source_key: item for item in cards}
    selected: list[RankedSkillCard] = []
    for key in key_order:
        item = selected_by_key.get(key)
        if item and item not in selected:
            selected.append(item)
        if len(selected) >= max(1, min(limit, 8)):
            break
    return selected


def select_skill_cards(
    db: Session,
    question: str,
    history: list[AssistantConversationTurn],
    selection_system_prompt: str,
    *,
    limit: int,
) -> list[RankedSkillCard]:
    all_cards = list_enabled_skill_cards(db)
    if settings.openai_api_key and settings.openai_model:
        selected = select_skill_cards_with_openai(question, all_cards, history, selection_system_prompt, limit=limit)
        if selected is not None:
            return selected

    contextual_question = _build_contextual_question(question, history)
    return search_skill_cards(db, contextual_question, limit=limit)


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
    answer_system_prompt: str,
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
            "content": answer_system_prompt,
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


def _estimate_token_count(text: str) -> int:
    if not text:
        return 0
    return max(1, len(text) // 4)


def _estimate_request_tokens(body: dict[str, Any], answer: str = "") -> AssistantGenerationMetrics:
    serialized_body = json.dumps(body, ensure_ascii=False)
    input_tokens = _estimate_token_count(serialized_body)
    output_tokens = _estimate_token_count(answer)
    total_tokens = input_tokens + output_tokens
    return AssistantGenerationMetrics(
        model_name=settings.openai_model or "fallback",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        usage_source="estimated",
    )


def _extract_usage(payload: dict[str, Any]) -> AssistantGenerationMetrics | None:
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return None

    input_tokens = usage.get("input_tokens")
    output_tokens = usage.get("output_tokens")
    total_tokens = usage.get("total_tokens")
    if not any(isinstance(item, int) for item in (input_tokens, output_tokens, total_tokens)):
        return None

    return AssistantGenerationMetrics(
        model_name=str(payload.get("model") or settings.openai_model or "openai"),
        input_tokens=input_tokens if isinstance(input_tokens, int) else None,
        output_tokens=output_tokens if isinstance(output_tokens, int) else None,
        total_tokens=total_tokens if isinstance(total_tokens, int) else None,
        usage_source="openai",
    )


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
    source_visibility_prompt: str,
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
                "content": source_visibility_prompt,
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
    source_visibility_prompt: str,
) -> bool | None:
    if not settings.openai_api_key or not settings.openai_model:
        return None

    body = _build_source_visibility_request_body(question, answer, ranked_cards, history, source_visibility_prompt)
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
    source_visibility_prompt: str,
) -> bool:
    if _should_force_hide_sources(question, answer, ranked_cards):
        return False

    llm_decision = decide_show_sources_with_openai(question, answer, ranked_cards, history, source_visibility_prompt)
    if llm_decision is None:
        return bool(ranked_cards)
    if not ranked_cards:
        return False
    return llm_decision


def iter_openai_stream(
    question: str,
    ranked_cards: list[RankedSkillCard],
    history: list[AssistantConversationTurn],
    answer_system_prompt: str,
) -> tuple[Iterator[str], dict[str, AssistantGenerationMetrics | None]]:
    if not settings.openai_api_key or not settings.openai_model:
        return iter(()), {"metrics": None}

    body = _build_openai_request_body(
        question,
        ranked_cards,
        history,
        answer_system_prompt,
        stream=True,
    )
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

    metrics_holder: dict[str, AssistantGenerationMetrics | None] = {"metrics": None}

    try:
        def stream() -> Iterator[str]:
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
                        if isinstance(payload, dict):
                            extracted = _extract_usage(payload)
                            if extracted:
                                metrics_holder["metrics"] = extracted
                            if payload.get("type") == "response.output_text.delta":
                                delta = payload.get("delta", "")
                                if delta:
                                    yield delta
                            continue

                    if stripped.startswith("data:"):
                        data_lines.append(stripped[5:].lstrip())

        return stream(), metrics_holder
    except (error.HTTPError, error.URLError, TimeoutError):
        return iter(()), {"metrics": None}


def generate_answer_with_openai(
    question: str,
    ranked_cards: list[RankedSkillCard],
    history: list[AssistantConversationTurn],
    answer_system_prompt: str,
) -> tuple[str | None, AssistantGenerationMetrics | None]:
    if not settings.openai_api_key or not settings.openai_model:
        return None, None
    body = _build_openai_request_body(question, ranked_cards, history, answer_system_prompt, stream=False)
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
        return None, _estimate_request_tokens(body)

    return _extract_response_text(payload) or None, _extract_usage(payload) or _estimate_request_tokens(body, _extract_response_text(payload) or "")


def generate_fallback_answer(question: str, ranked_cards: list[RankedSkillCard]) -> str:
    prefers_chinese = _prefers_chinese(question)
    if not ranked_cards:
        if prefers_chinese:
            return "我目前找不到足夠的站內內容來回答這個問題。你可以改問 Vincent 的背景、專案、發表或部落格文章。"
        return (
            "I could not find enough site content to answer that yet. "
            "Try asking about Vincent's background, projects, publications, or blog posts."
        )

    lead = ranked_cards[0]
    supporting = ranked_cards[1:3]
    if prefers_chinese:
        lines = [f"根據站內內容，{lead.card.summary or lead.card.skill_name}。"]
        if supporting:
            support_names = "、".join(item.card.skill_name for item in supporting)
            lines.append(f"相關的延伸參考包括 {support_names}。")
        if any(item.card.skill_type == "post" for item in ranked_cards):
            lines.append("如果你想深入了解，可以先看下面相關的部落格文章。")
        else:
            lines.append(f"這個問題目前最相關的內容是「{lead.card.skill_name}」。")
        return "".join(lines)

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
    answer, _metrics, show_sources, ranked_cards = answer_question_with_metrics(db, question, history=history, limit=limit)
    return answer, show_sources, ranked_cards


def answer_question_with_metrics(
    db: Session,
    question: str,
    history: list[AssistantConversationTurn] | None = None,
    limit: int = 4,
) -> tuple[str, AssistantGenerationMetrics, bool, list[RankedSkillCard]]:
    prompt_pack = load_prompt_pack(db)
    return answer_question_with_prompt_pack(db, question, history, prompt_pack, limit=limit)


def answer_question_with_prompt_pack(
    db: Session,
    question: str,
    history: list[AssistantConversationTurn] | None,
    prompt_pack: AssistantPromptPack,
    *,
    limit: int = 4,
) -> tuple[str, AssistantGenerationMetrics, bool, list[RankedSkillCard]]:
    normalized_history = _normalize_history(history or [])
    ranked_cards = select_skill_cards(
        db,
        question,
        normalized_history,
        prompt_pack.selection_system_prompt,
        limit=limit,
    )
    answer, metrics = generate_answer_with_openai(question, ranked_cards, normalized_history, prompt_pack.answer_system_prompt)
    if not answer:
        answer = generate_fallback_answer(question, ranked_cards)
    if not metrics:
        body = _build_openai_request_body(question, ranked_cards, normalized_history, prompt_pack.answer_system_prompt, stream=False)
        metrics = _estimate_request_tokens(body, answer)
    show_sources = determine_show_sources(
        question,
        answer,
        ranked_cards,
        normalized_history,
        prompt_pack.source_visibility_prompt,
    )
    return answer, metrics, show_sources, ranked_cards


def stream_answer_question(
    db: Session,
    question: str,
    history: list[AssistantConversationTurn] | None = None,
    limit: int = 4,
) -> tuple[str, bool, list[RankedSkillCard], Iterator[str]]:
    fallback_answer, show_sources, ranked_cards, answer_stream, _metrics = stream_answer_question_with_metrics(
        db,
        question,
        history=history,
        limit=limit,
    )
    return fallback_answer, show_sources, ranked_cards, answer_stream


def stream_answer_question_with_metrics(
    db: Session,
    question: str,
    history: list[AssistantConversationTurn] | None = None,
    limit: int = 4,
) -> tuple[str, bool, list[RankedSkillCard], Iterator[str], dict[str, AssistantGenerationMetrics | None]]:
    normalized_history = _normalize_history(history or [])
    prompt_pack = load_prompt_pack(db)
    return stream_answer_question_with_prompt_pack(
        db,
        question,
        normalized_history,
        prompt_pack,
        limit=limit,
    )


def stream_answer_question_with_prompt_pack(
    db: Session,
    question: str,
    history: list[AssistantConversationTurn] | None,
    prompt_pack: AssistantPromptPack,
    *,
    limit: int = 4,
) -> tuple[str, bool, list[RankedSkillCard], Iterator[str], dict[str, AssistantGenerationMetrics | None]]:
    normalized_history = _normalize_history(history or [])
    ranked_cards = select_skill_cards(db, question, normalized_history, prompt_pack.selection_system_prompt, limit=limit)
    if settings.openai_api_key and settings.openai_model:
        answer_stream, metrics_holder = iter_openai_stream(
            question,
            ranked_cards,
            normalized_history,
            prompt_pack.answer_system_prompt,
        )
        if metrics_holder["metrics"] is None:
            metrics_holder["metrics"] = _estimate_request_tokens(
                _build_openai_request_body(question, ranked_cards, normalized_history, prompt_pack.answer_system_prompt, stream=True)
            )
        return "", True, ranked_cards, answer_stream, metrics_holder

    fallback_answer = generate_fallback_answer(question, ranked_cards)
    show_sources = determine_show_sources(
        question,
        fallback_answer,
        ranked_cards,
        normalized_history,
        prompt_pack.source_visibility_prompt,
    )
    metrics = _estimate_request_tokens(
        _build_openai_request_body(question, ranked_cards, normalized_history, prompt_pack.answer_system_prompt, stream=False),
        fallback_answer,
    )

    def fallback_stream() -> Iterator[str]:
        words = fallback_answer.split(" ")
        for index, word in enumerate(words):
            yield word if index == len(words) - 1 else f"{word} "

    return fallback_answer, show_sources, ranked_cards, fallback_stream(), {"metrics": metrics}
