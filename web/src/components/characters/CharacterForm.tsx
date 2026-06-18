import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import { updateCharacter } from '../../api/characters';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import {
  CHARACTER_ROLE_TYPE_OPTIONS,
  CHARACTER_STATUS_OPTIONS,
  type Character,
  type CharacterRoleType,
  type CharacterStatus,
} from '../../types';

const characterFormSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(100, '姓名最多 100 字'),
  role_type: z.enum(['protagonist', 'supporting', 'antagonist']),
  episode_range: z.string().max(50, '登场范围最多 50 字').optional(),
  appearance: z.string().max(2000, '外貌描述最多 2000 字').optional(),
  costume: z.string().max(2000, '服装方案最多 2000 字').optional(),
  expression: z.string().max(2000, '表情特征最多 2000 字').optional(),
  signature_action: z.string().max(500, '标志性动作最多 500 字').optional(),
  voice_description: z.string().max(500, '声线描述最多 500 字').optional(),
  status: z.enum(['draft', 'confirmed']),
});

export type CharacterFormData = z.infer<typeof characterFormSchema>;

interface CharacterFormProps {
  projectId: string;
  character: Character;
  onSaved: (character: Character) => void;
}

export function CharacterForm({ projectId, character, onSaved }: CharacterFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<CharacterFormData>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: {
      name: character.name,
      role_type: character.role_type,
      episode_range: character.episode_range ?? undefined,
      appearance: character.appearance ?? undefined,
      costume: character.costume ?? undefined,
      expression: character.expression ?? undefined,
      signature_action: character.signature_action ?? undefined,
      voice_description: character.voice_description ?? undefined,
      status: character.status,
    },
    mode: 'onChange',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (data: CharacterFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await updateCharacter(projectId, character.id, {
        name: data.name,
        role_type: data.role_type as CharacterRoleType,
        episode_range: data.episode_range || null,
        appearance: data.appearance || null,
        costume: data.costume || null,
        expression: data.expression || null,
        signature_action: data.signature_action || null,
        voice_description: data.voice_description || null,
        status: data.status as CharacterStatus,
      });
      onSaved(response.data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const name = watch('name');
  const appearance = watch('appearance');
  const costume = watch('costume');
  const expression = watch('expression');
  const signatureAction = watch('signature_action');
  const voiceDescription = watch('voice_description');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-ink">
            姓名 *
          </label>
          <Input id="name" {...register('name')} error={errors.name?.message} />
        </div>

        <div>
          <label htmlFor="role_type" className="mb-2 block text-sm font-medium text-ink">
            角色定位 *
          </label>
          <Select
            id="role_type"
            options={CHARACTER_ROLE_TYPE_OPTIONS}
            {...register('role_type')}
            error={errors.role_type?.message}
          />
        </div>
      </div>

      <div>
        <label htmlFor="episode_range" className="mb-2 block text-sm font-medium text-ink">
          登场集数范围
        </label>
        <Input
          id="episode_range"
          placeholder="例如：1-5, 10"
          {...register('episode_range')}
          error={errors.episode_range?.message}
        />
      </div>

      <div>
        <label htmlFor="appearance" className="mb-2 block text-sm font-medium text-ink">
          外貌描述
        </label>
        <Textarea
          id="appearance"
          placeholder="描述角色的发型、五官、身材、神态等..."
          maxLength={2000}
          {...register('appearance')}
          error={errors.appearance?.message}
        />
        <p className="mt-1.5 text-right text-xs text-stone">
          {appearance?.length ?? 0} / 2000
        </p>
      </div>

      <div>
        <label htmlFor="costume" className="mb-2 block text-sm font-medium text-ink">
          服装方案
        </label>
        <Textarea
          id="costume"
          placeholder="描述角色常穿服装的风格、颜色、配饰等..."
          maxLength={2000}
          {...register('costume')}
          error={errors.costume?.message}
        />
        <p className="mt-1.5 text-right text-xs text-stone">
          {costume?.length ?? 0} / 2000
        </p>
      </div>

      <div>
        <label htmlFor="expression" className="mb-2 block text-sm font-medium text-ink">
          表情特征
        </label>
        <Textarea
          id="expression"
          placeholder="描述角色常见的表情、眼神、微表情习惯..."
          maxLength={2000}
          {...register('expression')}
          error={errors.expression?.message}
        />
        <p className="mt-1.5 text-right text-xs text-stone">
          {expression?.length ?? 0} / 2000
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="signature_action" className="mb-2 block text-sm font-medium text-ink">
            标志性动作
          </label>
          <Input
            id="signature_action"
            placeholder="例如：习惯性撩头发"
            maxLength={500}
            {...register('signature_action')}
            error={errors.signature_action?.message}
          />
          <p className="mt-1.5 text-right text-xs text-stone">
            {signatureAction?.length ?? 0} / 500
          </p>
        </div>

        <div>
          <label htmlFor="voice_description" className="mb-2 block text-sm font-medium text-ink">
            声线描述
          </label>
          <Input
            id="voice_description"
            placeholder="例如：清冷、略带沙哑的女声"
            maxLength={500}
            {...register('voice_description')}
            error={errors.voice_description?.message}
          />
          <p className="mt-1.5 text-right text-xs text-stone">
            {voiceDescription?.length ?? 0} / 500
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-hairline bg-surface-soft p-4">
        <span className="mb-2 block text-sm font-medium text-ink">角色状态</span>
        <div className="flex flex-wrap gap-2">
          {CHARACTER_STATUS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink transition-colors hover:bg-surface has-[:checked]:border-primary has-[:checked]:bg-card-tint-lavender has-[:checked]:text-primary"
            >
              <input
                type="radio"
                value={option.value}
                {...register('status')}
                className="h-4 w-4 accent-primary"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {submitError ? (
        <div className="rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 text-sm text-semantic-error">
          {submitError}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="min-w-[120px] gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              保存
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
