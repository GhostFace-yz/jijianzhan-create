import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DurationEstimate } from '../../src/components/script/DurationEstimate';
import type { ScriptScene } from '../../src/types';

const sampleScenes: ScriptScene[] = [
  {
    scene_id: 's1',
    location_id: '仓库',
    time_of_day: '傍晚',
    weather: '多云',
    characters_present: ['张三'],
    scene_summary: '测试场景1',
    beats: [],
    dialogues: [
      { char_id: '张三', text: '你好，世界！', emotion: '平静' }, // 6 chars
      { char_id: '张三', text: '这里很安静。', emotion: '平静' }, // 7 chars
    ],
  },
  {
    scene_id: 's2',
    location_id: '码头',
    time_of_day: '深夜',
    weather: '雨',
    characters_present: ['张三', '李四'],
    scene_summary: '测试场景2',
    beats: [],
    dialogues: [
      { char_id: '张三', text: '我们得赶快走。', emotion: '紧张' }, // 7 chars
    ],
  },
];

describe('DurationEstimate', () => {
  it('renders estimated duration', () => {
    render(<DurationEstimate scenes={sampleScenes} />);
    expect(screen.getByText('估算时长')).toBeInTheDocument();
    // Should show a minute value
    expect(screen.getByText('分钟')).toBeInTheDocument();
  });

  it('shows scene and character count', () => {
    render(<DurationEstimate scenes={sampleScenes} />);
    expect(screen.getByText(/2 个场景/)).toBeInTheDocument();
    // Total chars: "你好，世界！"(6) + "这里很安静。"(6) + "我们得赶快走。"(7) = 19
    expect(screen.getByText(/19 字台词/)).toBeInTheDocument();
  });

  it('shows the calculation formula', () => {
    render(<DurationEstimate scenes={sampleScenes} />);
    expect(
      screen.getByText(/台词字数 \/ 200 \+ 场景数 × 0\.5/)
    ).toBeInTheDocument();
  });

  it('calculates correctly', () => {
    // Total chars = 20, scenes = 2
    // Duration = 20/200 + 2*0.5 = 0.1 + 1.0 = 1.1
    render(<DurationEstimate scenes={sampleScenes} />);
    expect(screen.getByText('1.1')).toBeInTheDocument();
  });

  it('handles empty scenes array', () => {
    render(<DurationEstimate scenes={[]} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/0 个场景/)).toBeInTheDocument();
    expect(screen.getByText(/0 字台词/)).toBeInTheDocument();
  });

  it('handles scenes with no dialogues', () => {
    const noDialogues: ScriptScene[] = [
      {
        ...sampleScenes[0],
        dialogues: [],
      },
    ];
    render(<DurationEstimate scenes={noDialogues} />);
    expect(screen.getByText(/0 字台词/)).toBeInTheDocument();
    // Duration = 0/200 + 1*0.5 = 0.5
    expect(screen.getByText('0.5')).toBeInTheDocument();
  });
});
