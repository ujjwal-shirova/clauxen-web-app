import { listAvailableSkills, readSkill } from "@/autonomous-agent/server/skills/skill-catalog";

export async function runReadSkill(skillId: string) {
  const available = await listAvailableSkills();
  const skill = await readSkill(skillId);
  if (!skill) {
    return {
      error: `Skill not found: ${skillId}`,
      available: available.map((s) => ({
        id: s.id,
        description: s.description,
      })),
    };
  }
  return {
    id: skill.id,
    path: skill.path,
    content: skill.content,
  };
}

export async function runListSkills() {
  const skills = await listAvailableSkills();
  return {
    skills: skills.map((s) => ({ id: s.id, description: s.description })),
  };
}
