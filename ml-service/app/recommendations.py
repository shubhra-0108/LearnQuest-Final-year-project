"""
Learning Path Recommendations for LearnQuest.

Uses a skill prerequisite directed acyclic graph (DAG) to recommend
which skill a student should practice next, based on:
1. Current mastery levels across skills
2. Prerequisite readiness (don't recommend advanced before basics)
3. Spaced repetition priority (overdue skills get priority)

Skill codes follow: subject.topic (e.g., math.addsub, sci.life)
"""
from typing import Optional


# ─── Skill Prerequisite Graph ─────────────────────────────────────────────────
# Format: skill_code → list of prerequisite skill_codes
# Only needs to know about skills that have prerequisites
PREREQUISITE_GRAPH: dict[str, list[str]] = {
    # Math prerequisites
    "math.muldiv": ["math.addsub"],
    "math.fractions": ["math.muldiv"],
    "math.decimals": ["math.fractions"],
    "math.percentages": ["math.decimals"],
    "math.algebra": ["math.fractions", "math.decimals"],
    "math.geometry": ["math.addsub"],
    "math.mensuration": ["math.geometry", "math.fractions"],
    "math.statistics": ["math.muldiv", "math.fractions"],

    # Science prerequisites
    "sci.matter": ["sci.life"],  # Understanding matter builds on basic science
    "sci.energy": ["sci.matter"],
    "sci.environment": ["sci.life"],
    "sci.chemistry": ["sci.matter", "sci.energy"],
    "sci.physics": ["sci.energy"],
}

# Skill display names (EN, HI)
SKILL_NAMES: dict[str, dict[str, str]] = {
    "math.addsub":    {"en": "Addition & Subtraction", "hi": "जोड़ और घटाव"},
    "math.muldiv":    {"en": "Multiplication & Division", "hi": "गुणा और भाग"},
    "math.fractions": {"en": "Fractions", "hi": "भिन्न"},
    "math.decimals":  {"en": "Decimals", "hi": "दशमलव"},
    "math.percentages": {"en": "Percentages", "hi": "प्रतिशत"},
    "math.algebra":   {"en": "Basic Algebra", "hi": "बीजगणित"},
    "math.geometry":  {"en": "Geometry", "hi": "ज्यामिति"},
    "math.mensuration": {"en": "Mensuration", "hi": "क्षेत्रमिति"},
    "math.statistics": {"en": "Data & Statistics", "hi": "डेटा और सांख्यिकी"},
    "sci.life":       {"en": "Life Science", "hi": "जीव विज्ञान"},
    "sci.matter":     {"en": "Matter & Materials", "hi": "पदार्थ और सामग्री"},
    "sci.energy":     {"en": "Force & Energy", "hi": "बल और ऊर्जा"},
    "sci.environment": {"en": "Environment", "hi": "पर्यावरण"},
    "sci.chemistry":  {"en": "Chemistry Basics", "hi": "रसायन विज्ञान"},
    "sci.physics":    {"en": "Physics Basics", "hi": "भौतिक विज्ञान"},
}

MASTERY_READY_THRESHOLD = 0.60  # Need ≥60% mastery on prereqs to unlock next skill
MASTERY_WEAK_THRESHOLD = 0.45   # Below this = "weak" skill, prioritize


def is_unlocked(skill: str, mastery: dict[str, float]) -> bool:
    """
    Check if a skill is unlocked (all prerequisites meet readiness threshold).

    Args:
        skill: Skill code
        mastery: Dict of skill → p_known

    Returns:
        True if skill is unlocked (ready to practice)
    """
    prereqs = PREREQUISITE_GRAPH.get(skill, [])
    for prereq in prereqs:
        if mastery.get(prereq, 0.0) < MASTERY_READY_THRESHOLD:
            return False
    return True


