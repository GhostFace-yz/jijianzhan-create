import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ProjectResponse, StoryboardNodeWithAudio } from '../src/types';

// ── Mock API modules ──

vi.mock('../src/api/projects', () => ({
  getProject: vi.fn(),
}));

vi.mock('../src/api/tts', () => ({
  listStoryboardNodesWithAudio: vi.fn(),
  batchGenerateTts: vi.fn(),
  generateNodeTts: vi.fn(),
  reviewNodeTts: vi.fn(),
  uploadNodeTts: vi.fn(),
  updateStoryboardNodes: vi.fn(),
}));

import { getProject } from '../src/api/projects';
import {
  listStoryboardNodesWithAudio,
  batchGenerateTts,
  generateNodeTts,
  reviewNodeTts,
  uploadNodeTts,
  updateStoryboardNodes,
} from '../src/api/tts';
import { TtsReviewPage } from '../src/pages/TtsReviewPage';

// ── Mock data ──

const mockProject: ProjectResponse = {
  data: {
    id: 'proj-1',
    user_id: 'user-1',
    team_id: null,
    status: 'producing',
    meta: {
      title: '星辰大海',
      description: '一部都市情感剧',
      genre: 'urban_romance',
      style_tags: ['realistic', 'fresh'],
      target_episodes: 12,
      duration_goal: '5min',
      notes: null,
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
};

const mockNodes: StoryboardNodeWithAudio[] = [
  {
    node_id: 'ep1-n001',
    scene_id: 'scene-coffee-shop',
    scene_variant: '下午-晴天',
    characters: [{ char_id: 'char_lin', costume_variant: '休闲装' }],
    shot_type: 'medium-shot',
    camera_move: 'static',
    visual_desc: '林小夏坐在咖啡厅靠窗位置',
    dialogue: { char_id: 'char_lin', text: '今天的咖啡真好喝。', emotion: 'gentle' },
    emotion_tag: '温馨',
    music_mood: '舒缓',
    duration_target: 6,
    transition_in: 'fade',
    transition_out: 'cut',
    status: 'completed',
    version_history: [],
    audio_clip: {
      url: 'https://example.com/audio1.mp3',
      duration: 3,
      voice_id: 'voice-1',
      emotion: 'gentle',
      speed: 1,
      generated_at: '2026-06-19T00:00:00Z',
      status: 'generated',
    },
    tts_status: 'generated',
  },
  {
    node_id: 'ep1-n002',
    scene_id: 'scene-coffee-shop',
    scene_variant: '下午-晴天',
    characters: [{ char_id: 'char_wang', costume_variant: '正装' }],
    shot_type: 'close-up',
    camera_move: 'pan-left',
    visual_desc: '王大明推门进入咖啡厅',
    dialogue: { char_id: 'char_wang', text: '你好，请给我一杯美式。', emotion: 'neutral' },
    emotion_tag: '平静',
    music_mood: '舒缓',
    duration_target: 5,
    transition_in: 'cut',
    transition_out: 'cut',
    status: 'pending',
    version_history: [],
    tts_status: 'pending',
  },
  {
    node_id: 'ep1-n003',
    scene_id: 'scene-park',
    scene_variant: '傍晚-多云',
    characters: [{ char_id: 'char_wang', costume_variant: '休闲装' }],
    shot_type: 'wide-shot',
    camera_move: 'tracking',
    visual_desc: '两人并肩走在公园湖边',
    dialogue: { char_id: 'char_wang', text: '夕阳真美啊。', emotion: 'contemplative' },
    emotion_tag: '浪漫',
    music_mood: '温馨',
    duration_target: 7,
    transition_in: 'dissolve',
    transition_out: 'fade',
    status: 'completed',
    version_history: [],
    audio_clip: {
      url: 'https://example.com/audio3.mp3',
      duration: 4,
      voice_id: 'voice-2',
      emotion: 'contemplative',
      speed: 1,
      generated_at: '2026-06-19T00:00:00Z',
      status: 'reviewed',
      reviewed: true,
      reviewed_at: '2026-06-19T00:00:00Z',
    },
    tts_status: 'reviewed',
  },
];

// ── Helpers ──

function renderPage({
  projectId = 'proj-1',
  episodeNumber = '1',
}: {
  projectId?: string;
  episodeNumber?: string;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  const route = `/projects/${projectId}/episodes/${episodeNumber}/tts`;

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/projects/:projectId/episodes/:episodeNumber/tts" element={<TtsReviewPage />} />
          <Route
            path="/projects/:projectId/episodes/:episodeNumber/storyboard/review"
            element={<div>Storyboard Review</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function waitForData() {
  await waitFor(() => {
    expect(screen.queryByText('加载分镜节点...')).not.toBeInTheDocument();
  });
}

// ── Tests ──

describe('TtsReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock-url') });
  });

  describe('Empty state', () => {
    it('should show empty state when no nodes exist', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockResolvedValue({ data: [] });

      renderPage();
      await waitForData();

      expect(screen.getByText('还没有分镜节点')).toBeInTheDocument();
      expect(screen.getByText('前往分镜编辑器')).toBeInTheDocument();
    });
  });

  describe('Nodes loaded', () => {
    it('should display header with review count', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText('星辰大海 · 第 1 集 · 配音试听与审核')).toBeInTheDocument();
      expect(screen.getByText('1/3 已审核 · 2 已生成')).toBeInTheDocument();
    });

    it('should show all node cards', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText('ep1-n001')).toBeInTheDocument();
      expect(screen.getByText('ep1-n002')).toBeInTheDocument();
      expect(screen.getByText('ep1-n003')).toBeInTheDocument();
    });

    it('should show TTS status badges', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByText('已生成')).toBeInTheDocument();
      expect(screen.getByText('待生成')).toBeInTheDocument();
      expect(screen.getByText('已审核')).toBeInTheDocument();
    });

    it('should show batch generate button', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      expect(screen.getByRole('button', { name: /批量生成配音/i })).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner while fetching', async () => {
      vi.mocked(getProject).mockReturnValue(new Promise(() => {}));
      vi.mocked(listStoryboardNodesWithAudio).mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getByText('加载分镜节点...')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error message when fetch fails', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockRejectedValue(new Error('Service unavailable'));

      renderPage();
      await waitForData();

      expect(screen.getByText('加载失败')).toBeInTheDocument();
      expect(screen.getByText('Service unavailable')).toBeInTheDocument();
    });
  });

  describe('Batch generation', () => {
    it('should call batchGenerateTts when batch generate button is clicked', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockResolvedValue({ data: mockNodes });
      vi.mocked(batchGenerateTts).mockResolvedValue({
        data: {
          episode_id: 'ep-1',
          total_nodes: 3,
          nodes_with_dialogue: 2,
          nodes_generated: 2,
          nodes_skipped: 1,
          nodes_failed: 0,
          success_rate: 1,
          results: [],
        },
      });

      renderPage();
      await waitForData();

      await userEvent.click(screen.getByRole('button', { name: /批量生成配音/i }));

      await waitFor(() => {
        expect(batchGenerateTts).toHaveBeenCalledWith('proj-1', 'ep-1');
      });
    });
  });

  describe('Single generation', () => {
    it('should call generateNodeTts for a pending node', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockResolvedValue({ data: mockNodes });
      vi.mocked(generateNodeTts).mockResolvedValue({
        data: {
          node_id: 'ep1-n002',
          audio_clip: {
            url: 'https://example.com/audio2.mp3',
            duration: 2,
            voice_id: 'voice-3',
            emotion: 'neutral',
            speed: 1,
            generated_at: '2026-06-19T00:00:00Z',
            status: 'generated',
          },
          skipped: false,
        },
      });

      renderPage();
      await waitForData();

      const card = screen.getByTestId('tts-node-ep1-n002');
      const generateBtn = within(card).getByText('生成配音');
      expect(generateBtn).toBeEnabled();
      await userEvent.click(generateBtn);

      expect(generateNodeTts).toHaveBeenCalledWith('proj-1', 'ep-1', 'ep1-n002', undefined);
    });
  });

  describe('Review actions', () => {
    it('should call reviewNodeTts with approved=true', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockResolvedValue({ data: mockNodes });
      vi.mocked(reviewNodeTts).mockResolvedValue({
        data: {
          url: 'https://example.com/audio1.mp3',
          duration: 3,
          voice_id: 'voice-1',
          emotion: 'gentle',
          speed: 1,
          generated_at: '2026-06-19T00:00:00Z',
          status: 'reviewed',
          reviewed: true,
        },
      });

      renderPage();
      await waitForData();

      const card = screen.getByTestId('tts-node-ep1-n001');
      const approveBtn = within(card).getByRole('button', { name: /通过/i });
      await userEvent.click(approveBtn);

      await waitFor(() => {
        expect(reviewNodeTts).toHaveBeenCalledWith('proj-1', 'ep-1', 'ep1-n001', { approved: true });
      });
    });

    it('should call reviewNodeTts with approved=false', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockResolvedValue({ data: mockNodes });
      vi.mocked(reviewNodeTts).mockResolvedValue({
        data: {
          url: 'https://example.com/audio1.mp3',
          duration: 3,
          voice_id: 'voice-1',
          emotion: 'gentle',
          speed: 1,
          generated_at: '2026-06-19T00:00:00Z',
          status: 'reviewed',
          reviewed: false,
        },
      });

      renderPage();
      await waitForData();

      const card = screen.getByTestId('tts-node-ep1-n001');
      const rejectBtn = within(card).getByRole('button', { name: /驳回/i });
      await userEvent.click(rejectBtn);

      await waitFor(() => {
        expect(reviewNodeTts).toHaveBeenCalledWith('proj-1', 'ep-1', 'ep1-n001', { approved: false });
      });
    });
  });

  describe('Upload replacement', () => {
    it('should open upload dialog and call uploadNodeTts', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockResolvedValue({ data: mockNodes });
      vi.mocked(uploadNodeTts).mockResolvedValue({
        data: {
          url: 'blob:mock-url',
          duration: 0,
          voice_id: 'user-uploaded',
          emotion: 'gentle',
          speed: 1,
          generated_at: '2026-06-19T00:00:00Z',
          status: 'reviewed',
          reviewed: true,
        },
      });

      renderPage();
      await waitForData();

      const card = screen.getByTestId('tts-node-ep1-n001');
      const uploadBtn = within(card).getByRole('button', { name: /上传/i });
      await userEvent.click(uploadBtn);

      expect(screen.getByText('手动上传录音')).toBeInTheDocument();

      const file = new File(['audio content'], 'voice.wav', { type: 'audio/wav' });
      const dropZone = screen.getByRole('button', { name: /拖拽音频到此处/i });
      const input = dropZone.querySelector('input[type="file"]');
      await userEvent.upload(input!, file);

      await userEvent.click(screen.getByRole('button', { name: /确认替换/i }));

      await waitFor(() => {
        expect(uploadNodeTts).toHaveBeenCalledWith('proj-1', 'ep-1', 'ep1-n001', {
          url: 'blob:mock-url',
          duration: 0,
        });
      });
    });
  });

  describe('Emotion edit', () => {
    it('should open emotion edit dialog', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockResolvedValue({ data: mockNodes });
      vi.mocked(updateStoryboardNodes).mockResolvedValue({ data: mockNodes });
      vi.mocked(generateNodeTts).mockResolvedValue({
        data: {
          node_id: 'ep1-n001',
          audio_clip: {
            url: 'https://example.com/audio1.mp3',
            duration: 3,
            voice_id: 'voice-1',
            emotion: 'happy',
            speed: 1,
            generated_at: '2026-06-19T00:00:00Z',
            status: 'generated',
          },
          skipped: false,
        },
      });

      renderPage();
      await waitForData();

      const card = screen.getByTestId('tts-node-ep1-n001');
      const editBtn = within(card).getByRole('button', { name: /改情绪/i });
      await userEvent.click(editBtn);

      expect(screen.getByText('修改情绪后重新生成')).toBeInTheDocument();
    });
  });

  describe('Dialogue edit', () => {
    it('should open dialogue edit dialog', async () => {
      vi.mocked(getProject).mockResolvedValue(mockProject);
      vi.mocked(listStoryboardNodesWithAudio).mockResolvedValue({ data: mockNodes });

      renderPage();
      await waitForData();

      const card = screen.getByTestId('tts-node-ep1-n001');
      const editBtn = within(card!).getByRole('button', { name: /改台词/i });
      await userEvent.click(editBtn);

      expect(screen.getByText('修改台词后重新生成')).toBeInTheDocument();
    });
  });
});
