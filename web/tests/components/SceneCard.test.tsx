import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SceneCard } from '../../src/components/script/SceneCard';
import type { ScriptScene } from '../../src/types';

const sampleScene: ScriptScene = {
  scene_id: 'scene-1',
  location_id: '城西仓库',
  time_of_day: '傍晚',
  weather: '多云',
  characters_present: ['张三', '李四'],
  scene_summary: '张三在仓库中发现关键线索。',
  beats: ['张三进入仓库', '发现隐藏的箱子', '李四突然出现'],
  dialogues: [
    { char_id: '张三', text: '这里有人来过。', emotion: '警觉' },
    { char_id: '李四', text: '你不该来这里。', emotion: '阴沉' },
  ],
};

describe('SceneCard', () => {
  it('renders scene summary and metadata in collapsed state', () => {
    render(
      <SceneCard
        scene={sampleScene}
        index={0}
        onSceneUpdate={vi.fn()}
        onRegenerateScene={vi.fn()}
        regenerating={null}
      />
    );
    expect(screen.getByText('场景 1')).toBeInTheDocument();
    expect(screen.getByText(/张三在仓库中发现关键线索/)).toBeInTheDocument();
    expect(screen.getByText('城西仓库')).toBeInTheDocument();
    expect(screen.getByText('傍晚')).toBeInTheDocument();
    expect(screen.getByText('多云')).toBeInTheDocument();
    expect(screen.getByText('2 角色')).toBeInTheDocument();
    expect(screen.getByText('2 句台词')).toBeInTheDocument();
  });

  it('expands on header click', async () => {
    const user = userEvent.setup();
    render(
      <SceneCard
        scene={sampleScene}
        index={2}
        onSceneUpdate={vi.fn()}
        onRegenerateScene={vi.fn()}
        regenerating={null}
      />
    );
    // Click header to expand
    await user.click(screen.getByText('场景 3'));
    // Expanded content should be visible
    expect(screen.getByText('出场角色')).toBeInTheDocument();
  });

  it('shows dialogues when expanded', async () => {
    const user = userEvent.setup();
    render(
      <SceneCard
        scene={sampleScene}
        index={0}
        onSceneUpdate={vi.fn()}
        onRegenerateScene={vi.fn()}
        regenerating={null}
      />
    );
    await user.click(screen.getByText('场景 1'));
    expect(screen.getByText('这里有人来过。')).toBeInTheDocument();
    expect(screen.getByText('你不该来这里。')).toBeInTheDocument();
  });

  it('shows beats when expanded', async () => {
    const user = userEvent.setup();
    render(
      <SceneCard
        scene={sampleScene}
        index={0}
        onSceneUpdate={vi.fn()}
        onRegenerateScene={vi.fn()}
        regenerating={null}
      />
    );
    await user.click(screen.getByText('场景 1'));
    expect(screen.getByText('张三进入仓库')).toBeInTheDocument();
    expect(screen.getByText('发现隐藏的箱子')).toBeInTheDocument();
  });

  it('shows regenerate button when expanded', async () => {
    const user = userEvent.setup();
    render(
      <SceneCard
        scene={sampleScene}
        index={0}
        onSceneUpdate={vi.fn()}
        onRegenerateScene={vi.fn()}
        regenerating={null}
      />
    );
    await user.click(screen.getByText('场景 1'));
    expect(screen.getByText('重新生成此场景')).toBeInTheDocument();
  });

  it('calls onRegenerateScene when regenerate button clicked', async () => {
    const user = userEvent.setup();
    const onRegenerateScene = vi.fn();
    render(
      <SceneCard
        scene={sampleScene}
        index={0}
        onSceneUpdate={vi.fn()}
        onRegenerateScene={onRegenerateScene}
        regenerating={null}
      />
    );
    await user.click(screen.getByText('场景 1'));
    await user.click(screen.getByText('重新生成此场景'));
    expect(onRegenerateScene).toHaveBeenCalledWith('scene-1');
  });

  it('disables regenerate button when currently regenerating this scene', async () => {
    const user = userEvent.setup();
    render(
      <SceneCard
        scene={sampleScene}
        index={0}
        onSceneUpdate={vi.fn()}
        onRegenerateScene={vi.fn()}
        regenerating="scene-1"
      />
    );
    await user.click(screen.getByText('场景 1'));
    const button = screen.getByText('重新生成中...');
    expect(button).toBeDisabled();
  });

  it('enters meta edit mode and saves', async () => {
    const user = userEvent.setup();
    const onSceneUpdate = vi.fn();
    render(
      <SceneCard
        scene={sampleScene}
        index={0}
        onSceneUpdate={onSceneUpdate}
        onRegenerateScene={vi.fn()}
        regenerating={null}
      />
    );
    await user.click(screen.getByText('场景 1'));
    // Click "编辑场景信息"
    await user.click(screen.getByText('编辑场景信息'));

    // Change time_of_day
    const inputs = screen.getAllByRole('textbox');
    const timeInput = inputs.find(
      (el) => (el as HTMLInputElement).value === '傍晚'
    );
    if (timeInput) {
      fireEvent.change(timeInput, { target: { value: '深夜' } });
    }

    // Click save
    await user.click(screen.getByText('保存'));
    expect(onSceneUpdate).toHaveBeenCalled();
  });

  it('hides edit controls when disabled', async () => {
    const user = userEvent.setup();
    render(
      <SceneCard
        scene={sampleScene}
        index={0}
        onSceneUpdate={vi.fn()}
        onRegenerateScene={vi.fn()}
        regenerating={null}
        disabled={true}
      />
    );
    await user.click(screen.getByText('场景 1'));
    expect(screen.queryByText('编辑场景信息')).not.toBeInTheDocument();
    expect(screen.queryByText('重新生成此场景')).not.toBeInTheDocument();
  });

  it('renders empty dialogues message', async () => {
    const user = userEvent.setup();
    const noDialogues: ScriptScene = { ...sampleScene, dialogues: [] };
    render(
      <SceneCard
        scene={noDialogues}
        index={0}
        onSceneUpdate={vi.fn()}
        onRegenerateScene={vi.fn()}
        regenerating={null}
      />
    );
    await user.click(screen.getByText('场景 1'));
    expect(screen.getByText('暂无台词')).toBeInTheDocument();
  });
});
