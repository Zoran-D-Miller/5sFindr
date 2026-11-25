// S6 game labels (migration 0031). Labels only: the organiser says who the
// game is for; nobody is checked at the door.

export type SkillTag = "beginner" | "casual" | "competitive";
export type GroupTag = "womens" | "mixed";

export interface GameLabels {
  skill_tag: SkillTag | null;
  group_tag: GroupTag | null;
  over_30: boolean;
}

export const SKILL_TAGS: { key: SkillTag; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "casual", label: "Casual" },
  { key: "competitive", label: "Competitive" },
];

export const GROUP_TAGS: { key: GroupTag; label: string }[] = [
  { key: "womens", label: "Women’s" },
  { key: "mixed", label: "Mixed" },
];

export function cleanLabels(input: Partial<GameLabels> | null | undefined): GameLabels {
  const skill = SKILL_TAGS.some((s) => s.key === input?.skill_tag) ? (input!.skill_tag as SkillTag) : null;
  const group = GROUP_TAGS.some((g) => g.key === input?.group_tag) ? (input!.group_tag as GroupTag) : null;
  return { skill_tag: skill, group_tag: group, over_30: input?.over_30 === true };
}

/** ["Beginner", "Women’s", "30+"] in a fixed order, for chips and share text. */
export function labelList(l: Partial<GameLabels> | null | undefined): string[] {
  const c = cleanLabels(l);
  return [
    c.skill_tag ? SKILL_TAGS.find((s) => s.key === c.skill_tag)!.label : null,
    c.group_tag ? GROUP_TAGS.find((g) => g.key === c.group_tag)!.label : null,
    c.over_30 ? "30+" : null,
  ].filter((x): x is string => !!x);
}
