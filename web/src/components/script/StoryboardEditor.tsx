import {
  useCallback,
  useMemo,
  useState,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type OnNodesChange,
  type OnSelectionChangeFunc,
  useNodesState,
  useEdgesState,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Image,
  Clock,
  Video,
  Music,
  Heart,
  ArrowLeftRight,
  Camera,
  Move,
} from 'lucide-react';
import type {
  StoryboardNode as StoryboardNodeType,
  ShotType,
  CameraMove,
  TransitionType,
  NodeStatus,
  NodeEditImpact,
} from '../../types';
import {
  SHOT_TYPE_LABELS,
  CAMERA_MOVE_LABELS,
  TRANSITION_LABELS,
  NODE_STATUS_LABELS,
  NODE_STATUS_ICONS,
} from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

// ── Layout Constants ──────────────────────────────────────────────────

const LANE_HEIGHT = 160;
const NODE_WIDTH = 200;
const NODE_GAP_X = 24;
const LANE_GAP_Y = 40;
const LANE_LABEL_WIDTH = 120;
const START_X = LANE_LABEL_WIDTH + 40;
const START_Y = 60;
const TIME_SCALE = 28; // pixels per second

// ── Custom Node Data ──────────────────────────────────────────────────

type StoryboardNodeData = Record<string, unknown> & {
  node: StoryboardNodeType;
  sceneName: string;
  onClickDetail: (nodeId: string) => void;
};

type StoryboardFlowNode = Node<StoryboardNodeData, 'storyboardNode'>;

// ── Custom Node Component ─────────────────────────────────────────────

