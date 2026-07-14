/** Shared work/role options for onboarding + Settings → Profile. */

export const WORK_ROLE_OPTIONS = [
  "Product management",
  "Software engineer",
  "Engineering",
  "Human resources",
  "Finance",
  "Marketing",
  "Sales",
  "Operations",
  "Data science",
  "Design",
  "Scientist",
  "Legal",
  "Student",
  "Founder",
  "Research",
  "Other",
] as const;

export type WorkRoleOption = (typeof WORK_ROLE_OPTIONS)[number];

/** Onboarding role picker uses the same catalog. */
export const ONBOARDING_ROLES = WORK_ROLE_OPTIONS;
