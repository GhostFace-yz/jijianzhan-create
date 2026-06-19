import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { ProjectListPage } from './pages/ProjectListPage';
import { CreateProjectPage } from './pages/CreateProjectPage';
import { CharacterListPage } from './pages/characters/CharacterListPage';
import { CharacterDetailPage } from './pages/characters/CharacterDetailPage';
import { LocationListPage } from './pages/locations/LocationListPage';
import { LocationDetailPage } from './pages/locations/LocationDetailPage';

const OutlinePage = lazy(() =>
  import('./pages/OutlinePage').then((m) => ({ default: m.OutlinePage }))
);

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-soft">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline-strong border-t-primary" />
    </div>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-canvas">
      <Routes>
        <Route path="/" element={<ProjectListPage />} />
        <Route path="/projects/new" element={<CreateProjectPage />} />
        <Route path="/projects/:id" element={<div className="p-8 text-center">项目详情页占位</div>} />
        <Route
          path="/projects/:id/outline"
          element={
            <Suspense fallback={<PageFallback />}>
              <OutlinePage />
            </Suspense>
          }
        />
        <Route path="/projects/:projectId/characters" element={<CharacterListPage />} />
        <Route path="/projects/:projectId/characters/:characterId" element={<CharacterDetailPage />} />
        <Route path="/projects/:projectId/locations" element={<LocationListPage />} />
        <Route path="/projects/:projectId/locations/:locationId" element={<LocationDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
