import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { ProjectListPage } from './pages/ProjectListPage';
import { CreateProjectPage } from './pages/CreateProjectPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { CharacterListPage } from './pages/characters/CharacterListPage';
import { CharacterDetailPage } from './pages/characters/CharacterDetailPage';
import { LocationListPage } from './pages/locations/LocationListPage';
import { LocationDetailPage } from './pages/locations/LocationDetailPage';

const OutlinePage = lazy(() =>
  import('./pages/OutlinePage').then((m) => ({ default: m.OutlinePage }))
);

const ScriptPage = lazy(() =>
  import('./pages/ScriptPage').then((m) => ({ default: m.ScriptPage }))
);

const StoryboardPage = lazy(() =>
  import('./pages/StoryboardPage').then((m) => ({ default: m.StoryboardPage }))
);

const StoryboardReviewPage = lazy(() =>
  import('./pages/StoryboardReviewPage').then((m) => ({ default: m.StoryboardReviewPage }))
);

const TtsReviewPage = lazy(() =>
  import('./pages/TtsReviewPage').then((m) => ({ default: m.TtsReviewPage }))
);

const MusicPage = lazy(() =>
  import('./pages/MusicPage').then((m) => ({ default: m.MusicPage }))
);

const VideoReviewPage = lazy(() =>
  import('./pages/VideoReviewPage').then((m) => ({ default: m.VideoReviewPage }))
);

const CompositePage = lazy(() =>
  import('./pages/CompositePage').then((m) => ({ default: m.CompositePage }))
);

const RenderPage = lazy(() =>
  import('./pages/RenderPage').then((m) => ({ default: m.RenderPage }))
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
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
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
        <Route
          path="/projects/:projectId/episodes/:episodeNumber/script"
          element={
            <Suspense fallback={<PageFallback />}>
              <ScriptPage />
            </Suspense>
          }
        />
        <Route
          path="/projects/:projectId/episodes/:episodeNumber/storyboard"
          element={
            <Suspense fallback={<PageFallback />}>
              <StoryboardPage />
            </Suspense>
          }
        />
        <Route
          path="/projects/:projectId/episodes/:episodeNumber/storyboard/review"
          element={
            <Suspense fallback={<PageFallback />}>
              <StoryboardReviewPage />
            </Suspense>
          }
        />
        <Route
          path="/projects/:projectId/episodes/:episodeNumber/tts"
          element={
            <Suspense fallback={<PageFallback />}>
              <TtsReviewPage />
            </Suspense>
          }
        />
        <Route
          path="/projects/:projectId/episodes/:episodeNumber/music"
          element={
            <Suspense fallback={<PageFallback />}>
              <MusicPage />
            </Suspense>
          }
        />
        <Route
          path="/projects/:projectId/episodes/:episodeNumber/video"
          element={
            <Suspense fallback={<PageFallback />}>
              <VideoReviewPage />
            </Suspense>
          }
        />
        <Route
          path="/projects/:projectId/episodes/:episodeNumber/composite"
          element={
            <Suspense fallback={<PageFallback />}>
              <CompositePage />
            </Suspense>
          }
        />
        <Route
          path="/projects/:projectId/episodes/:episodeNumber/render"
          element={
            <Suspense fallback={<PageFallback />}>
              <RenderPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
