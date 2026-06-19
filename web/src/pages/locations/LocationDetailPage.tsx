import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { getLocation } from '../../api/locations';
import { getProject } from '../../api/projects';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LocationForm } from '../../components/locations/LocationForm';
import { BaseImageGenerator } from '../../components/locations/BaseImageGenerator';
import { VariantGenerator } from '../../components/locations/VariantGenerator';
import { PromptLayerEditor } from '../../components/locations/PromptLayerEditor';
import { LocationVersionHistory } from '../../components/locations/LocationVersionHistory';
import { LOCATION_STATUS_LABELS, type Location } from '../../types';

export function LocationDetailPage() {
  const { projectId = '', locationId = '' } = useParams<{
    projectId: string;
    locationId: string;
  }>();
  const queryClient = useQueryClient();
  const [localLocation, setLocalLocation] = useState<Location | null>(null);

  const { data: projectResponse } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Boolean(projectId),
  });

  const {
    data: locationResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['location', projectId, locationId],
    queryFn: () => getLocation(projectId, locationId),
    enabled: Boolean(projectId) && Boolean(locationId),
  });

  const location = localLocation ?? locationResponse?.data ?? null;

  const handleLocationUpdated = (updated: Location) => {
    setLocalLocation(updated);
    void queryClient.invalidateQueries({
      queryKey: ['location', projectId, locationId],
    });
    void queryClient.invalidateQueries({ queryKey: ['locations', projectId] });
  };

  const projectTitle = projectResponse?.data.meta.title ?? '项目';

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-surface-soft">
        <AlertCircle className="h-12 w-12 text-semantic-error" />
        <p className="text-semantic-error">加载场景失败：{error.message}</p>
        <Link to={`/projects/${projectId}/locations`}>
          <Button variant="secondary">返回场景列表</Button>
        </Link>
      </div>
    );
  }

  if (isLoading || !location) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-soft">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
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
                to={`/projects/${projectId}/locations`}
                className="inline-flex items-center gap-1 text-sm text-steel hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                返回场景列表
              </Link>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card-tint-lavender text-lg font-semibold text-primary">
                  {location.name.slice(0, 1)}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-ink">{location.name}</h1>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate">
                    <span>{location.space_type ?? '未设置空间类型'}</span>
                    <span>·</span>
                    <Badge variant={location.status === 'confirmed' ? 'green' : 'purple'}>
                      {LOCATION_STATUS_LABELS[location.status]}
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
          <LocationForm
            projectId={projectId}
            location={location}
            onSaved={handleLocationUpdated}
          />
        </section>

        <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm md:p-8">
          <BaseImageGenerator
            projectId={projectId}
            location={location}
            onUpdated={handleLocationUpdated}
          />
        </section>

        <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm md:p-8">
          <VariantGenerator
            projectId={projectId}
            location={location}
            onUpdated={handleLocationUpdated}
          />
        </section>

        <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm md:p-8">
          <PromptLayerEditor location={location} />
        </section>

        <section className="rounded-xl border border-hairline bg-canvas p-6 shadow-sm md:p-8">
          <LocationVersionHistory
            projectId={projectId}
            location={location}
            onRolledBack={handleLocationUpdated}
          />
        </section>
      </main>
    </div>
  );
}
