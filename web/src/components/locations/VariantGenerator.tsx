import { useState } from 'react';
import { Loader2, Check, ImageIcon } from 'lucide-react';
import { generateLocationVariant, confirmLocationVariant } from '../../api/locations';
import { Button } from '../ui/Button';
import type { Location, LocationVariant } from '../../types';

const TIME_OPTIONS = [
  { key: 'day', label: '日间' },
  { key: 'night', label: '夜晚' },
  { key: 'dusk', label: '黄昏' },
];

const WEATHER_OPTIONS = [
  { key: 'sunny', label: '晴天' },
  { key: 'rainy', label: '雨天' },
  { key: 'cloudy', label: '阴天' },
];

interface VariantState {
  enabled: boolean;
  generating: boolean;
  error: string | null;
  preview: { url: string; seed: number; prompt: string } | null;
  confirming: boolean;
  confirmError: string | null;
}

interface VariantGeneratorProps {
  projectId: string;
  location: Location;
  onUpdated: (location: Location) => void;
}

export function VariantGenerator({ projectId, location, onUpdated }: VariantGeneratorProps) {
  const [states, setStates] = useState<Record<string, VariantState>>({});

  const getState = (timeOfDay: string, weather: string): VariantState => {
    const key = `${timeOfDay}-${weather}`;
    return states[key] ?? { enabled: true, generating: false, error: null, preview: null, confirming: false, confirmError: null };
  };

  const updateState = (timeOfDay: string, weather: string, patch: Partial<VariantState>) => {
    const key = `${timeOfDay}-${weather}`;
    setStates((prev) => ({ ...prev, [key]: { ...getState(timeOfDay, weather), ...patch } }));
  };

  const getExistingVariant = (timeOfDay: string, weather: string): LocationVariant | undefined => {
    const key = `${timeOfDay}-${weather}`;
    return location.variants[key];
  };

  const handleGenerate = async (timeOfDay: string, weather: string) => {
    updateState(timeOfDay, weather, { generating: true, error: null, preview: null });
    try {
      const result = await generateLocationVariant(projectId, location.id, {
        time_of_day: timeOfDay,
        weather,
      });
      updateState(timeOfDay, weather, { generating: false, preview: result.data });
    } catch (err) {
      updateState(timeOfDay, weather, {
        generating: false,
        error: err instanceof Error ? err.message : '生成失败',
      });
    }
  };

  const handleConfirm = async (timeOfDay: string, weather: string) => {
    const state = getState(timeOfDay, weather);
    if (!state.preview) return;
    updateState(timeOfDay, weather, { confirming: true, confirmError: null });
    try {
      const response = await confirmLocationVariant(projectId, location.id, {
        time_of_day: timeOfDay,
        weather,
        variant: state.preview,
      });
      onUpdated(response.data);
      updateState(timeOfDay, weather, {
        confirming: false,
        preview: null,
        enabled: true,
      });
    } catch (err) {
      updateState(timeOfDay, weather, {
        confirming: false,
        confirmError: err instanceof Error ? err.message : '确认失败',
      });
    }
  };

  const handleCancel = (timeOfDay: string, weather: string) => {
    updateState(timeOfDay, weather, { preview: null, error: null, confirmError: null });
  };

  const hasBaseSeed = Boolean(location.base_seed);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-ink">场景变体</h3>
        <p className="text-sm text-slate">
          为不同时间段和天气生成变体图。变体基于基准 Seed 计算偏移，确保空间一致。
          {!hasBaseSeed && (
            <span className="ml-1 font-medium text-semantic-warning">
              请先生成基准图后再生成变体。
            </span>
          )}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-canvas">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline bg-surface-soft">
              <th className="p-3 text-left font-medium text-slate">时间段 / 天气</th>
              {WEATHER_OPTIONS.map((w) => (
                <th key={w.key} className="p-3 text-center font-medium text-slate">
                  {w.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_OPTIONS.map((time) => (
              <tr key={time.key} className="border-b border-hairline last:border-b-0">
                <td className="p-3 font-medium text-ink">{time.label}</td>
                {WEATHER_OPTIONS.map((weather) => {
                  const key = `${time.key}-${weather.key}`;
                  const existing = getExistingVariant(time.key, weather.key);
                  const state = getState(time.key, weather.key);

                  return (
                    <td key={key} className="p-3 text-center">
                      {existing ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="h-16 w-24 overflow-hidden rounded-md bg-surface">
                            <img
                              src={existing.image_url}
                              alt={`${time.label} ${weather.label}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span className="text-xs text-steel">Seed: {existing.seed}</span>
                        </div>
                      ) : state.preview ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-16 w-24 overflow-hidden rounded-md bg-surface">
                            <img
                              src={state.preview.url}
                              alt={`预览 ${time.label} ${weather.label}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <span className="text-xs text-steel">Seed: {state.preview.seed}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleConfirm(time.key, weather.key)}
                              disabled={state.confirming}
                              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-xs text-white hover:bg-primary-pressed disabled:opacity-50"
                            >
                              {state.confirming ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              确认
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancel(time.key, weather.key)}
                              disabled={state.confirming}
                              className="rounded-md border border-hairline-strong px-2 py-0.5 text-xs text-slate hover:bg-surface disabled:opacity-50"
                            >
                              取消
                            </button>
                          </div>
                          {state.confirmError ? (
                            <p className="text-xs text-semantic-error">{state.confirmError}</p>
                          ) : null}
                        </div>
                      ) : state.error ? (
                        <div className="text-xs">
                          <p className="text-semantic-error">{state.error}</p>
                          <button
                            type="button"
                            onClick={() => handleGenerate(time.key, weather.key)}
                            className="mt-1 text-link-blue hover:underline"
                          >
                            重试
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Button
                            variant="ghost"
                            onClick={() => handleGenerate(time.key, weather.key)}
                            disabled={state.generating || !hasBaseSeed}
                            className="gap-1 px-2 py-1 text-xs"
                          >
                            {state.generating ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                生成中
                              </>
                            ) : (
                              <>
                                <ImageIcon className="h-3 w-3" />
                                生成
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
