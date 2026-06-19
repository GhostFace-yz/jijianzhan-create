import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, ArrowLeft, MapPin, RefreshCw } from 'lucide-react';
import { listLocations } from '../../api/locations';
import { getProject } from '../../api/projects';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import {
  LOCATION_STATUS_LABELS,
  LOCATION_STATUS_OPTIONS,
  type LocationStatus,
} from '../../types';

export function LocationListPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const [status, setStatus] = useState<LocationStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const { data: projectResponse } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['locations', projectId],
    queryFn: () => listLocations(projectId),
    enabled: Boolean(projectId),
  });

  const locations = data?.data.locations ?? [];
  const filtered = locations.filter((loc) => {
    const matchesStatus = status === 'all' || loc.status === status;
    const matchesSearch =
      !search.trim() ||
      loc.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const projectTitle = projectResponse?.data.meta.title ?? '项目';

  return (
    <div className="min-h-screen bg-surface-soft">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-sm text-steel hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                返回项目
              </Link>
              <h1 className="mt-1 text-2xl font-semibold text-ink">
                {projectTitle} · 场景圣经
              </h1>
              <p className="mt-1 text-sm text-slate">
                管理场景卡片、基准图与变体配置
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-hairline bg-canvas p-4 shadow-sm md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel" />
            <Input
              placeholder="搜索场景名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="搜索场景"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <Filter className="h-4 w-4 shrink-0 text-steel" />
            {[{ value: 'all', label: '全部' }, ...LOCATION_STATUS_OPTIONS].map((option) => (
              <button
                key={option.value}
                onClick={() => setStatus(option.value as LocationStatus | 'all')}
                className={`
                  shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors
                  ${
                    status === option.value
                      ? 'border-ink-deep bg-ink-deep text-on-dark'
                      : 'border-hairline bg-transparent text-steel hover:bg-surface'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-hairline-strong border-t-primary" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-semantic-error/20 bg-semantic-error/5 p-8 text-center">
            <p className="text-semantic-error">加载失败：{error.message}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-hairline bg-canvas py-20 text-center shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-tint-lavender">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-ink">还没有场景</h2>
            <p className="mb-2 mt-2 max-w-md text-slate">
              确认大纲后，系统会自动根据 locations[] 创建场景卡片。
            </p>
            <p className="text-sm text-stone">
              也可通过场景圣经页面管理基准图和变体配置。
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate">共 {filtered.length} 个场景</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((location) => (
                <Link
                  key={location.id}
                  to={`/projects/${projectId}/locations/${location.id}`}
                  className="group rounded-xl border border-hairline bg-canvas p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card-tint-lavender text-lg font-semibold text-primary">
                        {location.name.slice(0, 1)}
                      </div>
                      <div>
                        <h3 className="line-clamp-1 text-lg font-semibold text-ink group-hover:text-primary">
                          {location.name}
                        </h3>
                        <p className="text-sm text-slate">
                          {location.space_type ?? '未设置'} · {location.frequency ?? '未设置'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={location.status === 'confirmed' ? 'green' : 'purple'}>
                      {LOCATION_STATUS_LABELS[location.status]}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {location.style ? (
                      <Badge variant="tag-purple">{location.style}</Badge>
                    ) : null}
                    {location.color_tone ? (
                      <Badge variant="tag-green">{location.color_tone}</Badge>
                    ) : null}
                    {location.base_image_url ? (
                      <Badge variant="tag-green">有基准图</Badge>
                    ) : null}
                    {Object.keys(location.variants).length > 0 ? (
                      <Badge variant="tag-purple">
                        {Object.keys(location.variants).length} 个变体
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-steel">
                    <span>
                      {location.description
                        ? location.description.slice(0, 30) +
                          (location.description.length > 30 ? '…' : '')
                        : '暂无描述'}
                    </span>
                    <span>{formatDate(location.updated_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
