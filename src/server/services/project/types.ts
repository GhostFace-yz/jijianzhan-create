import type { Project, ProjectStatus } from '@prisma/client';

export const PROJECT_GENRES = [
  'urban_romance',
  'ancient_costume',
  'suspense',
  'comedy',
  'sci_fi',
  'other',
] as const;

export type ProjectGenre = (typeof PROJECT_GENRES)[number];

export const PROJECT_DURATION_GOALS = ['3min', '5min', '10min'] as const;

export type ProjectDurationGoal = (typeof PROJECT_DURATION_GOALS)[number];

export const PROJECT_STYLE_TAGS = [
  'realistic',
  'comic',
  'cyberpunk',
  'chinese_style',
  'fresh',
  'dark',
] as const;

export type ProjectStyleTag = (typeof PROJECT_STYLE_TAGS)[number];

export interface ProjectMeta {
  title: string;
  description: string;
  genre: ProjectGenre;
  target_episodes?: number | null;
  duration_goal?: ProjectDurationGoal | null;
  style_tags: ProjectStyleTag[];
  notes?: string | null;
}

export interface CreateProjectInput {
  meta: ProjectMeta;
  userId?: string;
  teamId?: string;
}

export interface UpdateProjectInput {
  meta?: Partial<ProjectMeta>;
  status?: ProjectStatus;
}

export interface ListProjectsFilters {
  status?: ProjectStatus;
  search?: string;
  sort?: 'updated_at_asc' | 'updated_at_desc';
  limit?: number;
  offset?: number;
}

export interface ListProjectsResult {
  total: number;
  projects: Project[];
}

export interface ProjectService {
  createProject(input: CreateProjectInput): Promise<Project>;
  listProjects(filters: ListProjectsFilters): Promise<ListProjectsResult>;
  getProject(id: string): Promise<Project | null>;
  updateProject(id: string, input: UpdateProjectInput): Promise<Project>;
  deleteProject(id: string): Promise<void>;
}

export interface ProjectServiceOptions {
  prisma?: typeof import('../../lib/db.js').prisma;
}
