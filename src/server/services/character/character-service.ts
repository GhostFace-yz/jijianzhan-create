import { Prisma, RoleType, SnapshotSource } from '@prisma/client';
import { z } from 'zod';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prisma } from '../../lib/db.js';
import { getImageProviderConfig, getTextProviderConfig } from '../../adapters/lib/provider-config.js';
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
import type { OutlineCharacter, OutlineData, OutlineEpisode } from '../outline/types.js';

const NEGATIVE_PROMPT =
  'multiple people, multiple views, character sheet, character turnaround, model sheet, reference sheet, rotation sequence, three views, front and side and back, collage, grid layout, split screen, panels, duplicate figures, mirrored figures, text, labels, arrows, guidelines, watermark, logo, extra limbs, bad anatomy, blurry, low quality';

const VIEWS = ['front', 'side', 'back'] as const;
const EXPRESSIONS = ['happy', 'sad', 'angry', 'surprised'] as const;
const STANDING_SCENES = ['standing_casual', 'standing_formal'] as const;

export function createCharacterService(options: CharacterServiceOptions = {}): CharacterService {
  const db = options.prisma ?? prisma;
  const snapshotService = options.snapshotService;
  const adapterPool = options.adapterPool;
  const storage = options.storage;

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

  async function persistGeneratedImage(
    remoteUrl: string,
    storageKey: string
  ): Promise<string> {
    if (!storage) {
      return remoteUrl;
    }

    const res = await fetch(remoteUrl);
    if (!res.ok) {
      throw new Error(`Failed to download generated image: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'agnes-'));
    const tmpPath = path.join(tmpDir, 'image.png');
    await writeFile(tmpPath, buffer);

    const saved = await storage.save(tmpPath, storageKey);
    return saved.url;
  }

  const aiCharacterDetailSchema = z.object({
    name: z.string().min(1),
    appearance: z.string().max(2000).optional().nullable(),
    costume: z.string().max(2000).optional().nullable(),
    expression: z.string().max(2000).optional().nullable(),
    signature_action: z.string().max(500).optional().nullable(),
    voice_description: z.string().max(500).optional().nullable(),
  });

  function formatEpisodeRange(numbers: number[]): string {
    if (numbers.length === 0) {
      return '';
    }
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? String(start) : `${start}-${end}`);
        start = end = sorted[i];
      }
    }
    ranges.push(start === end ? String(start) : `${start}-${end}`);
    return ranges.join(', ');
  }

  function computeEpisodeRange(name: string, episodes: OutlineEpisode[]): string {
    const numbers = episodes
      .filter((ep) => ep.featured_characters.includes(name))
      .map((ep) => ep.episode_number);
    if (numbers.length === 0) {
      return '';
    }
    return formatEpisodeRange(numbers);
  }

  function buildCharacterBibleSystemPrompt(): string {
    return `You are a professional character designer for Chinese short drama series.
Given the story outline and character list, generate detailed character bible fields.
You MUST respond with ONLY valid JSON — no markdown formatting, no code fences, no explanations.
Return a JSON array where each item has exactly this shape:
{
  "name": "character name exactly as provided",
  "appearance": "detailed physical appearance in Chinese",
  "costume": "clothing and costume plan in Chinese",
  "expression": "facial expression characteristics in Chinese",
  "signature_action": "signature gesture or action in Chinese",
  "voice_description": "voice tone description in Chinese"
}
Do not include role_type or episode_range in the output.`;
  }

  function buildCharacterBiblePrompt(
    meta: Record<string, unknown>,
    outline: OutlineData,
    characters: Array<OutlineCharacter & { episode_range: string }>
  ): string {
    const parts: string[] = [];
    parts.push(`Project: ${meta.title || 'Untitled'}`);
    parts.push(`Genre: ${meta.genre || 'other'}`);
    if (Array.isArray(meta.style_tags) && meta.style_tags.length > 0) {
      parts.push(`Visual style: ${(meta.style_tags as string[]).join(', ')}`);
    }
    parts.push(`\nWorld setting:\n${outline.world_setting}`);
    parts.push(`\nMain conflict:\n${outline.main_conflict}`);

    parts.push(`\nEpisodes:`);
    for (const ep of outline.episodes) {
      parts.push(`Episode ${ep.episode_number}: ${ep.title}`);
      parts.push(`  Summary: ${ep.summary}`);
      parts.push(`  Featured characters: ${ep.featured_characters.join(', ')}`);
    }

    parts.push(`\nCharacters to detail:`);
    for (const c of characters) {
      parts.push(`- ${c.name} (${c.role_type}, appears in episodes ${c.episode_range || 'TBD'})`);
      parts.push(`  Description: ${c.description}`);
    }

    parts.push(`\nGenerate the character bible array now.`);
    return parts.join('\n');
  }

  function parseAIDetails(
    content: string
  ): Array<z.infer<typeof aiCharacterDetailSchema>> | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (fenceMatch) {
        try {
          parsed = JSON.parse(fenceMatch[1].trim());
        } catch {
          return null;
        }
      } else {
        const bracketMatch = content.match(/\[[\s\S]*\]/);
        if (!bracketMatch) {
          return null;
        }
        try {
          parsed = JSON.parse(bracketMatch[0]);
        } catch {
          return null;
        }
      }
    }

    if (!Array.isArray(parsed)) {
      return null;
    }

    const result = z.array(aiCharacterDetailSchema).safeParse(parsed);
    return result.success ? result.data : null;
  }

  function buildViewPrompt(character: Character, view: string): string {
    const angleDesc: Record<string, string> = {
      front:
        'facing the camera, looking straight at the viewer, head to toe visible',
      side:
        'in strict profile, facing to the left, whole body from head to toe visible',
      back:
        'seen from behind, back to the camera, whole body from head to toe visible',
    };

    const parts = [
      `Single illustration of ${character.name}, ${angleDesc[view]}, standing relaxed`,
      'only one person, centered, isolated figure',
      'plain white background',
      character.appearance,
      character.costume ? `wearing ${character.costume}` : '',
      'highly detailed, sharp focus, soft lighting',
    ];
    return parts.filter(Boolean).join('. ');
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
    storageKey: string,
    referenceImages?: string[]
  ): Promise<CharacterRefImage> {
    if (!adapterPool) {
      return {
        view,
        url: `https://mock-cdn.example.com/image/${seed}.png`,
        seed,
      };
    }
    const imageConfig = getImageProviderConfig();
    const adapter = adapterPool.getImage(imageConfig.provider);
    const result = await adapter.generateImage(
      {
        prompt: buildViewPrompt(character, view),
        negativePrompt: NEGATIVE_PROMPT,
        referenceImages,
        seed,
        width: 768,
        height: 1024,
      },
      imageConfig
    );
    const localUrl = await persistGeneratedImage(result.data.url, storageKey);
    return {
      view,
      url: localUrl,
      seed: result.data.seed,
    };
  }

  async function generateImageForRef(
    character: Character,
    view: string,
    detail: string,
    seed: number,
    storageKey: string,
    referenceImages?: string[]
  ): Promise<CharacterRefImage> {
    if (!adapterPool) {
      return {
        view,
        url: `https://mock-cdn.example.com/image/${seed}.png`,
        seed,
      };
    }
    const imageConfig = getImageProviderConfig();
    const adapter = adapterPool.getImage(imageConfig.provider);
    const result = await adapter.generateImage(
      {
        prompt: buildRefPrompt(character, view, detail),
        negativePrompt: NEGATIVE_PROMPT,
        referenceImages,
        seed,
        width: 1024,
        height: 1024,
      },
      imageConfig
    );
    const localUrl = await persistGeneratedImage(result.data.url, storageKey);
    return {
      view,
      url: localUrl,
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

    async syncCharactersFromOutline(projectId: string): Promise<Character[]> {
      await ensureProjectExists(projectId);
      const project = await db.project.findUnique({ where: { id: projectId } });
      const outline = (project?.outline ?? null) as OutlineData | null;
      if (!outline || outline.characters.length === 0) {
        return [];
      }
      const meta = (project?.meta ?? {}) as Record<string, unknown>;

      const enrichedCharacters = outline.characters.map((c) => ({
        ...c,
        episode_range: computeEpisodeRange(c.name, outline.episodes),
      }));

      let aiDetails: Array<z.infer<typeof aiCharacterDetailSchema>> = [];
      if (adapterPool) {
        const prompt = buildCharacterBiblePrompt(meta, outline, enrichedCharacters);
        const systemPrompt = buildCharacterBibleSystemPrompt();
        const textConfig = getTextProviderConfig();
        const adapter = adapterPool.getText(textConfig.provider);
        try {
          const result = await adapter.generateText(prompt, systemPrompt, undefined, textConfig);
          const parsed = parseAIDetails(result.data.content);
          if (parsed) {
            aiDetails = parsed;
          }
        } catch (err) {
          console.error(
            'Character bible AI generation failed:',
            err instanceof Error ? err.message : err
          );
        }
      }

      const created: Character[] = [];
      for (const item of enrichedCharacters) {
        const existing = await db.character.findFirst({
          where: { project_id: projectId, name: item.name },
        });
        if (existing) {
          continue;
        }

        const detail = aiDetails.find((d) => d.name === item.name);
        const data: Prisma.CharacterCreateInput = {
          name: item.name,
          role_type: item.role_type as RoleType,
          project_id: projectId,
          episode_range: item.episode_range,
          appearance: detail?.appearance ?? null,
          costume: detail?.costume ?? null,
          expression: detail?.expression ?? null,
          signature_action: detail?.signature_action ?? null,
          voice_description: detail?.voice_description ?? null,
          status: 'draft',
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

      function viewKey(view: string) {
        return `characters/${projectId}/${charId}/${view}.png`;
      }

      // 三视图作为三个完全独立的任务分别生成，避免参考图导致模型输出拼贴图
      const frontSeed = options.seed ?? hashCode(`${charId}-front`);
      const front = await generateImageForView(character, 'front', frontSeed, viewKey('front'));

      const sideSeed = options.seed ?? hashCode(`${charId}-side`);
      const side = await generateImageForView(character, 'side', sideSeed, viewKey('side'));

      const backSeed = options.seed ?? hashCode(`${charId}-back`);
      const back = await generateImageForView(character, 'back', backSeed, viewKey('back'));

      const generated = [front, side, back];

      const characterUpdated = await db.character.update({
        where: { id: charId },
        data: {
          ref_images: [...refImages, ...generated] as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });
      const imageConfig = getImageProviderConfig();
      await snapshotCharacter(characterUpdated, 'ai_generated', {
        aiModel: {
          provider: imageConfig.provider,
          model: imageConfig.model,
        },
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
      const storageKey = `characters/${projectId}/${charId}/${viewId}-${Date.now()}.png`;
      const regenerated = await generateImageForView(character, viewId, seed, storageKey);
      const nextRefImages = refImages.filter((img) => img.view !== viewId);
      nextRefImages.push(regenerated);

      const characterUpdated = await db.character.update({
        where: { id: charId },
        data: {
          ref_images: nextRefImages as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });
      const retryImageConfig = getImageProviderConfig();
      await snapshotCharacter(characterUpdated, 'ai_regenerated', {
        aiModel: {
          provider: retryImageConfig.provider,
          model: retryImageConfig.model,
        },
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
          const storageKey = `characters/${projectId}/${charId}/expr-${expr}-${Date.now()}.png`;
          return generateImageForRef(
            character,
            `expr_${expr}`,
            `${expr} expression`,
            seed,
            storageKey,
            referenceImages
          );
        })
      );

      const scenes = await Promise.all(
        STANDING_SCENES.map((scene, index) => {
          const seed = hashCode(`${charId}-scene-${scene}`) + index;
          const storageKey = `characters/${projectId}/${charId}/scene-${scene}-${Date.now()}.png`;
          const detail = scene === 'standing_casual' ? 'full body standing casual' : 'full body standing formal';
          return generateImageForRef(character, `scene_${scene}`, detail, seed, storageKey, referenceImages);
        })
      );

      const characterUpdated = await db.character.update({
        where: { id: charId },
        data: {
          ref_images: [...refImages, ...expressions, ...scenes] as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });
      const refsImageConfig = getImageProviderConfig();
      await snapshotCharacter(characterUpdated, 'ai_generated', {
        aiModel: {
          provider: refsImageConfig.provider,
          model: refsImageConfig.model,
        },
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