def get_all_unlocked(mastery: dict[str, float]) -> list[str]:
    """Get all skills that are unlocked given current mastery."""
    all_skills = set(SKILL_NAMES.keys()) | set(mastery.keys())
    return [s for s in all_skills if is_unlocked(s, mastery)]


def recommend_next_skill(
    mastery: dict[str, float],
    available_skills: list[str],  # Skills that have questions in DB
    language: str = "en",
) -> Optional[dict]:
    """
    Recommend the best next skill for the student to practice.

    Priority order:
    1. Unlocked + weak (p_known < weak threshold) — needs remediation
    2. Unlocked + medium mastery — normal progression
    3. Locked but prereqs nearly met — suggest what to practice to unlock

    Args:
        mastery: Current mastery per skill
        available_skills: Skills with available questions in the DB
        language: 'en' or 'hi' for display names

    Returns:
        dict with: skill, name, p_known, reason, unlocked
        or None if no recommendation possible
    """
    if not available_skills:
        return None

    available_set = set(available_skills)
    recs = []

    for skill in available_skills:
        p_known = mastery.get(skill, 0.0)
        unlocked = is_unlocked(skill, mastery)
        prereqs = PREREQUISITE_GRAPH.get(skill, [])
        name = SKILL_NAMES.get(skill, {}).get(language, skill)

        if unlocked and p_known < MASTERY_WEAK_THRESHOLD:
            priority = 10.0 - p_known * 10  # Weakest unlocked = highest priority
            reason = "needs_practice" if p_known > 0 else "not_started"
        elif unlocked:
            priority = 5.0 - p_known * 5   # Medium priority for OK skills
            reason = "continue"
        else:
            # Check how close to unlocking
            prereq_avg = (
                sum(mastery.get(p, 0) for p in prereqs) / len(prereqs)
                if prereqs else 0
            )
            priority = prereq_avg * 2.0   # Low priority until prereqs met
            reason = "locked"

        recs.append({
            "skill": skill,
            "name": name,
            "p_known": round(p_known, 3),
            "priority": round(priority, 3),
            "reason": reason,
            "unlocked": unlocked,
            "prereqs_needed": [
                {"skill": p, "name": SKILL_NAMES.get(p, {}).get(language, p),
                 "p_known": round(mastery.get(p, 0), 3)}
                for p in prereqs
                if mastery.get(p, 0) < MASTERY_READY_THRESHOLD
            ],
        })

    recs.sort(key=lambda x: x["priority"], reverse=True)
    return recs[0] if recs else None


def get_learning_path(
    mastery: dict[str, float],
    available_skills: list[str],
    language: str = "en",
    top_n: int = 5,
) -> list[dict]:
    """
    Get recommended learning path: ordered list of next skills to study.

    Returns top N recommendations in priority order.
    """
    available_set = set(available_skills)
    recs = []

    for skill in available_skills:
        p_known = mastery.get(skill, 0.0)
        unlocked = is_unlocked(skill, mastery)
        name = SKILL_NAMES.get(skill, {}).get(language, skill)
        prereqs = PREREQUISITE_GRAPH.get(skill, [])

        if unlocked:
            if p_known < MASTERY_WEAK_THRESHOLD:
                stage = "priority"
                priority = 10.0 - p_known * 10
            elif p_known < 0.80:
                stage = "improving"
                priority = 5.0 - p_known * 5
            else:
                stage = "mastered"
                priority = 0.5
        else:
            stage = "locked"
            prereq_avg = (
                sum(mastery.get(p, 0) for p in prereqs) / len(prereqs)
                if prereqs else 0
            )
            priority = prereq_avg * 1.0

        recs.append({
            "skill": skill,
            "name": name,
            "p_known": round(p_known, 3),
            "mastery_pct": round(p_known * 100),
            "stage": stage,
            "priority": round(priority, 3),
            "unlocked": unlocked,
        })

    recs.sort(key=lambda x: x["priority"], reverse=True)
    return recs[:top_n]
