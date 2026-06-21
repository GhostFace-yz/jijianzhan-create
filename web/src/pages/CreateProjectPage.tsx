import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createProject } from '../api/projects';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { Textarea } from '@/components/shadcn/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select';
import { Label } from '@/components/shadcn/label';
import { Field, FieldError } from '@/components/shadcn/field';
import { Checkbox } from '@/components/shadcn/checkbox';
import { cn } from '@/lib/utils';
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
  genre: z.enum(
    [
      'urban_romance',
      'ancient_costume',
      'suspense',
      'comedy',
      'sci_fi',
      'other',
    ],
    {
      required_error: '请选择题材',
    },
  ),
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
    control,
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
            <Field>
              <Label htmlFor="title">项目标题 *</Label>
              <Controller
                control={control}
                name="title"
                render={({ field }) => (
                  <Input
                    id="title"
                    placeholder="给你的短剧起个名字"
                    maxLength={50}
                    className="h-11 px-4 text-base"
                    aria-invalid={errors.title ? 'true' : 'false'}
                    {...field}
                  />
                )}
              />
              <p className="text-right text-xs text-stone">
                {title?.length ?? 0} / 50
              </p>
              <FieldError
                errors={errors.title?.message ? [errors.title.message] : undefined}
              />
            </Field>

            <Field>
              <Label htmlFor="description">创意描述 *</Label>
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <Textarea
                    id="description"
                    placeholder="简要描述故事创意、核心冲突和目标观众..."
                    maxLength={1000}
                    className="min-h-[120px] px-4 py-3 text-base"
                    aria-invalid={errors.description ? 'true' : 'false'}
                    {...field}
                  />
                )}
              />
              <p className="text-right text-xs text-stone">
                {description?.length ?? 0} / 1000
              </p>
              <FieldError
                errors={
                  errors.description?.message
                    ? [errors.description.message]
                    : undefined
                }
              />
            </Field>

            <Field>
              <Label htmlFor="genre">题材 *</Label>
              <Controller
                control={control}
                name="genre"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="genre"
                      className="h-11 w-full px-4 text-base"
                      aria-invalid={errors.genre ? 'true' : 'false'}
                    >
                      <SelectValue placeholder="请选择题材" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_GENRE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError
                errors={errors.genre?.message ? [errors.genre.message] : undefined}
              />
            </Field>

            <div className="grid gap-6 md:grid-cols-2">
              <Field>
                <Label htmlFor="target_episodes">目标集数</Label>
                <Controller
                  control={control}
                  name="target_episodes"
                  render={({ field }) => (
                    <Input
                      id="target_episodes"
                      type="number"
                      min={1}
                      max={100}
                      placeholder="留空让 AI 后续建议"
                      className="h-11 px-4 text-base"
                      aria-invalid={errors.target_episodes ? 'true' : 'false'}
                      {...field}
                      value={field.value ?? ''}
                    />
                  )}
                />
                <FieldError
                  errors={
                    errors.target_episodes?.message
                      ? [errors.target_episodes.message]
                      : undefined
                  }
                />
              </Field>

              <Field>
                <Label htmlFor="duration_goal">时长目标</Label>
                <Controller
                  control={control}
                  name="duration_goal"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(value) =>
                        field.onChange(value === '' ? undefined : value)
                      }
                    >
                      <SelectTrigger
                        id="duration_goal"
                        className="h-11 w-full px-4 text-base"
                        aria-invalid={errors.duration_goal ? 'true' : 'false'}
                      >
                        <SelectValue placeholder="请选择时长目标" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_DURATION_GOAL_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError
                  errors={
                    errors.duration_goal?.message
                      ? [errors.duration_goal.message]
                      : undefined
                  }
                />
              </Field>
            </div>

            <Field>
              <Label>风格标签</Label>
              <Controller
                control={control}
                name="style_tags"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_STYLE_TAG_OPTIONS.map((option) => {
                      const checked = field.value?.includes(option.value) ?? false;
                      return (
                        <label
                          key={option.value}
                          className={cn(
                            'inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                            checked
                              ? 'border-primary bg-card-tint-lavender text-primary'
                              : 'border-hairline-strong bg-canvas text-ink hover:bg-surface',
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(isChecked) => {
                              const current = field.value ?? [];
                              if (isChecked) {
                                field.onChange([...current, option.value]);
                              } else {
                                field.onChange(
                                  current.filter((v) => v !== option.value),
                                );
                              }
                            }}
                            aria-label={option.label}
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                )}
              />
              <FieldError
                errors={
                  errors.style_tags?.message
                    ? [errors.style_tags.message]
                    : undefined
                }
              />
            </Field>

            <Field>
              <Label htmlFor="notes">创作备注</Label>
              <Controller
                control={control}
                name="notes"
                render={({ field }) => (
                  <Textarea
                    id="notes"
                    placeholder="补充创作方向、参考作品、特殊要求等..."
                    maxLength={2000}
                    className="min-h-[120px] px-4 py-3 text-base"
                    aria-invalid={errors.notes ? 'true' : 'false'}
                    {...field}
                    value={field.value ?? ''}
                  />
                )}
              />
              <FieldError
                errors={errors.notes?.message ? [errors.notes.message] : undefined}
              />
            </Field>
          </div>

          {submitError ? (
            <div className="mt-6 rounded-lg border border-semantic-error/20 bg-semantic-error/5 p-4 text-sm text-semantic-error">
              {submitError}
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-end gap-3">
            <Link to="/">
              <Button type="button" variant="outline">
                取消
              </Button>
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
