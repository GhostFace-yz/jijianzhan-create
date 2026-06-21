import { useParams, Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  Users,
  MapPin,
  Film,
  Sparkles,
  CheckCircle2,
  Circle,
  Clock,
  CalendarDays,
  Tag,
  AlertCircle,
  Loader2,
  Clapperboard,
} from 'lucide-react';
import { getProject } from '../api/projects';
import { getOutline } from '../api/outline';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_GENRE_LABELS,
  PROJECT_DURATION_GOAL_LABELS,
  PROJECT_STYLE_TAG_LABELS,
  type ProjectStatus,
  type Project,
  type OutlineData,
} from '../types';

const STATUS_FLOW: { value: ProjectStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'outlining', label: '大纲' },
  { value: 'asset_prep', label: '资产准备' },
  { value: 'producing', label: '制作中' },
  { value: 'completed', label: '已完成' },
];

const STATUS_DESCRIPTION: Record<ProjectStatus, string> = {
  draft: '项目刚创建，开始生成故事大纲。',
  outlining: '大纲编辑中，确认后可进入资产准备。',
  asset_prep: '准备角色、场景等制作资产。',
  producing: '分集脚本、分镜、音视频制作中。',
  completed: '项目已渲染完成，可查看成片。',
};

function StatusStepper({ status }: { status: ProjectStatus }) {
  const currentIndex = STATUS_FLOW.findIndex((s) => s.value === status);

  return (
    <div className="w-full">
      <div className="relative flex items-center justify-between">
        {STATUS_FLOW.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={step.value} className="relative flex flex-1 flex-col items-center">
              {index < STATUS_FLOW.length - 1 && (
                <div
                  className={`absolute left-1/2 top-3 h-0.5 w-full -translate-y-1/2 ${
                    isCompleted ? 'bg-primary' : 'bg-hairline-soft'
                  }`}
                  aria-hidden="true"
                />
              )}
              <div
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isCompleted || isCurrent
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface text-steel border border-hairline'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium ${
                  isCompleted || isCurrent ? 'text-ink' : 'text-steel'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PrimaryAction({ project }: { project: Project }) {
  const { status, id } = project;

  const actions: Record<ProjectStatus, { label: string; to: string; icon: React.ReactNode }> = {
    draft: { label: '生成大纲', to: `/projects/${id}/outline`, icon: <Sparkles className="h-4 w-4" /> },
    outlining: { label: '编辑大纲', to: `/projects/${id}/outline`, icon: <FileText className="h-4 w-4" /> },
    asset_prep: { label: '准备资产', to: `/projects/${id}/characters`, icon: <Users className="h-4 w-4" /> },
    producing: { label: '分集制作', to: `/projects/${id}/episodes/1/script`, icon: <Clapperboard className="h-4 w-4" /> },
    completed: { label: '查看成片', to: `/projects/${id}/episodes/1/render`, icon: <Film className="h-4 w-4" /> },
  };

  const action = actions[status];

  return (
    <Link to={action.to}>
      <Button className="gap-2">
        {action.icon}
        {action.label}
      </Button>
    </Link>
  );
}

function ModuleCard({
  title,
  description,
  icon,
  to,
  badge,
  disabled = false,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  badge?: React.ReactNode;
  disabled?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card-tint-lavender text-primary">
          {icon}
        </div>
        {badge}
      </div>
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-slate">{description}</p>
      </div>
    </>
  );

  if (disabled) {
    return (
      <div className="rounded-xl border border-hairline bg-canvas p-5 shadow-sm opacity-60">
        {content}
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="group rounded-xl border border-hairline bg-canvas p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      {content}
    </Link>
  );
}

export function ProjectDetailPage() {
  const { id: projectId = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: projectResponse,
    isLoading: projectLoading,
    error: projectError,
  } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });

  const {
    data: outlineResponse,
    isLoading: outlineLoading,
  } = useQuery({
    queryKey: ['outline', projectId],
    queryFn: () => getOutline(projectId),
    enabled: Boolean(projectId),
  });

  const project = projectResponse?.data;
  const outlineData: OutlineData | null = outlineResponse?.data.outline ?? null;
  const outlineLocked = outlineResponse?.data.outline_locked ?? false;

  if (projectLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-soft">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-surface-soft px-6">
        <AlertCircle className="h-12 w-12 text-semantic-error" />
        <p className="text-semantic-error">
          加载失败：{projectError?.message ?? '项目不存在'}
        </p>
        <Link to="/">
          <Button variant="secondary">返回项目列表</Button>
        </Link>
      </div>
    );
  }

  const meta = project.meta;
  const hasOutline = Boolean(outlineData);
  const episodeCount = outlineData?.episode_count ?? 0;

  return (
    <div className="min-h-screen bg-surface-soft">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-sm text-steel hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                返回项目列表
              </Link>
              <div className="mt-2 flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-ink">{meta.title}</h1>
                <Badge variant="purple">{PROJECT_STATUS_LABELS[project.status]}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate">{STATUS_DESCRIPTION[project.status]}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PrimaryAction project={project} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="space-y-6">
          {/* Status workflow */}
          <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
            <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-steel">
              制作流程
            </h2>
            <StatusStepper status={project.status} />
          </section>

          {/* Project metadata */}
          <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-ink">项目信息</h2>
              <span className="text-xs text-stone">
                更新于 {formatDate(project.updated_at)}
              </span>
            </div>

            <p className="mt-3 text-base text-charcoal">{meta.description}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="tag-purple">{PROJECT_GENRE_LABELS[meta.genre]}</Badge>
              {meta.target_episodes ? (
                <Badge variant="tag-green">{meta.target_episodes} 集</Badge>
              ) : null}
              {meta.duration_goal ? (
                <Badge variant="tag-orange">
                  {PROJECT_DURATION_GOAL_LABELS[meta.duration_goal]}
                </Badge>
              ) : null}
              {meta.style_tags.map((tag) => (
                <Badge key={tag} variant="tag-purple">
                  {PROJECT_STYLE_TAG_LABELS[tag]}
                </Badge>
              ))}
            </div>

            {meta.notes ? (
              <div className="mt-5 rounded-lg bg-surface p-4">
                <h3 className="text-sm font-medium text-ink">创作备注</h3>
                <p className="mt-1 text-sm text-slate">{meta.notes}</p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-4 text-sm text-steel">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                创建于 {formatDate(project.created_at)}
              </span>
              {hasOutline ? (
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  {episodeCount} 集大纲
                  {outlineLocked ? ' · 已锁定' : ' · 编辑中'}
                </span>
              ) : null}
            </div>
          </section>

          {/* Module cards */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-ink">功能模块</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ModuleCard
                title="故事大纲"
                description="生成并编辑世界观、角色、场景与分集剧情。"
                icon={<FileText className="h-6 w-6" />}
                to={`/projects/${projectId}/outline`}
                badge={
                  hasOutline ? (
                    outlineLocked ? (
                      <Badge variant="green">已锁定</Badge>
                    ) : (
                      <Badge variant="orange">编辑中</Badge>
                    )
                  ) : (
                    <Badge variant="purple">待生成</Badge>
                  )
                }
              />
              <ModuleCard
                title="角色圣经"
                description="管理角色设定、参考图、三视图与 IP-Adapter。"
                icon={<Users className="h-6 w-6" />}
                to={`/projects/${projectId}/characters`}
              />
              <ModuleCard
                title="场景圣经"
                description="管理场景卡片、基准图、seed 与变体配置。"
                icon={<MapPin className="h-6 w-6" />}
                to={`/projects/${projectId}/locations`}
              />
              <ModuleCard
                title="分集制作"
                description="逐集完成脚本、分镜、配音、音乐、视频与渲染。"
                icon={<Film className="h-6 w-6" />}
                to={
                  hasOutline
                    ? `/projects/${projectId}/episodes/1/script`
                    : `/projects/${projectId}/outline`
                }
                badge={
                  hasOutline ? (
                    <Badge variant="tag-purple">{episodeCount} 集</Badge>
                  ) : (
                    <Badge variant="purple">需先生成大纲</Badge>
                  )
                }
              />
            </div>
          </section>

          {/* Episodes preview */}
          {outlineData ? (
            <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink">分集概览</h2>
                <Link
                  to={`/projects/${projectId}/episodes/1/script`}
                  className="text-sm font-medium text-primary hover:text-primary-pressed"
                >
                  进入第一集 →
                </Link>
              </div>

              <div className="divide-y divide-hairline-soft">
                {outlineData.episodes.slice(0, 5).map((episode) => (
                  <Link
                    key={episode.episode_number}
                    to={`/projects/${projectId}/episodes/${episode.episode_number}/script`}
                    className="group flex items-start gap-4 py-4 transition-colors hover:bg-surface/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card-tint-lavender text-sm font-semibold text-primary">
                      {episode.episode_number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-ink group-hover:text-primary">
                          {episode.title}
                        </h3>
                        <Clock className="h-3.5 w-3.5 text-steel" />
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-slate">
                        {episode.summary}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-steel">
                        <span>{episode.featured_characters.length} 个角色</span>
                        <span>·</span>
                        <span>{episode.featured_locations.length} 个场景</span>
                        <span>·</span>
                        <span>{episode.key_events.length} 个关键事件</span>
                      </div>
                    </div>
                  </Link>                ))}
              </div>

              {outlineData.episodes.length > 5 ? (
                <div className="mt-4 border-t border-hairline-soft pt-4 text-center">
                  <Link
                    to={`/projects/${projectId}/episodes/1/script`}
                    className="text-sm font-medium text-primary hover:text-primary-pressed"
                  >
                    查看全部 {outlineData.episodes.length} 集 →
                  </Link>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="flex flex-col items-center justify-center rounded-xl border border-hairline bg-canvas py-16 text-center shadow-sm">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-tint-lavender">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-ink">还没有大纲</h2>
              <p className="mb-6 mt-2 max-w-md text-slate">
                生成故事大纲后，即可查看分集列表并进入分集制作。
              </p>
              <Link to={`/projects/${projectId}/outline`}>
                <Button className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  生成大纲
                </Button>
              </Link>
            </section>
          )}
        </div>
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