function StoryboardNodeCard({ data, selected }: NodeProps<StoryboardFlowNode>) {
  const n = data.node;
  const shotLabel = SHOT_TYPE_LABELS[n.shot_type] || n.shot_type;
  const statusIcon = NODE_STATUS_ICONS[n.status] || '⏳';
  const duration = `${n.duration_target}s`;

  const statusColors: Record<NodeStatus, string> = {
    pending: 'bg-muted text-steel',
    generating: 'bg-card-tint-sky text-link-blue',
    completed: 'bg-card-tint-mint text-brand-green',
    needs_redo: 'bg-card-tint-peach text-semantic-warning',
  };

  return (
    <div
      className={`
        relative rounded-lg border bg-canvas shadow-sm transition-shadow
        ${selected ? 'border-primary shadow-md ring-2 ring-primary/20' : 'border-hairline'}
      `}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} className="!bg-hairline-strong" />
      <Handle type="source" position={Position.Right} className="!bg-hairline-strong" />

      {/* Thumbnail placeholder */}
      <div className="h-24 w-full rounded-t-lg bg-surface flex items-center justify-center">
        {n.status === 'completed' ? (
          <Image className="h-8 w-8 text-muted" />
        ) : (
          <div className="text-center">
            <Image className="h-6 w-6 text-muted mx-auto" />
            <p className="text-xs text-muted mt-1">未生成</p>
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold text-ink">
            {n.node_id}
          </span>
          <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${statusColors[n.status]}`}>
            {statusIcon}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded bg-card-tint-lavender px-1.5 py-0.5 text-xs font-medium text-brand-purple-800">
            <Video className="h-3 w-3" />
            {shotLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-xs text-steel">
            <Clock className="h-3 w-3" />
            {duration}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate">
          <Move className="h-3 w-3" />
          <span className="truncate">{CAMERA_MOVE_LABELS[n.camera_move] || n.camera_move}</span>
        </div>
      </div>

      {/* Click overlay for detail */}
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          data.onClickDetail(n.node_id);
        }}
      />
    </div>
  );
}

const nodeTypes = {
  storyboardNode: StoryboardNodeCard,
};

// ── Lane Label Component ──────────────────────────────────────────────

function LaneLabel({ sceneId, nodeCount, y }: { sceneId: string; nodeCount: number; y: number }) {
  return (
    <div
      className="absolute left-4 flex flex-col justify-center"
      style={{ top: y, width: LANE_LABEL_WIDTH, height: LANE_HEIGHT }}
    >
      <p className="text-sm font-semibold text-ink truncate" title={sceneId}>
        {sceneId}
      </p>
      <p className="text-xs text-steel">{nodeCount} 节点</p>
    </div>
  );
}

// ── Context Menu ──────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
}

function NodeContextMenu({
  menu,
  onClose,
  onInsertBefore,
  onInsertAfter,
  onDelete,
  onSplit,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onInsertBefore: () => void;
  onInsertAfter: () => void;
  onDelete: () => void;
  onSplit: () => void;
}) {
  const items = [
    { label: '在前方插入节点', action: onInsertBefore, icon: '←' },
    { label: '在后方插入节点', action: onInsertAfter, icon: '→' },
    { label: '分裂节点', action: onSplit, icon: '✂️' },
    { type: 'divider' as const },
    { label: '删除节点', action: onDelete, icon: '🗑️', danger: true },
  ];

  return (
    <div
      className="absolute z-50 min-w-[180px] rounded-lg border border-hairline bg-canvas shadow-lg py-1"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.type === 'divider' ? (
          <div key={i} className="my-1 border-t border-hairline-soft" />
        ) : (
          <button
            key={i}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
              item.danger
                ? 'text-semantic-error hover:bg-semantic-error/5'
                : 'text-charcoal hover:bg-surface'
            }`}
            onClick={() => {
              item.action();
              onClose();
            }}
          >
            <span className="w-5 text-center">{item.icon}</span>
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────

interface DetailPanelProps {
  node: StoryboardNodeType | null;
  sceneName: string;
  onChange: (updated: StoryboardNodeType) => void;
  onClose: () => void;
  onVersionHistory: () => void;
}

const LIGHT_EDIT_FIELDS = ['dialogue', 'emotion_tag', 'music_mood', 'duration_target', 'transition_in', 'transition_out'];
const MEDIUM_EDIT_FIELDS = ['shot_type', 'camera_move', 'scene_variant'];
const DEEP_EDIT_FIELDS = ['characters', 'visual_desc', 'scene_id'];

function getEditImpact(field: string): NodeEditImpact {
  if (LIGHT_EDIT_FIELDS.includes(field)) return 'light';
  if (MEDIUM_EDIT_FIELDS.includes(field)) return 'medium';
  if (DEEP_EDIT_FIELDS.includes(field)) return 'deep';
  return 'light';
}

function ImpactBadge({ impact }: { impact: NodeEditImpact }) {
  const styles: Record<NodeEditImpact, { bg: string; text: string; label: string }> = {
    light: { bg: 'bg-card-tint-sky', text: 'text-link-blue', label: '轻量' },
    medium: { bg: 'bg-card-tint-yellow', text: 'text-semantic-warning', label: '中度' },
    deep: { bg: 'bg-card-tint-peach', text: 'text-semantic-error', label: '深度' },
  };
  const s = styles[impact];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function NodeDetailPanel({ node, sceneName, onChange, onClose, onVersionHistory }: DetailPanelProps) {
  const [showImpact, setShowImpact] = useState<{ field: string; impact: NodeEditImpact } | null>(null);

  if (!node) return null;

  const handleFieldChange = (field: string, value: unknown) => {
    const impact = getEditImpact(field);
    setShowImpact({ field, impact });

    // Auto-dismiss after 2s
    setTimeout(() => setShowImpact(null), 2000);

    onChange({ ...node, [field]: value });
  };

  const handleDialogueChange = (field: string, value: string) => {
    const dialogue = node.dialogue ? { ...node.dialogue, [field]: value } : null;
    const impact = getEditImpact('dialogue');
    setShowImpact({ field: 'dialogue', impact });
    setTimeout(() => setShowImpact(null), 2000);
    onChange({ ...node, dialogue } as StoryboardNodeType);
  };

  const handleCharacterChange = (index: number, field: string, value: string) => {
    const characters = [...node.characters];
    characters[index] = { ...characters[index], [field]: value };
    const impact = getEditImpact('characters');
    setShowImpact({ field: 'characters', impact });
    setTimeout(() => setShowImpact(null), 2000);
    onChange({ ...node, characters });
  };

  const addCharacter = () => {
    const characters = [...node.characters, { char_id: '', costume_variant: '' }];
    onChange({ ...node, characters });
  };

  const removeCharacter = (index: number) => {
    const characters = node.characters.filter((_, i) => i !== index);
    onChange({ ...node, characters });
  };

  return (
    <aside className="w-80 shrink-0 border-l border-hairline bg-canvas overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-hairline bg-canvas px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">{node.node_id}</h3>
          <p className="text-xs text-steel">{sceneName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-steel hover:text-ink hover:bg-surface transition-colors"
          aria-label="关闭面板"
        >
          ✕
        </button>
      </div>

      {/* Impact tooltip */}
      {showImpact && (
        <div className={`mx-4 mt-3 rounded-md px-3 py-2 text-xs ${
          showImpact.impact === 'deep'
            ? 'bg-semantic-error/10 text-semantic-error'
            : showImpact.impact === 'medium'
            ? 'bg-semantic-warning/10 text-semantic-warning'
            : 'bg-card-tint-sky/50 text-link-blue'
        }`}>
          <span className="font-semibold">影响范围：</span>
          {showImpact.impact === 'light' && '台词/情绪/时长/转场变更 — 仅影响配音配乐'}
          {showImpact.impact === 'medium' && '镜头/运镜/场景变体变更 — 影响分镜图+视频'}
          {showImpact.impact === 'deep' && '角色/服装/visual_desc变更 — 影响全链路'}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Status */}
        <FieldGroup label="状态" field="status" impact={getEditImpact('status')}>
          <select
            value={node.status}
            onChange={(e) => handleFieldChange('status', e.target.value)}
            className="w-full h-9 rounded-md border border-hairline-strong bg-canvas px-3 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {Object.entries(NODE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </FieldGroup>

        {/* Shot Type */}
        <FieldGroup label="镜头类型" field="shot_type" impact={getEditImpact('shot_type')}>
          <select
            value={node.shot_type}
            onChange={(e) => handleFieldChange('shot_type', e.target.value)}
            className="w-full h-9 rounded-md border border-hairline-strong bg-canvas px-3 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {Object.entries(SHOT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </FieldGroup>

        {/* Camera Move */}
        <FieldGroup label="运镜方式" field="camera_move" impact={getEditImpact('camera_move')}>
          <select
            value={node.camera_move}
            onChange={(e) => handleFieldChange('camera_move', e.target.value)}
            className="w-full h-9 rounded-md border border-hairline-strong bg-canvas px-3 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {Object.entries(CAMERA_MOVE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </FieldGroup>

        {/* Duration */}
        <FieldGroup label="目标时长 (秒)" field="duration_target" impact={getEditImpact('duration_target')}>
          <input
            type="number"
            min={3}
            max={15}
            step={0.5}
            value={node.duration_target}
            onChange={(e) => handleFieldChange('duration_target', parseFloat(e.target.value) || 5)}
            className="w-full h-9 rounded-md border border-hairline-strong bg-canvas px-3 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </FieldGroup>

        {/* Emotion Tag */}
        <FieldGroup label="情绪标签" field="emotion_tag" impact={getEditImpact('emotion_tag')}>
          <input
            type="text"
            value={node.emotion_tag}
            onChange={(e) => handleFieldChange('emotion_tag', e.target.value)}
            placeholder="如：紧张、温馨"
            className="w-full h-9 rounded-md border border-hairline-strong bg-canvas px-3 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </FieldGroup>

        {/* Music Mood */}
        <FieldGroup label="配乐情绪" field="music_mood" impact={getEditImpact('music_mood')}>
          <input
            type="text"
            value={node.music_mood}
            onChange={(e) => handleFieldChange('music_mood', e.target.value)}
            placeholder="如：舒缓、激昂"
            className="w-full h-9 rounded-md border border-hairline-strong bg-canvas px-3 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </FieldGroup>

        {/* Transitions */}
        <FieldGroup label="入转场" field="transition_in" impact={getEditImpact('transition_in')}>
          <select
            value={node.transition_in}
            onChange={(e) => handleFieldChange('transition_in', e.target.value)}
            className="w-full h-9 rounded-md border border-hairline-strong bg-canvas px-3 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {Object.entries(TRANSITION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </FieldGroup>

        <FieldGroup label="出转场" field="transition_out" impact={getEditImpact('transition_out')}>
          <select
            value={node.transition_out}
            onChange={(e) => handleFieldChange('transition_out', e.target.value)}
            className="w-full h-9 rounded-md border border-hairline-strong bg-canvas px-3 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {Object.entries(TRANSITION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </FieldGroup>

        {/* Scene Variant */}
        <FieldGroup label="场景变体" field="scene_variant" impact={getEditImpact('scene_variant')}>
          <input
            type="text"
            value={node.scene_variant}
            onChange={(e) => handleFieldChange('scene_variant', e.target.value)}
            placeholder="如：下午-晴天"
            className="w-full h-9 rounded-md border border-hairline-strong bg-canvas px-3 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </FieldGroup>

        {/* Visual Description */}
        <FieldGroup label="视觉描述" field="visual_desc" impact={getEditImpact('visual_desc')}>
          <textarea
            value={node.visual_desc}
            onChange={(e) => handleFieldChange('visual_desc', e.target.value)}
            rows={3}
            className="w-full rounded-md border border-hairline-strong bg-canvas px-3 py-2 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary resize-none"
          />
        </FieldGroup>

        {/* Dialogue */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink">台词</h4>
            {node.dialogue ? (
              <button
                type="button"
                onClick={() => handleFieldChange('dialogue', null)}
                className="text-xs text-steel hover:text-semantic-error"
              >
                清除台词
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleFieldChange('dialogue', { char_id: '', text: '', emotion: 'neutral' })}
                className="text-xs text-link-blue hover:underline"
              >
                + 添加台词
              </button>
            )}
          </div>
          {node.dialogue && (
            <div className="space-y-2 rounded-md border border-hairline bg-surface-soft/50 p-3">
              <input
                type="text"
                value={node.dialogue.char_id}
                onChange={(e) => handleDialogueChange('char_id', e.target.value)}
                placeholder="角色 ID"
                className="w-full h-8 rounded border border-hairline-strong bg-canvas px-2 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <textarea
                value={node.dialogue.text}
                onChange={(e) => handleDialogueChange('text', e.target.value)}
                placeholder="台词内容..."
                rows={2}
                className="w-full rounded border border-hairline-strong bg-canvas px-2 py-1 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary resize-none"
              />
              <input
                type="text"
                value={node.dialogue.emotion}
                onChange={(e) => handleDialogueChange('emotion', e.target.value)}
                placeholder="情绪"
                className="w-full h-8 rounded border border-hairline-strong bg-canvas px-2 text-sm text-ink focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>

        {/* Characters */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink">
              出场角色
              <ImpactBadge impact={getEditImpact('characters')} />
            </h4>
            <button
              type="button"
              onClick={addCharacter}
              className="text-xs text-link-blue hover:underline"
            >
              + 添加角色
            </button>
          </div>
          {node.characters.map((ch, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-hairline bg-surface-soft/50 p-2">
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={ch.char_id}
                  onChange={(e) => handleCharacterChange(i, 'char_id', e.target.value)}
                  placeholder="角色 ID"
                  className="w-full h-7 rounded border border-hairline-strong bg-canvas px-2 text-xs text-ink focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <input
                  type="text"
                  value={ch.costume_variant}
                  onChange={(e) => handleCharacterChange(i, 'costume_variant', e.target.value)}
                  placeholder="服装变体"
                  className="w-full h-7 rounded border border-hairline-strong bg-canvas px-2 text-xs text-ink focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="button"
                onClick={() => removeCharacter(i)}
                className="shrink-0 text-xs text-steel hover:text-semantic-error"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Version History Entry */}
        <div className="pt-2 border-t border-hairline-soft">
          <button
            type="button"
            onClick={onVersionHistory}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-steel hover:bg-surface hover:text-ink transition-colors"
          >
            <Clock className="h-4 w-4" />
            版本历史
            {node.version_history.length > 0 && (
              <Badge variant="tag-purple">v{node.version_history.length}</Badge>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Helper: FieldGroup ────────────────────────────────────────────────

function FieldGroup({
  label,
  field,
  impact,
  children,
}: {
  label: string;
  field: string;
  impact: NodeEditImpact;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-steel">{label}</label>
        <ImpactBadge impact={impact} />
      </div>
      {children}
    </div>
  );
}

// ── Batch Edit Panel ──────────────────────────────────────────────────

interface BatchEditPanelProps {
  selectedCount: number;
  onBatchEditEmotion: (emotionTag: string) => void;
  onBatchEditMusic: (musicMood: string) => void;
  onClearSelection: () => void;
}

function BatchEditPanel({
  selectedCount,
  onBatchEditEmotion,
  onBatchEditMusic,
  onClearSelection,
}: BatchEditPanelProps) {
  const [emotionTag, setEmotionTag] = useState('');
  const [musicMood, setMusicMood] = useState('');

  if (selectedCount < 2) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-card-tint-lavender/50 px-4 py-2">
      <span className="text-sm font-medium text-charcoal">
        已选择 {selectedCount} 个节点
      </span>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={emotionTag}
          onChange={(e) => setEmotionTag(e.target.value)}
          placeholder="批量情绪标签"
          className="h-8 w-32 rounded border border-hairline-strong bg-canvas px-2 text-xs text-ink focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <Button
          variant="ghost"
          onClick={() => {
            if (emotionTag.trim()) {
              onBatchEditEmotion(emotionTag.trim());
              setEmotionTag('');
            }
          }}
          disabled={!emotionTag.trim()}
          className="text-xs h-8"
        >
          应用
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={musicMood}
          onChange={(e) => setMusicMood(e.target.value)}
          placeholder="批量配乐情绪"
          className="h-8 w-32 rounded border border-hairline-strong bg-canvas px-2 text-xs text-ink focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <Button
          variant="ghost"
          onClick={() => {
            if (musicMood.trim()) {
              onBatchEditMusic(musicMood.trim());
              setMusicMood('');
            }
          }}
          disabled={!musicMood.trim()}
          className="text-xs h-8"
        >
          应用
        </Button>
      </div>

      <button
        type="button"
        onClick={onClearSelection}
        className="text-xs text-steel hover:text-ink ml-auto"
      >
        取消选择
      </button>
    </div>
  );
}

// ── Main Editor Component ─────────────────────────────────────────────

interface StoryboardEditorProps {
  nodes: StoryboardNodeType[];
  projectId: string;
  episodeNumber: number;
  onNodesChange: (nodes: StoryboardNodeType[]) => void;
  onInsertNode: (afterNodeId: string, before: boolean) => void;
  onDeleteNode: (nodeId: string) => void;
  onSplitNode: (nodeId: string) => void;
  onVersionHistory: (nodeId: string) => void;
}

export function StoryboardEditor({
  nodes: storyboardNodes,
  projectId,
  episodeNumber,
  onNodesChange,
  onInsertNode,
  onDeleteNode,
  onSplitNode,
  onVersionHistory,
}: StoryboardEditorProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // ── Group nodes by scene ──────────────────────────────────────────
  const sceneGroups = useMemo(() => {
    const groups: Record<string, StoryboardNodeType[]> = {};
    for (const node of storyboardNodes) {
      const key = node.scene_id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(node);
    }
    // Keep original scene order
    const sceneOrder = Object.keys(groups);
    return { groups, sceneOrder };
  }, [storyboardNodes]);

  // ── Build React Flow nodes ────────────────────────────────────────
  const { flowNodes, totalWidth } = useMemo(() => {
    const result: StoryboardFlowNode[] = [];
    let y = START_Y;
    let maxWidth = 0;

    const { groups, sceneOrder } = sceneGroups;

    for (let laneIdx = 0; laneIdx < sceneOrder.length; laneIdx++) {
      const sceneId = sceneOrder[laneIdx];
      const sceneNodes = groups[sceneId];
      let x = START_X;

      for (let ni = 0; ni < sceneNodes.length; ni++) {
        const sn = sceneNodes[ni];
        result.push({
          id: sn.node_id,
          type: 'storyboardNode',
          position: { x, y: y + (LANE_HEIGHT - 120) / 2 },
          data: {
            node: sn,
            sceneName: sceneId,
            onClickDetail: (nid) => setSelectedNodeId(nid),
          },
          draggable: true,
          selectable: true,
        });
        x += NODE_WIDTH + NODE_GAP_X;
      }

      maxWidth = Math.max(maxWidth, x);
      y += LANE_HEIGHT + LANE_GAP_Y;
    }

    return { flowNodes: result, totalWidth: Math.max(maxWidth + 200, 800) };
  }, [sceneGroups]);

  // ── Build edges (sequential within each lane) ─────────────────────
  const flowEdges: Edge[] = useMemo(() => {
    const result: Edge[] = [];
    const { groups, sceneOrder } = sceneGroups;

    for (const sceneId of sceneOrder) {
      const nodes = groups[sceneId];
      for (let i = 0; i < nodes.length - 1; i++) {
        result.push({
          id: `e-${nodes[i].node_id}-${nodes[i + 1].node_id}`,
          source: nodes[i].node_id,
          target: nodes[i + 1].node_id,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#c8c4be', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#c8c4be', width: 12, height: 12 },
        });
      }
    }

    return result;
  }, [sceneGroups]);

  // ── Selected node data ────────────────────────────────────────────
  const selectedNode = useMemo(
    () => storyboardNodes.find((n) => n.node_id === selectedNodeId) || null,
    [storyboardNodes, selectedNodeId],
  );

  // ── Handlers ──────────────────────────────────────────────────────
  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      setContextMenu({
        x: (event as unknown as ReactMouseEvent).clientX,
        y: (event as unknown as ReactMouseEvent).clientY,
        nodeId: node.id,
      });
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      setSelectedNodeIds(selectedNodes.map((n) => n.id));
    },
    [],
  );

  const handleNodeUpdate = useCallback(
    (updated: StoryboardNodeType) => {
      const newNodes = storyboardNodes.map((n) =>
        n.node_id === updated.node_id ? updated : n,
      );
      onNodesChange(newNodes);
    },
    [storyboardNodes, onNodesChange],
  );

  const handleBatchEditEmotion = useCallback(
    (emotionTag: string) => {
      const newNodes = storyboardNodes.map((n) =>
        selectedNodeIds.includes(n.node_id)
          ? { ...n, emotion_tag: emotionTag }
          : n,
      );
      onNodesChange(newNodes);
      setSelectedNodeIds([]);
    },
    [storyboardNodes, selectedNodeIds, onNodesChange],
  );

  const handleBatchEditMusic = useCallback(
    (musicMood: string) => {
      const newNodes = storyboardNodes.map((n) =>
        selectedNodeIds.includes(n.node_id)
          ? { ...n, music_mood: musicMood }
          : n,
      );
      onNodesChange(newNodes);
      setSelectedNodeIds([]);
    },
    [storyboardNodes, selectedNodeIds, onNodesChange],
  );

  // ── Render lane labels ────────────────────────────────────────────
  const laneLabels = useMemo(() => {
    const { groups, sceneOrder } = sceneGroups;
    let y = START_Y + (LANE_HEIGHT - 120) / 2;
    return sceneOrder.map((sceneId, idx) => {
      const label = (
        <LaneLabel
          key={`lane-${sceneId}`}
          sceneId={sceneId}
          nodeCount={groups[sceneId].length}
          y={y}
        />
      );
      y += LANE_HEIGHT + LANE_GAP_Y;
      return label;
    });
  }, [sceneGroups]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="flex h-full" onClick={handleCloseContextMenu}>
      {/* Main editor area */}
      <div className="flex-1 relative min-w-0">
        {/* Batch edit toolbar */}
        <div className="absolute top-3 left-3 z-10">
          <BatchEditPanel
            selectedCount={selectedNodeIds.length}
            onBatchEditEmotion={handleBatchEditEmotion}
            onBatchEditMusic={handleBatchEditMusic}
            onClearSelection={() => setSelectedNodeIds([])}
          />
        </div>

        <div className="h-full w-full" style={{ minHeight: 500 }}>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            onNodeContextMenu={handleNodeContextMenu}
            onSelectionChange={handleSelectionChange}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.3}
            maxZoom={2}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            deleteKeyCode={['Backspace', 'Delete']}
            multiSelectionKeyCode="Shift"
            selectionOnDrag
            panOnDrag={[1, 2]}
            selectNodesOnDrag
          >
            <Controls
              position="bottom-right"
              className="[&>button]:!bg-canvas [&>button]:!border-hairline [&>button]:!text-charcoal [&>button]:!rounded-md"
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#e5e3df"
            />
          </ReactFlow>
        </div>

        {/* Lane labels (overlay) */}
        <div className="absolute inset-0 pointer-events-none" style={{ top: 0, left: 0 }}>
          {laneLabels}
        </div>

        {/* Context menu */}
        {contextMenu && (
          <NodeContextMenu
            menu={contextMenu}
            onClose={handleCloseContextMenu}
            onInsertBefore={() => onInsertNode(contextMenu.nodeId, true)}
            onInsertAfter={() => onInsertNode(contextMenu.nodeId, false)}
            onDelete={() => onDeleteNode(contextMenu.nodeId)}
            onSplit={() => onSplitNode(contextMenu.nodeId)}
          />
        )}
      </div>

      {/* Detail panel */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          sceneName={selectedNode.scene_id}
          onChange={handleNodeUpdate}
          onClose={() => setSelectedNodeId(null)}
          onVersionHistory={() => onVersionHistory(selectedNode.node_id)}
        />
      )}
    </div>
  );
}
