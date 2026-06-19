import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EndStateCard } from '../../src/components/script/EndStateCard';
import type { EndState } from '../../src/types';

const sampleEndState: EndState = {
  character_states: [
    { char_id: '张三', emotion: '坚定', location: '仓库' },
    { char_id: '李四', emotion: '愤怒', location: '逃往码头' },
  ],
  unresolved_conflicts: ['张三与李四的旧怨', '仓库的秘密'],
  key_prop_states: {
    '神秘箱子': '未被打开',
    '李四的戒指': '丢失',
  },
};

const emptyEndState: EndState = {
  character_states: [],
  unresolved_conflicts: [],
  key_prop_states: {},
};

describe('EndStateCard', () => {
  it('renders section title', () => {
    render(<EndStateCard endState={sampleEndState} />);
    expect(screen.getByText('本集结尾状态')).toBeInTheDocument();
  });

  it('renders character states', () => {
    render(<EndStateCard endState={sampleEndState} />);
    expect(screen.getByText('角色状态')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('坚定')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();
    expect(screen.getByText('愤怒')).toBeInTheDocument();
  });

  it('renders unresolved conflicts', () => {
    render(<EndStateCard endState={sampleEndState} />);
    expect(screen.getByText('未解决冲突')).toBeInTheDocument();
    expect(screen.getByText('张三与李四的旧怨')).toBeInTheDocument();
    expect(screen.getByText('仓库的秘密')).toBeInTheDocument();
  });

  it('renders key prop states', () => {
    render(<EndStateCard endState={sampleEndState} />);
    expect(screen.getByText('关键道具状态')).toBeInTheDocument();
    expect(screen.getByText('神秘箱子')).toBeInTheDocument();
    expect(screen.getByText('未被打开')).toBeInTheDocument();
    expect(screen.getByText('李四的戒指')).toBeInTheDocument();
    expect(screen.getByText('丢失')).toBeInTheDocument();
  });

  it('shows empty state message when no data', () => {
    render(<EndStateCard endState={emptyEndState} />);
    expect(screen.getByText('暂无结尾状态数据')).toBeInTheDocument();
  });

  it('does not show conflicts section when empty', () => {
    const noConflicts: EndState = {
      ...sampleEndState,
      unresolved_conflicts: [],
    };
    render(<EndStateCard endState={noConflicts} />);
    expect(screen.queryByText('未解决冲突')).not.toBeInTheDocument();
  });

  it('does not show prop states section when empty', () => {
    const noProps: EndState = {
      ...sampleEndState,
      key_prop_states: {},
    };
    render(<EndStateCard endState={noProps} />);
    expect(screen.queryByText('关键道具状态')).not.toBeInTheDocument();
  });
});
