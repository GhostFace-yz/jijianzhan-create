import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, ArrowLeft, Users, RefreshCw } from 'lucide-react';
import { listCharacters, createCharacter, syncCharactersFromOutline } from '../../api/characters';
import { getProject } from '../../api/projects';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import {
  CHARACTER_ROLE_TYPE_LABELS,
  CHARACTER_STATUS_LABELS,
  CHARACTER_STATUS_OPTIONS,
  CHARACTER_ROLE_TYPE_OPTIONS,
  type CharacterStatus,
  type CharacterRoleType,
} from '../../types';

export function CharacterListPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CharacterStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data: projectResponse } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['characters', projectId],
    queryFn: () => listCharacters(projectId),
    enabled: Boolean(projectId),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncCharactersFromOutline(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
    },
  });

  const characters = data?.data.characters ?? [];
  const filtered = characters.filter((c) => {
    const matchesStatus = status === 'all' || c.status === status;
    const matchesSearch = c.name.toLowerCase().includes(search.trim().toLowerCase());
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
              <h1 className="mt-1 text-2xl font-semibold text-ink">{projectTitle} · 角色圣经</h1>
              <p className="mt-1 text-sm text-slate">管理角色卡片、三视图与参考图集</p>
            </div>
            <Button className="gap-2" onClick={() => setIsCreating((v) => !v)}>
              <Plus className="h-4 w-4" />
              {isCreating ? '取消创建' : '手动创建角色'}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {isCreating ? (
          <CreateCharacterCard
            projectId={projectId}
            onCreated={() => {
              setIsCreating(false);
              void refetch();
            }}
            onCancel={() => setIsCreating(false)}
          />
        ) : null}

        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-hairline bg-canvas p-4 shadow-sm md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel" />
            <Input
              placeholder="搜索角色名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="搜索角色"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <Filter className="h-4 w-4 shrink-0 text-steel" />
            {[{ value: 'all', label: '全部' }, ...CHARACTER_STATUS_OPTIONS].map((option) => (
              <button
                key={option.value}
                onClick={() => setStatus(option.value as CharacterStatus | 'all')}
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
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-ink">还没有角色</h2>
            <p className="mb-6 mt-2 max-w-md text-slate">
              可以从大纲自动同步角色，或手动创建第一个角色卡片。
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => syncMutation.mutate()}
                loading={syncMutation.isPending}
              >
                <RefreshCw className="h-4 w-4" />
                从大纲同步
              </Button>
              <Button className="gap-2" onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4" />
                手动创建角色
              </Button>
            </div>
            {syncMutation.isError ? (
              <p className="mt-4 text-sm text-semantic-error">
                同步失败：{syncMutation.error.message}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate">共 {filtered.length} 个角色</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((character) => (
                <Link
                  key={character.id}
                  to={`/projects/${projectId}/characters/${character.id}`}
                  className="group rounded-xl border border-hairline bg-canvas p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card-tint-lavender text-lg font-semibold text-primary">
                        {character.name.slice(0, 1)}
                      </div>
                      <div>
                        <h3 className="line-clamp-1 text-lg font-semibold text-ink group-hover:text-primary">
                          {character.name}
                        </h3>
                        <p className="text-sm text-slate">
                          {CHARACTER_ROLE_TYPE_LABELS[character.role_type]}
                        </p>
                      </div>
                    </div>
                    <Badge variant={character.status === 'confirmed' ? 'green' : 'purple'}>
                      {CHARACTER_STATUS_LABELS[character.status]}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {character.episode_range ? (
                      <Badge variant="tag-purple">登场 {character.episode_range}</Badge>
                    ) : null}
                    {character.ref_images.length > 0 ? (
                      <Badge variant="tag-green">{character.ref_images.length} 张参考图</Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-steel">
                    <span>
                      {character.appearance
                        ? character.appearance.slice(0, 30) +
                          (character.appearance.length > 30 ? '…' : '')
                        : '暂无外貌描述'}
                    </span>
                    <span>{formatDate(character.updated_at)}</span>
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

interface CreateCharacterCardProps {
  projectId: string;
  onCreated: () => void;
  onCancel: () => void;
}

function CreateCharacterCard({ projectId, onCreated, onCancel }: CreateCharacterCardProps) {
  const [name, setName] = useState('');
  const [roleType, setRoleType] = useState<CharacterRoleType>('protagonist');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createCharacter(projectId, { name: name.trim(), role_type: roleType });
      setName('');
      onCreated();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 rounded-xl border border-hairline bg-canvas p-6 shadow-sm"
    >
      <h2 className="mb-4 text-lg font-semibold text-ink">创建角色</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="new-character-name" className="mb-2 block text-sm font-medium text-ink">
            姓名 *
          </label>
          <Input
            id="new-character-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="角色姓名"
            maxLength={100}
            required
          />
        </div>
        <div>
          <label htmlFor="new-character-role" className="mb-2 block text-sm font-medium text-ink">
            角色定位 *
          </label>
          <Select
            id="new-character-role"
            value={roleType}
            onChange={(e) => setRoleType(e.target.value as CharacterRoleType)}
            options={CHARACTER_ROLE_TYPE_OPTIONS}
          />
        </div>
      </div>

      {submitError ? (
        <p className="mt-4 text-sm text-semantic-error">{submitError}</p>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? '创建中...' : '创建角色'}
        </Button>
      </div>
    </form>
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
