import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createProject } from '../api/projects';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import {
  PROJECT_GENRE_OPTIONS,
  PROJECT_DURATION_GOAL_OPTIONS,
  PROJECT_STYLE_TAG_OPTIONS,
} from '../types';

const styleTagSchema = z.enum([
  'realistic',
  'comic',
  'cyberpunk',
  'chinese_style',
  'fresh',
  'dark',
]);

const createProjectSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(50, '标题最多 50 字'),
  description: z.string().min(1, '创意描述不能为空').max(1000, '创意描述最多 1000 字'),
  genre: z.enum([
    'urban_romance',
    'ancient_costume',
    'suspense',
    'comedy',
    'sci_fi',
    'other',
  ], {
    required_error: '请选择题材',
  }),
  target_episodes: z.coerce
    .number()
    .int('集数必须为整数')
    .min(1, '集数至少为 1')
    .max(100, '集数最多为 100')
    .optional()
    .or(z.literal('')),
  duration_goal: z.enum(['3min', '5min', '10min']).optional(),
  style_tags: z.array(styleTagSchema).default([]),
  notes: z.string().max(2000, '创作备注最多 2000 字').optional(),
});

type CreateProjectFormData = {
  title: string;
  description: string;
  genre:
    | 'urban_romance'
    | 'ancient_costume'
    | 'suspense'
    | 'comedy'
    | 'sci_fi'
    | 'other';
  target_episodes?: number | '';
  duration_goal?: '3min' | '5min' | '10min';
  style_tags?: (
    | 'realistic'
    | 'comic'
    | 'cyberpunk'
    | 'chinese_style'
    | 'fresh'
    | 'dark'
  )[];
  notes?: string;
};

function toProjectMeta(data: CreateProjectFormData) {
  return {
    title: data.title,
    description: data.description,
    genre: data.genre,
    target_episodes:
      typeof data.target_episodes === 'number' ? data.target_episodes : null,
    duration_goal: data.duration_goal ?? null,
    style_tags: data.style_tags ?? [],
    notes:
      data.notes !== undefined && data.notes !== '' ? data.notes : null,
  };
}

export function CreateProjectPage() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: '',
      description: '',
      genre: undefined,
      target_episodes: undefined,
      duration_goal: undefined,
      style_tags: [],
      notes: '',
    },
    mode: 'onChange',
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateProjectFormData) => createProject(toProjectMeta(data)),
    onSuccess: (response) => {
      navigate(`/projects/${response.data.id}`);
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    },
  });

  const title = watch('title');
  const description = watch('description');

  return (
    <div className="min-h-screen bg-surface-soft">
      <header className="border-b border-hairline bg-canvas">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Link to="/">
            <Button variant="ghost" className="gap-2 px-2">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          </Link>
          <h1 className="text-xl font-semibold text-ink">新建项目</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <form
          onSubmit={handleSubmit((data) => {
            setSubmitError(null);
            createMutation.mutate(data);
          })}
          className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm md:p-8"
          noValidate
        >
          <div className="space-y-6">
            <div>
              <label htmlFor="title" className="mb-2 block text-sm font-medium text-ink">
                项目标题 *
              </label>
              <Input
                id="title"
                placeholder="给你的短剧起个名字"
                maxLength={50}
                {...register('title')}
                error={errors.title?.message}
                aria-invalid={errors.title ? 'true' : 'false'}
              />
              <p className="mt-1.5 text-right text-xs text-stone">
                {title?.length ?? 0} / 50
              </p>
            </div>

            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium text-ink">
                创意描述 *
              </label>
              <Textarea
                id="description"
                placeholder="简要描述故事创意、核心冲突和目标观众..."
                maxLength={1000}
                {...register('description')}
                error={errors.description?.message}
                aria-invalid={errors.description ? 'true' : 'false'}
              />
              <p className="mt-1.5 text-right text-xs text-stone">
                {description?.length ?? 0} / 1000
              </p>
            </div>

            <div>
              <label htmlFor="genre" className="mb-2 block text-sm font-medium text-ink">
                题材 *
              </label>
              <Select
                id="genre"
                options={[{ value: '', label: '请选择题材' }, ...PROJECT_GENRE_OPTIONS]}
                {...register('genre')}
                error={errors.genre?.message}
                aria-invalid={errors.genre ? 'true' : 'false'}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="target_episodes" className="mb-2 block text-sm font-medium text-ink">
                  目标集数
                </label>
                <Input
                  id="target_episodes"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="留空让 AI 后续建议"
                  {...register('target_episodes')}
                  error={errors.target_episodes?.message}
                  aria-invalid={errors.target_episodes ? 'true' : 'false'}
                />
              </div>

              <div>
                <label htmlFor="duration_goal" className="mb-2 block text-sm font-medium text-ink">
                  时长目标
                </label>
                <Select
                  id="duration_goal"
                  options={[
                    { value: '', label: '请选择时长目标' },
                    ...PROJECT_DURATION_GOAL_OPTIONS,
                  ]}
                  {...register('duration_goal')}
                  error={errors.duration_goal?.message}
                  aria-invalid={errors.duration_goal ? 'true' : 'false'}
                />
              </div>
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-ink">风格标签</span>
              <div className="flex flex-wrap gap-2">
                {PROJECT_STYLE_TAG_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink transition-colors hover:bg-surface has-[:checked]:border-primary has-[:checked]:bg-card-tint-lavender has-[:checked]:text-primary"
                  >
                    <input
                      type="checkbox"
                      value={option.value}
                      {...register('style_tags')}
                      className="h-4 w-4 accent-primary"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {errors.style_tags ? (
                <p className="mt-1.5 text-sm text-semantic-error">{errors.style_tags.message}</p>
              ) : null}
            </div>

            <div>
              <label htmlFor="notes" className="mb-2 block text-sm font-medium text-ink">
                创作备注
              </label>
              <Textarea
                id="notes"
                placeholder="补充创作方向、参考作品、特殊要求等..."
                maxLength={2000}
                {...register('notes')}
                error={errors.notes?.message}
                aria-invalid={errors.notes ? 'true' : 'false'}
              />
            </div>
          </div>

          {submitError ? (
            <div className="mt-6 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 text-sm text-semantic-error">
              {submitError}
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-end gap-3">
            <Link to="/">
              <Button type="button" variant="secondary">取消</Button>
            </Link>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="min-w-[120px] gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建项目'
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
