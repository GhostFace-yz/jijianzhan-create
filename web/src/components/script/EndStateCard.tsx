import { AlertTriangle, Smile, MapPin } from 'lucide-react';
import type { EndState } from '../../types';

export interface EndStateCardProps {
  endState: EndState;
}

/**
 * Displays the end state of an episode:
 * character emotional/location states, unresolved conflicts, key prop states.
 */
export function EndStateCard({ endState }: EndStateCardProps) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas shadow-sm p-5">
      <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-card-tint-lavender">
          <MapPin className="h-3.5 w-3.5 text-primary" />
        </span>
        本集结尾状态
      </h3>

      <div className="space-y-4">
        {/* Character states */}
        {endState.character_states.length > 0 && (
          <div>
            <label className="text-xs font-medium text-slate uppercase tracking-wider">
              角色状态
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {endState.character_states.map((cs) => (
                <div
                  key={cs.char_id}
                  className="rounded-lg border border-hairline-soft bg-surface-soft p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">{cs.char_id}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-charcoal">
                      <Smile className="h-3 w-3" />
                      {cs.emotion}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    <MapPin className="h-3 w-3 inline mr-0.5" />
                    {cs.location}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unresolved conflicts */}
        {endState.unresolved_conflicts.length > 0 && (
          <div>
            <label className="text-xs font-medium text-slate uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-semantic-warning" />
              未解决冲突
            </label>
            <ul className="mt-2 space-y-1">
              {endState.unresolved_conflicts.map((conflict, i) => (
                <li key={i} className="text-sm text-charcoal flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-semantic-warning shrink-0" />
                  {conflict}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key prop states */}
        {Object.keys(endState.key_prop_states).length > 0 && (
          <div>
            <label className="text-xs font-medium text-slate uppercase tracking-wider">
              关键道具状态
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {Object.entries(endState.key_prop_states).map(([prop, state]) => (
                <div
                  key={prop}
                  className="rounded-lg border border-hairline-soft bg-surface-soft p-2.5 flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-ink">{prop}</span>
                  <span className="text-xs text-steel">{state}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {endState.character_states.length === 0 &&
          endState.unresolved_conflicts.length === 0 &&
          Object.keys(endState.key_prop_states).length === 0 && (
            <p className="text-sm text-muted italic">暂无结尾状态数据</p>
          )}
      </div>
    </div>
  );
}
