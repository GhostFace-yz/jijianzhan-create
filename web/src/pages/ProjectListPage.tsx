import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Plus, Search, Filter, ArrowUpDown, FileText, MapPin, Users } from 'lucide-react';
import { listProjects } from '../api/projects';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import {
  PROJECT_STATUS_OPTIONS,
  PROJECT_STATUS_LABELS,
  PROJECT_GENRE_LABELS,
  type ProjectStatus,
} from '../types';

export function ProjectListPage() {
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'updated_at_desc' | 'updated_at_asc'>('updated_at_desc');

  const filters = {
    status: status === 'all' ? undefined : status,
    search: search.trim() || undefined,
    sort,
    limit: 100,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', filters],
    queryFn: () => listProjects(filters),
  });

  const projects = data?.data.projects ?? [];
  const total = data?.data.total ?? 0;

  return (
    <div className="min-h-screen bg-surface-soft">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-ink">我的项目</h1>
              <p className="mt-1 text-sm text-slate">管理你的短剧创意与制作进度</p>
            </div>
            <Link to="/projects/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                新建项目
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-hairline bg-canvas p-4 shadow-sm md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel" />
            <Input
              placeholder="搜索项目标题..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="搜索项目"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <Filter className="h-4 w-4 shrink-0 text-steel" />
            {[{ value: 'all', label: '全部' }, ...PROJECT_STATUS_OPTIONS].map((option) => (
              <button
                key={option.value}
                onClick={() => setStatus(option.value as ProjectStatus | 'all')}
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

          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-steel" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-11 rounded-md border border-hairline-strong bg-canvas px-4 text-sm text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="排序方式"
            >
              <option value="updated_at_desc">最近更新优先</option>
              <option value="updated_at_asc">最早更新优先</option>
            </select>
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
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-hairline bg-canvas py-20 text-center shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-tint-lavender">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-ink">还没有项目</h2>
            <p className="mb-6 mt-2 max-w-md text-slate">
              创建第一个短剧项目，开始你的 AI 辅助创作之旅。
            </p>
            <Link to="/projects/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                新建项目
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate">共 {total} 个项目</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group relative rounded-xl border border-hairline bg-canvas p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      to={`/projects/${project.id}`}
                      className="relative line-clamp-1 text-lg font-semibold text-ink hover:text-primary after:absolute after:inset-0"
                      aria-label={`查看项目 ${project.meta.title}`}
                    >
                      {project.meta.title}
                    </Link>
                    <Badge variant="purple">{PROJECT_STATUS_LABELS[project.status]}</Badge>
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm text-slate">
                    {project.meta.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="tag-purple">
                      {PROJECT_GENRE_LABELS[project.meta.genre]}
                    </Badge>
                    {project.meta.target_episodes ? (
                      <Badge variant="tag-green">{project.meta.target_episodes} 集</Badge>
                    ) : null}
                    {project.meta.duration_goal ? (
                      <Badge variant="tag-orange">{project.meta.duration_goal}</Badge>
                    ) : null}
                  </div>

                  <div className="relative z-10 mt-4 flex items-center gap-3 border-t border-hairline-soft pt-3">
                    <Link
                      to={`/projects/${project.id}/locations`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-steel hover:text-primary"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      场景圣经
                    </Link>
                    <Link
                      to={`/projects/${project.id}/characters`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-steel hover:text-primary"
                    >
                      <Users className="h-3.5 w-3.5" />
                      角色圣经
                    </Link>
                    <span className="ml-auto text-xs text-steel">{formatDate(project.updated_at)}</span>
                  </div>
                </div>
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
