/**
 * Company: EonHive Inc.
 * Title: Loading Adapter
 * Purpose: Track staged loading progress and expose a small observable API.
 * Author: Stan Nesi
 * Created: 2026-04-12
 * Updated: 2026-04-15
 * Notes: Vibe coded with Codex.
 */

import type { AdapterRegistration } from '@urk/core';

export interface LoadingStage {
  id: string;
  label: string;
  weight?: number;
}

export interface LoadingSnapshot {
  active: boolean;
  complete: boolean;
  progress: number;
  message: string;
  stageId: string | null;
  stageLabel: string | null;
  stages: LoadingStage[];
  updatedAt: number;
}

export type LoadingListener = (snapshot: LoadingSnapshot) => void;

export interface LoadingAdapterApi {
  begin(stages: LoadingStage[], message?: string): LoadingSnapshot;
  setStage(stageId: string, progressWithinStage: number, message?: string): LoadingSnapshot;
  complete(message?: string): LoadingSnapshot;
  getSnapshot(): LoadingSnapshot;
  subscribe(listener: LoadingListener): () => void;
}

function normalizeStages(stages: LoadingStage[]): LoadingStage[] {
  if (stages.length === 0) {
    throw new Error('Loading adapter requires at least one stage.');
  }

  return stages.map((stage) => ({
    ...stage,
    weight: stage.weight && stage.weight > 0 ? stage.weight : 1,
  }));
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(progress, 1));
}

function createEmptySnapshot(): LoadingSnapshot {
  return {
    active: false,
    complete: false,
    progress: 0,
    message: 'Waiting to start',
    stageId: null,
    stageLabel: null,
    stages: [],
    updatedAt: Date.now(),
  };
}

export function createLoadingAdapter(
  id = 'loading-adapter',
): AdapterRegistration<LoadingAdapterApi> {
  return {
    id,
    capability: 'loading',
    setup(ctx) {
      let snapshot = createEmptySnapshot();
      const listeners = new Set<LoadingListener>();

      const publish = (): LoadingSnapshot => {
        const next = { ...snapshot, stages: [...snapshot.stages] };

        ctx.events.emit({
          type: 'loading:changed',
          source: id,
          payload: next,
          timestamp: Date.now(),
        });

        for (const listener of [...listeners]) {
          listener(next);
        }

        return next;
      };

      const getTotalWeight = (): number => {
        return snapshot.stages.reduce((total, stage) => total + (stage.weight ?? 1), 0);
      };

      return {
        begin(stages, message = 'Starting load') {
          const nextStages = normalizeStages(stages);
          const firstStage = nextStages[0];

          snapshot = {
            active: true,
            complete: false,
            progress: 0,
            message,
            stageId: firstStage.id,
            stageLabel: firstStage.label,
            stages: nextStages,
            updatedAt: Date.now(),
          };

          return publish();
        },
        setStage(stageId, progressWithinStage, message) {
          const stageIndex = snapshot.stages.findIndex((stage) => stage.id === stageId);

          if (stageIndex === -1) {
            throw new Error(`Unknown loading stage: ${stageId}`);
          }

          const previousWeight = snapshot.stages
            .slice(0, stageIndex)
            .reduce((total, stage) => total + (stage.weight ?? 1), 0);
          const currentStage = snapshot.stages[stageIndex];
          const totalWeight = getTotalWeight();
          const progress =
            (previousWeight + (currentStage.weight ?? 1) * clampProgress(progressWithinStage)) /
            totalWeight;

          snapshot = {
            ...snapshot,
            active: true,
            progress,
            message: message ?? snapshot.message,
            stageId: currentStage.id,
            stageLabel: currentStage.label,
            updatedAt: Date.now(),
          };

          return publish();
        },
        complete(message = 'Loading complete') {
          const lastStage = snapshot.stages[snapshot.stages.length - 1] ?? null;

          snapshot = {
            ...snapshot,
            active: false,
            complete: true,
            progress: 1,
            message,
            stageId: lastStage?.id ?? null,
            stageLabel: lastStage?.label ?? null,
            updatedAt: Date.now(),
          };

          return publish();
        },
        getSnapshot() {
          return { ...snapshot, stages: [...snapshot.stages] };
        },
        subscribe(listener) {
          listeners.add(listener);

          return () => {
            listeners.delete(listener);
          };
        },
      };
    },
  };
}
