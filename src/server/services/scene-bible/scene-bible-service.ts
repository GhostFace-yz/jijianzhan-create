import { Prisma, SnapshotSource } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import type { AIModelInfo, SnapshotService } from '../snapshot/types.js';
import type {
  BaseCandidate,
  ConfirmVariantInput,
  CreateLocationInput,
  GenerateBaseCandidatesOptions,
  GenerateVariantInput,
  Location,
  LocationListResult,
  LocationVariants,
  SceneBibleService,
  SceneBibleServiceOptions,
  SceneVariant,
  UpdateLocationInput,
  VariantResult,
} from './types.js';
import { LOCATION_STATUSES } from './types.js';

const NEGATIVE_PROMPT =
  'people, humans, characters, blurry, bad quality, distorted';

const AI_MODEL_INFO: AIModelInfo = {
  provider: 'mock-image',
  model: 'mock-model',
};

export function createSceneBibleService(
  options: SceneBibleServiceOptions = {}
): SceneBibleService {
  const db = options.prisma ?? prisma;
  const snapshotService = options.snapshotService;
  const adapterPool = options.adapterPool;

  function parseKeyProps(location: Location): string[] {
    const value = location.key_props;
    if (Array.isArray(value)) {
      return value as string[];
    }
    return [];
  }

  function parseVariants(location: Location): LocationVariants {
    const value = location.variants;
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      return value as unknown as LocationVariants;
    }
    return {};
  }

  function toSnapshotContent(location: Location): Record<string, unknown> {
    return {
      id: location.id,
      project_id: location.project_id,
      name: location.name,
      description: location.description,
      frequency: location.frequency,
      space_type: location.space_type,
      style: location.style,
      color_tone: location.color_tone,
      lighting_type: location.lighting_type,
      key_props: parseKeyProps(location),
      status: location.status,
      base_seed: location.base_seed,
      base_image_url: location.base_image_url,
      variants: parseVariants(location),
      created_at: location.created_at.toISOString(),
      updated_at: location.updated_at.toISOString(),
    };
  }

  async function snapshotLocation(
    location: Location,
    source: SnapshotSource,
    extras?: { aiModel?: AIModelInfo; promptOverride?: string }
  ): Promise<void> {
    if (!snapshotService) {
      return;
    }
    await snapshotService.createSnapshot({
      entity: {
        projectId: location.project_id,
        entityType: 'location',
        entityId: location.id,
      },
      source,
      content: toSnapshotContent(location),
      aiModel: extras?.aiModel,
      promptOverride: extras?.promptOverride,
    });
  }

  async function ensureProjectExists(projectId: string): Promise<void> {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new Error('Project not found');
    }
  }

  async function ensureLocation(projectId: string, locId: string): Promise<Location> {
    const location = await db.location.findUnique({ where: { id: locId } });
    if (!location || location.project_id !== projectId) {
      throw new Error('Location not found');
    }
    return location;
  }

  function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      hash = (hash << 5) - hash + code;
      hash |= 0;
    }
    return Math.abs(hash) % 2_147_483_647;
  }

  function variantOffset(key: string): number {
    return hashCode(key) % 1_000_000;
  }

  function buildBasePrompt(location: Location): string {
    const parts = [
      location.description,
      location.lighting_type,
      location.style,
      'no people, no characters, empty room',
      'architectural photography',
    ];
    return parts.filter(Boolean).join(', ');
  }

  function buildVariantPrompt(
    location: Location,
    timeOfDay: string,
    weather: string
  ): string {
    const base = buildBasePrompt(location);
    const envParts = [timeOfDay, weather].filter(Boolean).join(', ');
    return envParts ? `${base}, ${envParts}` : base;
  }

  async function generateImage(
    prompt: string,
    seed: number
  ): Promise<{ url: string; seed: number }> {
    if (!adapterPool) {
      return {
        url: `https://mock-cdn.example.com/image/${seed}.png`,
        seed,
      };
    }
    const adapter = adapterPool.getImage('mock-image');
    const result = await adapter.generateImage(
      {
        prompt,
        negativePrompt: NEGATIVE_PROMPT,
        seed,
        width: 1024,
        height: 1024,
      },
      AI_MODEL_INFO
    );
    return {
      url: result.data.url,
      seed: result.data.seed,
    };
  }

  function normalizeInput(
    input: CreateLocationInput | UpdateLocationInput
  ): Prisma.LocationCreateInput {
    return {
      name: input.name ?? '',
      project_id: '',
      description: input.description ?? null,
      frequency: input.frequency ?? null,
      space_type: input.space_type ?? null,
      style: input.style ?? null,
      color_tone: input.color_tone ?? null,
      lighting_type: input.lighting_type ?? null,
      key_props: [] as unknown as Prisma.InputJsonValue,
      status: input.status ?? 'draft',
    };
  }

  return {
    async syncScenesFromOutline(projectId: string): Promise<Location[]> {
      await ensureProjectExists(projectId);
      const project = await db.project.findUnique({ where: { id: projectId } });
      const meta = (project?.meta ?? {}) as Record<string, unknown>;
      const rawLocations = meta.locations;

      const outlineLocations: Array<{ name: string; description?: string | null }> = [];
      if (Array.isArray(rawLocations)) {
        for (const item of rawLocations) {
          if (typeof item === 'string') {
            outlineLocations.push({ name: item });
          } else if (
            typeof item === 'object' &&
            item !== null &&
            typeof (item as Record<string, unknown>).name === 'string'
          ) {
            const record = item as Record<string, unknown>;
            outlineLocations.push({
              name: record.name as string,
              description:
                typeof record.description === 'string'
                  ? record.description
                  : null,
            });
          }
        }
      }

      const results: Location[] = [];
      for (const item of outlineLocations) {
        const existing = await db.location.findFirst({
          where: { project_id: projectId, name: item.name },
        });

        let location: Location;
        if (existing) {
          location = await db.location.update({
            where: { id: existing.id },
            data: {
              description: item.description ?? existing.description,
              updated_at: new Date(),
            },
          });
        } else {
          const data: Prisma.LocationCreateInput = {
            ...normalizeInput(item),
            project_id: projectId,
          };
          location = await db.location.create({ data });
        }

        await snapshotLocation(location, 'ai_generated');
        results.push(location);
      }

      return results;
    },

    async listScenes(projectId: string): Promise<LocationListResult> {
      await ensureProjectExists(projectId);
      const where: Prisma.LocationWhereInput = { project_id: projectId };
      const [total, locations] = await Promise.all([
        db.location.count({ where }),
        db.location.findMany({
          where,
          orderBy: { updated_at: 'desc' },
        }),
      ]);
      return { total, locations };
    },

    async getScene(projectId: string, locId: string): Promise<Location | null> {
      await ensureProjectExists(projectId);
      const location = await db.location.findUnique({ where: { id: locId } });
      if (!location || location.project_id !== projectId) {
        return null;
      }
      return location;
    },

    async createScene(projectId: string, input: CreateLocationInput): Promise<Location> {
      await ensureProjectExists(projectId);
      const data: Prisma.LocationCreateInput = {
        ...normalizeInput(input),
        project_id: projectId,
        key_props: (input.key_props ?? []) as unknown as Prisma.InputJsonValue,
      };
      const location = await db.location.create({ data });
      await snapshotLocation(location, 'user_edited');
      return location;
    },

    async updateScene(
      projectId: string,
      locId: string,
      input: UpdateLocationInput
    ): Promise<Location> {
      await ensureProjectExists(projectId);
      await ensureLocation(projectId, locId);

      const data: Prisma.LocationUpdateInput = {
        updated_at: new Date(),
      };
      if (input.name !== undefined) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;
      if (input.frequency !== undefined) data.frequency = input.frequency;
      if (input.space_type !== undefined) data.space_type = input.space_type;
      if (input.style !== undefined) data.style = input.style;
      if (input.color_tone !== undefined) data.color_tone = input.color_tone;
      if (input.lighting_type !== undefined) data.lighting_type = input.lighting_type;
      if (input.key_props !== undefined) {
        data.key_props = input.key_props as unknown as Prisma.InputJsonValue;
      }
      if (input.status !== undefined) data.status = input.status;

      const location = await db.location.update({ where: { id: locId }, data });
      await snapshotLocation(location, 'user_edited');
      return location;
    },

    async generateBaseCandidates(
      projectId: string,
      locId: string,
      options: GenerateBaseCandidatesOptions = {}
    ): Promise<BaseCandidate[]> {
      const location = await ensureLocation(projectId, locId);
      const prompt = buildBasePrompt(location);

      const baseSeed = options.seed ?? hashCode(`${locId}-base`);
      const seeds = [baseSeed, baseSeed + 1, baseSeed + 2];

      const candidates = await Promise.all(
        seeds.map(async (seed) => {
          const result = await generateImage(prompt, seed);
          return {
            url: result.url,
            seed: result.seed,
            prompt,
          };
        })
      );

      return candidates;
    },

    async confirmBase(
      projectId: string,
      locId: string,
      candidate: BaseCandidate
    ): Promise<Location> {
      await ensureProjectExists(projectId);
      await ensureLocation(projectId, locId);

      const location = await db.location.update({
        where: { id: locId },
        data: {
          base_seed: candidate.seed,
          base_image_url: candidate.url,
          updated_at: new Date(),
        },
      });
      await snapshotLocation(location, 'ai_generated', {
        aiModel: AI_MODEL_INFO,
        promptOverride: candidate.prompt,
      });
      return location;
    },

    async generateVariant(
      projectId: string,
      locId: string,
      input: GenerateVariantInput
    ): Promise<VariantResult> {
      const location = await ensureLocation(projectId, locId);
      if (location.base_seed === null || location.base_seed === undefined) {
        throw new Error('Base image not confirmed');
      }

      const variantKey = `${input.time_of_day}-${input.weather}`;
      const seed = location.base_seed + variantOffset(variantKey);
      const prompt = buildVariantPrompt(
        location,
        input.time_of_day,
        input.weather
      );

      const result = await generateImage(prompt, seed);
      return {
        url: result.url,
        seed: result.seed,
        prompt,
      };
    },

    async confirmVariant(
      projectId: string,
      locId: string,
      input: ConfirmVariantInput
    ): Promise<Location> {
      await ensureProjectExists(projectId);
      const location = await ensureLocation(projectId, locId);

      const variantKey = `${input.time_of_day}-${input.weather}`;
      const existingVariants = parseVariants(location);
      const nextVariants: LocationVariants = {
        ...existingVariants,
        [variantKey]: {
          image_url: input.variant.url,
          prompt: input.variant.prompt,
          seed: input.variant.seed,
        } as SceneVariant,
      };

      const updated = await db.location.update({
        where: { id: locId },
        data: {
          variants: nextVariants as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });
      await snapshotLocation(updated, 'ai_generated', {
        aiModel: AI_MODEL_INFO,
        promptOverride: input.variant.prompt,
      });
      return updated;
    },

    async getSceneHistory(projectId: string, locId: string) {
      if (!snapshotService) {
        throw new Error('Snapshot service not configured');
      }
      await ensureProjectExists(projectId);
      await ensureLocation(projectId, locId);

      return snapshotService.getHistory({
        projectId,
        entityType: 'location',
        entityId: locId,
      });
    },

    async rollbackScene(
      projectId: string,
      locId: string,
      versionId: string
    ): Promise<Location> {
      if (!snapshotService) {
        throw new Error('Snapshot service not configured');
      }
      await ensureProjectExists(projectId);
      await ensureLocation(projectId, locId);

      const rolledBack = await snapshotService.rollback({
        entity: {
          projectId,
          entityType: 'location',
          entityId: locId,
        },
        versionId,
      });

      const content = rolledBack.content as Record<string, unknown>;
      const data: Prisma.LocationUpdateInput = {
        name: typeof content.name === 'string' ? content.name : undefined,
        description:
          typeof content.description === 'string' ? content.description : null,
        frequency:
          typeof content.frequency === 'string' ? content.frequency : null,
        space_type:
          typeof content.space_type === 'string' ? content.space_type : null,
        style: typeof content.style === 'string' ? content.style : null,
        color_tone:
          typeof content.color_tone === 'string' ? content.color_tone : null,
        lighting_type:
          typeof content.lighting_type === 'string'
            ? content.lighting_type
            : null,
        key_props: Array.isArray(content.key_props)
          ? (content.key_props as unknown as Prisma.InputJsonValue)
          : undefined,
        status: LOCATION_STATUSES.includes(content.status as never)
          ? (content.status as never)
          : undefined,
        base_seed:
          typeof content.base_seed === 'number' ? content.base_seed : null,
        base_image_url:
          typeof content.base_image_url === 'string'
            ? content.base_image_url
            : null,
        variants:
          typeof content.variants === 'object' && content.variants !== null
            ? (content.variants as unknown as Prisma.InputJsonValue)
            : undefined,
        updated_at: new Date(),
      };

      const location = await db.location.update({ where: { id: locId }, data });
      return location;
    },
  };
}
