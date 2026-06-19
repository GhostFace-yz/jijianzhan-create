import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import { updateLocation } from '../../api/locations';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import {
  LOCATION_STATUS_OPTIONS,
  type Location,
  type LocationStatus,
} from '../../types';

const FREQUENCY_OPTIONS = [
  { value: '高频', label: '高频' },
  { value: '中频', label: '中频' },
  { value: '低频', label: '低频' },
];

const SPACE_TYPE_OPTIONS = [
  { value: '室内', label: '室内' },
  { value: '室外', label: '室外' },
  { value: '半室外', label: '半室外' },
];

const locationFormSchema = z.object({
  name: z.string().min(1, '场景名称不能为空').max(200, '名称最多 200 字'),
  description: z.string().max(5000, '描述最多 5000 字').nullable(),
  frequency: z.string().max(20, '频率最多 20 字').nullable(),
  space_type: z.string().max(20, '空间类型最多 20 字').nullable(),
  style: z.string().max(200, '风格最多 200 字').nullable(),
  color_tone: z.string().max(100, '色调最多 100 字').nullable(),
  lighting_type: z.string().max(200, '光线类型最多 200 字').nullable(),
  key_props: z.string().max(2000, '关键道具最多 2000 字').nullable(),
  status: z.enum(['draft', 'confirmed']),
});

export type LocationFormData = z.infer<typeof locationFormSchema>;

interface LocationFormProps {
  projectId: string;
  location: Location;
  onSaved: (location: Location) => void;
}

export function LocationForm({ projectId, location, onSaved }: LocationFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<LocationFormData>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: location.name,
      description: location.description,
      frequency: location.frequency,
      space_type: location.space_type,
      style: location.style,
      color_tone: location.color_tone,
      lighting_type: location.lighting_type,
      key_props: location.key_props?.join(', ') ?? null,
      status: location.status,
    },
    mode: 'onChange',
  });

  const description = watch('description');
  const keyProps = watch('key_props');

  const onSubmit = async (data: LocationFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await updateLocation(projectId, location.id, {
        name: data.name,
        description: data.description,
        frequency: data.frequency,
        space_type: data.space_type,
        style: data.style,
        color_tone: data.color_tone,
        lighting_type: data.lighting_type,
        key_props: data.key_props
          ? data.key_props.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        status: data.status as LocationStatus,
      });
      onSaved(response.data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-ink">
            场景名称 *
          </label>
          <Input id="name" {...register('name')} error={errors.name?.message} />
        </div>
        <div>
          <label htmlFor="space_type" className="mb-2 block text-sm font-medium text-ink">
            空间类型
          </label>
          <Select
            id="space_type"
            options={SPACE_TYPE_OPTIONS}
            {...register('space_type')}
            error={errors.space_type?.message}
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="mb-2 block text-sm font-medium text-ink">
          场景描述
        </label>
        <Textarea
          id="description"
          placeholder="描述场景的空间布局、装饰风格、氛围..."
          maxLength={5000}
          {...register('description')}
          error={errors.description?.message}
        />
        <p className="mt-1.5 text-right text-xs text-stone">
          {description?.length ?? 0} / 5000
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <label htmlFor="frequency" className="mb-2 block text-sm font-medium text-ink">
            出现频率
          </label>
          <Select
            id="frequency"
            options={FREQUENCY_OPTIONS}
            {...register('frequency')}
            error={errors.frequency?.message}
          />
        </div>
        <div>
          <label htmlFor="style" className="mb-2 block text-sm font-medium text-ink">
            整体风格
          </label>
          <Input
            id="style"
            placeholder="例如：现代简约、中式古典"
            {...register('style')}
            error={errors.style?.message}
          />
        </div>
        <div>
          <label htmlFor="color_tone" className="mb-2 block text-sm font-medium text-ink">
            主色调
          </label>
          <Input
            id="color_tone"
            placeholder="例如：暖灰、冷白"
            {...register('color_tone')}
            error={errors.color_tone?.message}
          />
        </div>
      </div>

      <div>
        <label htmlFor="lighting_type" className="mb-2 block text-sm font-medium text-ink">
          光线类型
        </label>
        <Input
          id="lighting_type"
          placeholder="例如：自然光、夜景灯光、暖色吊灯"
          {...register('lighting_type')}
          error={errors.lighting_type?.message}
        />
      </div>

      <div>
        <label htmlFor="key_props" className="mb-2 block text-sm font-medium text-ink">
          关键道具
        </label>
        <Textarea
          id="key_props"
          placeholder="用逗号分隔，例如：沙发, 落地灯, 书架, 咖啡桌"
          maxLength={2000}
          {...register('key_props')}
          error={errors.key_props?.message}
        />
        <p className="mt-1.5 text-xs text-stone">
          用逗号分隔多个道具 · {keyProps?.length ?? 0} / 2000
        </p>
      </div>

      <div className="rounded-lg border border-hairline bg-surface-soft p-4">
        <span className="mb-2 block text-sm font-medium text-ink">场景状态</span>
        <div className="flex flex-wrap gap-2">
          {LOCATION_STATUS_OPTIONS.map((option) => (
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
