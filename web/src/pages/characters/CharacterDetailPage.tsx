import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { getCharacter } from '../../api/characters';
import { getProject } from '../../api/projects';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/shadcn/skeleton';
import { CharacterForm } from '../../components/characters/CharacterForm';
import { ThreeViewGenerator } from '../../components/characters/ThreeViewGenerator';
import { ReferenceGallery } from '../../components/characters/ReferenceGallery';
import { VersionHistory } from '../../components/characters/VersionHistory';
import {
  CHARACTER_ROLE_TYPE_LABELS,
  CHARACTER_STATUS_LABELS,
  type Character,
} from '../../types';

export function CharacterDetailPage() {
  const { projectId = '', characterId = '' } = useParams<{
    projectId: string;
    characterId: string;
  }>();
  const queryClient = useQueryClient();
  const [localCharacter, setLocalCharacter] = useState<Character | null>(null);

  const { data: projectResponse } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });

  const {
    data: characterResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['character', projectId, characterId],
    queryFn: () => getCharacter(projectId, characterId),
    enabled: Boolean(projectId) && Boolean(characterId),
  });

  const character = localCharacter ?? characterResponse?.data ?? null;

  const handleCharacterUpdated = (updated: Character) => {
    setLocalCharacter(updated);
    void queryClient.invalidateQueries({ queryKey: ['character', projectId, characterId] });
    void queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
  };

  const projectTitle = projectResponse?.data.meta.title ?? '项目';

  if (isLoading || !character) {
    return (
      <div className="min-h-screen bg-surface-soft">
        <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/95 backdrop-blur">
          <div className="mx-auto max-w-5xl px-6 py-4">
            <Skeleton className="h-4 w-24" />
            <div className="mt-4 flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl space-y-8 px-6 py-8" data-testid="character-skeleton">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm md:p-8 space-y-4"
            >
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-surface-soft">
        <AlertCircle className="h-12 w-12 text-semantic-error" />
        <p className="text-semantic-error">加载角色失败：{error.message}</p>
        <Link to={`/projects/${projectId}/characters`}>
          <Button variant="secondary">返回角色列表</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-soft">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <Link
                to={`/projects/${projectId}/characters`}
                className="inline-flex items-center gap-1 text-sm text-steel hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                返回角色列表
              </Link>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card-tint-lavender text-lg font-semibold text-primary">
                  {character.name.slice(0, 1)}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-ink">{character.name}</h1>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate">
                    <span>{CHARACTER_ROLE_TYPE_LABELS[character.role_type]}</span>
                    <span>·</span>
                    <Badge variant={character.status === 'confirmed' ? 'green' : 'purple'}>
                      {CHARACTER_STATUS_LABELS[character.status]}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-sm text-slate">
              所属项目：<span className="font-medium text-ink">{projectTitle}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm md:p-8">
          <h2 className="mb-6 text-xl font-semibold text-ink">基础信息</h2>
          <CharacterForm
            projectId={projectId}
            character={character}
            onSaved={handleCharacterUpdated}
          />
        </section>

        <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm md:p-8">
          <ThreeViewGenerator
            projectId={projectId}
            character={character}
            onUpdated={handleCharacterUpdated}
          />
        </section>

        <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm md:p-8">
          <ReferenceGallery character={character} />
        </section>

        <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm md:p-8">
          <VersionHistory
            projectId={projectId}
            character={character}
            onRolledBack={handleCharacterUpdated}
          />
        </section>
      </main>
    </div>
  );
}
