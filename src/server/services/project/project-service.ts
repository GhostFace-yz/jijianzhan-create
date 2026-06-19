import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import type {
  CreateProjectInput,
  ListProjectsFilters,
  ListProjectsResult,
  ProjectService,
  ProjectServiceOptions,
  UpdateProjectInput,
} from './types.js';

export function createProjectService(options: ProjectServiceOptions = {}): ProjectService {
  const db = options.prisma ?? prisma;

  return {
    async createProject(input) {
      const now = new Date();
      const row = await db.projects.create({
        data: {
          user_id: input.userId ?? 'system',
          team_id: input.teamId ?? null,
          status: 'draft',
          meta: input.meta as unknown as Prisma.InputJsonValue,
          created_at: now,
          updated_at: now,
        },
      });
      return row;
    },

    async listProjects(filters): Promise<ListProjectsResult> {
      const where: Prisma.ProjectWhereInput = {
        user_id: 'system',
      };

      if (filters.status) {
        where.status = filters.status;
      }

      const orderBy: Prisma.ProjectOrderByWithRelationInput =
        filters.sort === 'updated_at_asc'
          ? { updated_at: 'asc' }
          : { updated_at: 'desc' };

      const take = filters.limit ?? 100;
      const skip = filters.offset ?? 0;

      const [total, rows] = await Promise.all([
        db.projects.count({ where }),
        db.projects.findMany({
          where,
          orderBy,
          take,
          skip,
        }),
      ]);

      let projects = rows;
      if (filters.search?.trim()) {
        const keyword = filters.search.trim().toLowerCase();
        projects = projects.filter((project) => {
          const meta = project.meta as { title?: string };
          return meta.title?.toLowerCase().includes(keyword) ?? false;
        });
      }

      return { total, projects };
    },

    async getProject(id) {
      return db.projects.findUnique({
        where: { id },
      });
    },

    async updateProject(id, input) {
      const existing = await db.projects.findUnique({ where: { id } });
      if (!existing) {
        throw new Error('Project not found');
      }

      const data: Prisma.ProjectUpdateInput = {
        updated_at: new Date(),
      };

      if (input.meta) {
        const currentMeta = existing.meta as Record<string, unknown>;
        data.meta = { ...currentMeta, ...input.meta } as unknown as Prisma.InputJsonValue;
      }

      if (input.status) {
        data.status = input.status;
      }

      const row = await db.projects.update({
        where: { id },
        data,
      });

      return row;
    },

    async deleteProject(id) {
      await db.projects.delete({
        where: { id },
      });
    },
  };
}
