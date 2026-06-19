import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { WorldSettingCard } from '../../src/components/outline/WorldSettingCard';
import { CharactersCard } from '../../src/components/outline/CharactersCard';
import { LocationsCard } from '../../src/components/outline/LocationsCard';
import type { OutlineCharacter, OutlineLocation } from '../../src/types';

const sampleCharacters: OutlineCharacter[] = [
  { name: '张三', description: '主角，年轻侦探' },
  { name: '李四', description: '反派，神秘商人' },
];

const sampleLocations: OutlineLocation[] = [
  { name: '城西仓库', description: '废弃的工业仓库' },
  { name: '市警察局', description: '城市中心警察局' },
];

describe('WorldSettingCard', () => {
  it('renders world setting and main conflict', () => {
    render(
      <WorldSettingCard
        worldSetting="未来世界"
        mainConflict="人类与AI的战争"
        onWorldSettingChange={vi.fn()}
        onMainConflictChange={vi.fn()}
      />
    );
    expect(screen.getByText('未来世界')).toBeInTheDocument();
    expect(screen.getByText('人类与AI的战争')).toBeInTheDocument();
    expect(screen.getByText('世界观')).toBeInTheDocument();
  });

  it('shows locked warning when locked', () => {
    render(
      <WorldSettingCard
        worldSetting="test"
        mainConflict="test"
        onWorldSettingChange={vi.fn()}
        onMainConflictChange={vi.fn()}
        locked={true}
      />
    );
    expect(screen.getByText(/已锁定/)).toBeInTheDocument();
  });
});

describe('CharactersCard', () => {
  it('renders character list', () => {
    render(
      <CharactersCard
        characters={sampleCharacters}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('李四')).toBeInTheDocument();
    expect(screen.getByText('2 个角色')).toBeInTheDocument();
  });

  it('expands character on click', () => {
    render(
      <CharactersCard
        characters={sampleCharacters}
        onChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('张三'));
    // Description appears both in summary and expanded section
    const descElements = screen.getAllByText('主角，年轻侦探');
    expect(descElements.length).toBeGreaterThanOrEqual(1);
  });

  it('adds a new character when add button clicked', () => {
    const onChange = vi.fn();
    render(
      <CharactersCard
        characters={sampleCharacters}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText('添加'));
    expect(onChange).toHaveBeenCalledWith([
      ...sampleCharacters,
      { name: '新角色', description: '' },
    ]);
  });
});

describe('LocationsCard', () => {
  it('renders location list', () => {
    render(
      <LocationsCard
        locations={sampleLocations}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('城西仓库')).toBeInTheDocument();
    expect(screen.getByText('市警察局')).toBeInTheDocument();
    expect(screen.getByText('2 个场景')).toBeInTheDocument();
  });

  it('expands location on click', () => {
    render(
      <LocationsCard
        locations={sampleLocations}
        onChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('城西仓库'));
    // Description appears both in summary and expanded section
    const descElements = screen.getAllByText('废弃的工业仓库');
    expect(descElements.length).toBeGreaterThanOrEqual(1);
  });

  it('hides add button when locked', () => {
    render(
      <LocationsCard
        locations={sampleLocations}
        onChange={vi.fn()}
        locked={true}
      />
    );
    expect(screen.queryByText('添加')).not.toBeInTheDocument();
  });
});
