/** Ordenação da lista admin (sem dependência de servidor — seguro no client). */
export const PLATFORM_EXPERIENCE_SORT = ["newest", "oldest", "best", "worst"] as const;
export type PlatformExperienceSort = (typeof PLATFORM_EXPERIENCE_SORT)[number];
