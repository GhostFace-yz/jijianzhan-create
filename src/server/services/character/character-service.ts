import { Prisma, SnapshotSource } from '@prisma/client';
import { prisma } from '../../lib/db.js';
import type { AIModelInfo, SnapshotService } from '../snapshot/types.js';
import type {
  Character,
  CharacterRefImage,
  CharacterService,
  CharacterServiceOptions,
  CreateCharacterInput,
  GenerateViewsOptions,
  OutlineCharacterInput,
  UpdateCharacterInput,
} from './types.js';
import { CHARACTER_STATUSES, ROLE_TYPES } from './types.js';

const NEGATIVE_PROMPT =
  'multiple people, extra limbs, bad anatomy, blurry, watermark, text, logo, nsfw';

const VIEWS = ['front', 'side', 'back'] as const;
const EXPRESSIONS = ['happy', 'sad', 'angry', 'surprised'] as const;
const STANDING_SCENES = ['standing_casual', 'standing_formal'] as const;

export function createCharacterService(options: CharacterServiceOptions = {}): CharacterService {
  const db = options.prisma ?? prisma;
  const snapshotService = options.snapshotService;
  const adapterPool = options.adapterPool;

  function parseRefImages(character: Character): CharacterRefImage[] {
    const value = character.ref_images;
    if (Array.isArray(value)) {
      return (value as unknown) as CharacterRefImage[];
    }
    return [];
  }

  function toSnapshotContent(character: Character): Record<string, unknown> {
    return {
      id: character.id,
      project_id: character.project_id,
      name: character.name,
      role_type: character.role_type,
      episode_range: character.episode_range,
      appearance: character.appearance,
      costume: character.costume,
      expression: character.expression,
      signature_action: character.signature_action,
      voice_description: character.voice_description,
      status: character.status,
      ref_images: parseRefImages(character),
      ip_adapter_id: character.ip_adapter_id,
      lora_path: character.lora_path,
      created_at: character.created_at.toISOString(),
      updated_at: character.updated_at.toISOString(),
    };
  }

  async function snapshotCharacter(
    character: Character,
    source: SnapshotSource,
    extras?: { editedBy?: string; aiModel?: AIModelInfo; promptOverride?: string }
  ): Promise<void> {
    if (!snapshotService) {
      return;
    }
    await snapshotService.createSnapshot({
      entity: {
        projectId: character.project_id,
        entityType: 'character',
        entityId: character.id,
      },
      source,
      content: toSnapshotContent(character),
      editedBy: extras?.editedBy,
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

  async function ensureCharacter(projectId: string, charId: string): Promise<Character> {
    const character = await db.character.findUnique({ where: { id: charId } });
    if (!character || character.project_id !== projectId) {
      throw new Error('Character not found');
    }
    return character;
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

  function buildViewPrompt(character: Character, view: string): string {
    const parts = [
      'Character design',
      `${view} view`,
      character.name,
      character.appearance,
      character.costume ? `wearing ${character.costume}` : '',
      character.expression,
      character.signature_action,
    ];
    return parts.filter(Boolean).join(', ');
  }

  function buildRefPrompt(character: Character, kind: string, detail: string): string {
    const parts = [
      character.name,
      detail,
      character.appearance,
      character.costume ? `wearing ${character.costume}` : '',
    ];
    return parts.filter(Boolean).join(', ');
  }

  async function generateImageForView(
    character: Character,
    view: string,
    seed: number,
    referenceImages?: string[]
  ): Promise<CharacterRefImage> {
    if (!adapterPool) {
      return {
        view,
        url: `https://mock-cdn.example.com/image/${seed}.png`,
        seed,
      };
    }
    const adapter = adapterPool.getImage('mock-image');
    const result = await adapter.generateImage(
      {
        prompt: buildViewPrompt(character, view),
        negativePrompt: NEGATIVE_PROMPT,
        referenceImages,
        seed,
        width: 1024,
        height: 1024,
      },
      { provider: 'mock-image', model: 'mock-model' }
    );
    return {
      view,
      url: result.data.url,
      seed: result.data.seed,
    };
  }

  async function generateImageForRef(
    character: Character,
    view: string,
    detail: string,
    seed: number,
    referenceImages?: string[]
  ): Promise<CharacterRefImage> {
    if (!adapterPool) {
      return {
        view,
        url: `https://mock-cdn.example.com/image/${seed}.png`,
        seed,
      };
    }
    const adapter = adapterPool.getImage('mock-image');
    const result = await adapter.generateImage(
      {
        prompt: buildRefPrompt(character, view, detail),
        negativePrompt: NEGATIVE_PROMPT,
        referenceImages,
        seed,
        width: 1024,
        height: 1024,
      },
      { provider: 'mock-image', model: 'mock-model' }
    );
    return {
      view,
      url: result.data.url,
      seed: result.data.seed,
    };
  }

  function normalizeInput(input: CreateCharacterInput | UpdateCharacterInput): Prisma.CharacterCreateInput {
    return {
      name: input.name ?? '',
      role_type: input.role_type ?? 'supporting',
      project_id: '', // overridden at call site
      episode_range: input.episode_range ?? null,
      appearance: input.appearance ?? null,
      costume: input.costume ?? null,
      expression: input.expression ?? null,
      signature_action: input.signature_action ?? null,
      voice_description: input.voice_description ?? null,
      status: input.status ?? 'draft',
      ref_images: [] as unknown as Prisma.InputJsonValue,
    };
  }

  return {
    async listCharacters(projectId: string) {
      await ensureProjectExists(projectId);
      const where: Prisma.CharacterWhereInput = { project_id: projectId };
      const [total, characters] = await Promise.all([
        db.character.count({ where }),
        db.character.findMany({
          where,
          orderBy: { updated_at: 'desc' },
        }),
      ]);
      return { total, characters };
    },

    async createCharacter(projectId: string, input: CreateCharacterInput) {
      await ensureProjectExists(projectId);
      const data: Prisma.CharacterCreateInput = {
        ...normalizeInput(input),
        project_id: projectId,
        ref_images: [] as unknown as Prisma.InputJsonValue,
      };
      const character = await db.character.create({ data });
      await snapshotCharacter(character, 'user_edited');
      return character;
    },

    async getCharacter(projectId: string, charId: string) {
      await ensureProjectExists(projectId);
      const character = await db.character.findUnique({ where: { id: charId } });
      if (!character || character.project_id !== projectId) {
        return null;
      }
      return character;
    },

    async updateCharacter(projectId: string, charId: string, input: UpdateCharacterInput) {
      await ensureProjectExists(projectId);
      const existing = await ensureCharacter(projectId, charId);
      const data: Prisma.CharacterUpdateInput = {
        updated_at: new Date(),
      };
      if (input.name !== undefined) data.name = input.name;
      if (input.role_type !== undefined) data.role_type = input.role_type;
      if (input.episode_range !== undefined) data.episode_range = input.episode_range;
      if (input.appearance !== undefined) data.appearance = input.appearance;
      if (input.costume !== undefined) data.costume = input.costume;
      if (input.expression !== undefined) data.expression = input.expression;
      if (input.signature_action !== undefined) data.signature_action = input.signature_action;
      if (input.voice_description !== undefined) data.voice_description = input.voice_description;
      if (input.status !== undefined) data.status = input.status;

      const character = await db.character.update({ where: { id: charId }, data });
      await snapshotCharacter(character, 'user_edited');
      return character;
    },

    async deleteCharacter(projectId: string, charId: string) {
      await ensureProjectExists(projectId);
      await ensureCharacter(projectId, charId);
      if (snapshotService) {
        await db.versionSnapshot.deleteMany({
          where: {
            project_id: projectId,
            entity_type: 'character',
            entity_id: charId,
          },
        });
        await db.versionCounter.deleteMany({
          where: {
            project_id: projectId,
            entity_type: 'character',
            entity_id: charId,
          },
        });
      }
      await db.character.delete({ where: { id: charId } });
    },

    async autoCreateCharacters(projectId: string, outlineCharacters: OutlineCharacterInput[]) {
      await ensureProjectExists(projectId);
      const created: Character[] = [];
      for (const item of outlineCharacters) {
        const data: Prisma.CharacterCreateInput = {
          ...normalizeInput(item),
          project_id: projectId,
          ref_images: [] as unknown as Prisma.InputJsonValue,
        };
        const character = await db.character.create({ data });
        await snapshotCharacter(character, 'ai_generated');
        created.push(character);
      }
      return created;
    },

    async generateViews(projectId: string, charId: string, options: GenerateViewsOptions = {}) {
      const character = await ensureCharacter(projectId, charId);
      const refImages = parseRefImages(character).filter(
        (img) => !VIEWS.includes(img.view as (typeof VIEWS)[number])
      );

      const generated = await Promise.all(
        VIEWS.map((view) => {
          const seed = options.seed ?? hashCode(`${charId}-${view}`);
          return generateImageForView(character, view, seed);
        })
      );

      const characterUpdated = await db.character.update({
        where: { id: charId },
        data: {
          ref_images: [...refImages, ...generated] as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });
      await snapshotCharacter(characterUpdated, 'ai_generated', {
        aiModel: { provider: 'mock-image', model: 'mock-model' },
      });
      return characterUpdated;
    },

    async retryView(projectId: string, charId: string, viewId: string) {
      const character = await ensureCharacter(projectId, charId);
      const refImages = parseRefImages(character);
      if (!VIEWS.includes(viewId as (typeof VIEWS)[number])) {
        throw new Error('Invalid view id');
      }
      const seed = Date.now() + hashCode(`${charId}-${viewId}`);
      const regenerated = await generateImageForView(character, viewId, seed);
      const nextRefImages = refImages.filter((img) => img.view !== viewId);
      nextRefImages.push(regenerated);

      const characterUpdated = await db.character.update({
        where: { id: charId },
        data: {
          ref_images: nextRefImages as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });
      await snapshotCharacter(characterUpdated, 'ai_regenerated', {
        aiModel: { provider: 'mock-image', model: 'mock-model' },
      });
      return characterUpdated;
    },

    async confirmViews(projectId: string, charId: string) {
      const character = await ensureCharacter(projectId, charId);
      const refImages = parseRefImages(character);
      const missing = VIEWS.filter(
        (view) => !refImages.some((img) => img.view === view)
      );
      if (missing.length > 0) {
        throw new Error(`Missing views: ${missing.join(', ')}`);
      }

      const confirmed = await db.character.update({
        where: { id: charId },
        data: {
          status: 'confirmed',
          ip_adapter_id: `ipadapter-${charId}`,
          updated_at: new Date(),
        },
      });
      await snapshotCharacter(confirmed, 'locked');
      return this.generateRefs(projectId, charId);
    },

    async generateRefs(projectId: string, charId: string) {
      const character = await ensureCharacter(projectId, charId);
      const refImages = parseRefImages(character);
      const frontView = refImages.find((img) => img.view === 'front');
      const referenceImages = frontView ? [frontView.url] : undefined;

      const expressions = await Promise.all(
        EXPRESSIONS.map((expr, index) => {
          const seed = hashCode(`${charId}-expr-${expr}`) + index;
          return generateImageForRef(
            character,
            `expr_${expr}`,
            `${expr} expression`,
            seed,
            referenceImages
          );
        })
      );

      const scenes = await Promise.all(
        STANDING_SCENES.map((scene, index) => {
          const seed = hashCode(`${charId}-scene-${scene}`) + index;
          const detail = scene === 'standing_casual' ? 'full body standing casual' : 'full body standing formal';
          return generateImageForRef(character, `scene_${scene}`, detail, seed, referenceImages);
        })
      );

      const characterUpdated = await db.character.update({
        where: { id: charId },
        data: {
          ref_images: [...refImages, ...expressions, ...scenes] as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });
      await snapshotCharacter(characterUpdated, 'ai_generated', {
        aiModel: { provider: 'mock-image', model: 'mock-model' },
      });
      return characterUpdated;
    },

    async rollbackCharacter(projectId: string, charId: string, versionId: string) {
      if (!snapshotService) {
        throw new Error('Snapshot service not configured');
      }
      await ensureProjectExists(projectId);
      await ensureCharacter(projectId, charId);

      const rolledBack = await snapshotService.rollback({
        entity: {
          projectId,
          entityType: 'character',
          entityId: charId,
        },
        versionId,
      });

      const content = rolledBack.content as Record<string, unknown>;
      const data: Prisma.CharacterUpdateInput = {
        name: typeof content.name === 'string' ? content.name : undefined,
        role_type: ROLE_TYPES.includes(content.role_type as never) ? (content.role_type as never) : undefined,
        episode_range: typeof content.episode_range === 'string' ? content.episode_range : null,
        appearance: typeof content.appearance === 'string' ? content.appearance : null,
        costume: typeof content.costume === 'string' ? content.costume : null,
        expression: typeof content.expression === 'string' ? content.expression : null,
        signature_action: typeof content.signature_action === 'string' ? content.signature_action : null,
        voice_description: typeof content.voice_description === 'string' ? content.voice_description : null,
        status: CHARACTER_STATUSES.includes(content.status as never) ? (content.status as never) : undefined,
        ref_images: Array.isArray(content.ref_images)
          ? (content.ref_images as unknown as Prisma.InputJsonValue)
          : undefined,
        ip_adapter_id: typeof content.ip_adapter_id === 'string' ? content.ip_adapter_id : null,
        lora_path: typeof content.lora_path === 'string' ? content.lora_path : null,
        updated_at: new Date(),
      };

      const character = await db.character.update({ where: { id: charId }, data });
      return character;
    },
  };
}
