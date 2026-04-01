/**
 * ConstellationCommands — extracted imperative API for the globe component.
 *
 * This module contains all 19 ConstellationRef methods that were previously
 * defined inline in GlobeConstellation's useImperativeHandle block (~735 lines).
 * The factory function receives a deps bag containing all refs, state, and
 * setters that the methods close over.
 */

import type CameraControls from 'camera-controls';
import type { ConstellationRef, SceneState } from '@/lib/globe/types';
import { DEFAULT_FOCUS, DEFAULT_ROTATION_SPEED } from '@/lib/globe/types';
import type { ConstellationNode3D, FindMeTarget } from '@/lib/constellation/types';
import { rotateAroundY, sleep } from '@/lib/globe/helpers';

// ---------------------------------------------------------------------------
// Dependency bag — everything the imperative methods close over
// ---------------------------------------------------------------------------

export interface CommandDeps {
  cameraControlsRef: React.RefObject<CameraControls | null>;
  rotationAngleRef: React.MutableRefObject<number>;
  rotationSpeedRef: React.MutableRefObject<number>;
  cinematicRef: React.MutableRefObject<{
    orbitSpeed: number;
    dollyTarget: number;
    dimTarget: number;
    transitionDuration: number;
    active: boolean;
  }>;
  engineActiveRef: React.MutableRefObject<boolean>;
  /** Ref to current scene state — avoids stale closure captures */
  sceneStateRef: React.MutableRefObject<SceneState>;
  setSceneState: React.Dispatch<React.SetStateAction<SceneState>>;
  setCinematicOrbitSpeed: (v: number) => void;
  setCinematicDollyTarget: (v: number) => void;
  effectiveCamera: [number, number, number];
  effectiveTarget: [number, number, number];
  onNodeSelectRef: React.RefObject<((node: ConstellationNode3D) => void) | undefined>;
  onContracted?: () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createConstellationCommands(deps: CommandDeps): ConstellationRef {
  const {
    cameraControlsRef,
    rotationAngleRef,
    rotationSpeedRef,
    cinematicRef,
    engineActiveRef,
    sceneStateRef,
    setSceneState,
    setCinematicDollyTarget,
    effectiveCamera,
    effectiveTarget,
    onNodeSelectRef,
    onContracted,
  } = deps;

  // Helper: always read current state from the ref (avoids stale closures)
  const getState = () => sceneStateRef.current;

  // --- flyToNode implementation (shared by flyToNode and findMe) ---
  const flyToNodeImpl = async (nodeId: string): Promise<ConstellationNode3D | null> => {
    const controls = cameraControlsRef.current;
    if (!controls || getState().nodes.length === 0) return null;

    const node = getState().nodes.find((n) => n.id === nodeId || n.fullId === nodeId);
    if (!node) return null;

    setSceneState((prev) => ({
      ...prev,
      animating: true,
      focus: {
        ...DEFAULT_FOCUS,
        active: true,
        focusedIds: new Set([node.id]),
        intensities: new Map([[node.id, 1.0]]),
      },
    }));

    const [x, y, z] = rotateAroundY(node.position, rotationAngleRef.current);
    await controls.setLookAt(x * 1.5, y * 1.5, z * 1.5 + 3, x, y, z, true);

    setSceneState((prev) => ({ ...prev, animating: false }));
    onNodeSelectRef.current?.(node);
    return node;
  };

  return {
    findMe: async (target: FindMeTarget) => {
      const controls = cameraControlsRef.current;
      if (!controls || getState().nodes.length === 0) return;
      setSceneState((prev) => ({ ...prev, animating: true }));

      if (target.type === 'undelegated') {
        const edgePos: [number, number, number] = [7, -4, 2];
        setSceneState((prev) => ({
          ...prev,
          focus: {
            ...DEFAULT_FOCUS,
            active: true,
            focusedIds: new Set(['__user__']),
            intensities: new Map([['__user__', 1.0]]),
          },
          nodes: [
            ...prev.nodes,
            {
              id: '__user__',
              fullId: '__user__',
              name: 'You',
              power: 0,
              score: 50,
              dominant: 'transparency',
              alignments: [50, 50, 50, 50, 50, 50],
              position: edgePos,
              scale: 0.08,
              nodeType: 'drep',
            },
          ],
        }));
        const rotated = rotateAroundY(edgePos, rotationAngleRef.current);
        await controls.setLookAt(rotated[0], rotated[1], 16, rotated[0], rotated[1], 0, true);
        await sleep(2000);
        setSceneState((prev) => ({ ...prev, animating: false }));
        onContracted?.();
        return;
      }

      const drepId = target.drepId;
      if (!drepId) {
        setSceneState((prev) => ({ ...prev, animating: false }));
        onContracted?.();
        return;
      }

      const node = getState().nodeMap.get(drepId);
      if (!node) {
        setSceneState((prev) => ({ ...prev, animating: false }));
        onContracted?.();
        return;
      }

      setSceneState((prev) => ({
        ...prev,
        focus: {
          ...DEFAULT_FOCUS,
          active: true,
          focusedIds: new Set([drepId]),
          intensities: new Map([[drepId, 1.0]]),
        },
      }));

      const [x, y, z] = rotateAroundY(node.position, rotationAngleRef.current);
      await controls.setLookAt(x * 1.5, y * 1.5, z * 1.5 + 3, x, y, z, true);
      await sleep(2000);

      setSceneState((prev) => ({ ...prev, focus: { ...DEFAULT_FOCUS } }));
      await controls.setLookAt(...effectiveCamera, ...effectiveTarget, true);
      await sleep(800);
      setSceneState((prev) => ({ ...prev, animating: false }));
      onContracted?.();
    },

    flyToNode: flyToNodeImpl,

    pulseNode: (drepId: string) => {
      setSceneState((prev) => ({ ...prev, pulseId: drepId }));
      setTimeout(() => setSceneState((prev) => ({ ...prev, pulseId: null })), 1200);
    },

    resetCamera: () => {
      cameraControlsRef.current?.setLookAt(...effectiveCamera, ...effectiveTarget, true);
      setSceneState((prev) => ({
        ...prev,
        focus: { ...DEFAULT_FOCUS },
        animating: false,
        voteSplitMap: null,
        temporalProgress: 0,
        temporalVoteMap: new Map(),
        temporalActive: false,
      }));
      rotationSpeedRef.current = DEFAULT_ROTATION_SPEED;
    },

    highlightMatches: (userAlignment, threshold, options) => {
      if (engineActiveRef.current) return;

      const matched = new Set<string>();
      const intensities = new Map<string, number>();
      const scored: Array<{ id: string; distance: number }> = [];

      for (const node of getState().nodes) {
        if (options?.nodeTypeFilter && node.nodeType !== options.nodeTypeFilter) continue;
        if (options?.drepOnly && node.nodeType !== 'drep') continue;
        let sumSq = 0;
        for (let d = 0; d < 6; d++) {
          const diff = (userAlignment[d] ?? 50) - (node.alignments[d] ?? 50);
          sumSq += diff * diff;
        }
        scored.push({ id: node.id, distance: Math.sqrt(sumSq) });
      }

      const intermediateIds = new Map<string, number>();
      const activationDelays = new Map<string, number>();

      if (options?.topN && options.topN > 0) {
        scored.sort((a, b) => a.distance - b.distance);
        const maxDist = scored[Math.min(options.topN, scored.length) - 1]?.distance ?? 1;
        for (let i = 0; i < Math.min(options.topN, scored.length); i++) {
          matched.add(scored[i].id);
          intensities.set(scored[i].id, Math.max(0.2, 1 - scored[i].distance / (maxDist * 1.2)));
        }

        const maybeEnd = Math.min(options.topN * 2, scored.length);
        for (let i = options.topN; i < maybeEnd; i++) {
          const level = 0.1 + 0.4 * (1 - (i - options.topN) / (maybeEnd - options.topN));
          intermediateIds.set(scored[i].id, level);
        }

        const SWEEP_DURATION = 0.6;
        let scx = 0,
          scy = 0,
          scz = 0,
          scount = 0;
        for (let i = 0; i < Math.min(options.topN, scored.length); i++) {
          const node = getState().nodes.find((n) => n.id === scored[i].id);
          if (node) {
            scx += node.position[0];
            scy += node.position[1];
            scz += node.position[2];
            scount++;
          }
        }
        if (scount > 0) {
          scx /= scount;
          scy /= scount;
          scz /= scount;
        }

        let maxSpatialDist = 0;
        const spatialDists: number[] = [];
        for (let i = 0; i < scored.length; i++) {
          const node = getState().nodes.find((n) => n.id === scored[i].id);
          if (node) {
            const dx = node.position[0] - scx,
              dy = node.position[1] - scy,
              dz = node.position[2] - scz;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            spatialDists[i] = d;
            if (d > maxSpatialDist) maxSpatialDist = d;
          } else {
            spatialDists[i] = maxSpatialDist;
          }
        }
        for (let i = 0; i < scored.length; i++) {
          const normalizedDist = maxSpatialDist > 0 ? spatialDists[i] / maxSpatialDist : 0;
          activationDelays.set(scored[i].id, normalizedDist * SWEEP_DURATION);
        }
      } else {
        for (const s of scored) {
          if (s.distance < threshold) {
            matched.add(s.id);
            intensities.set(s.id, Math.max(0, Math.min(1, 1 - s.distance / threshold)));
          }
        }
      }

      const scanProgress =
        options?.scanProgressOverride ?? Math.max(0, Math.min(1, (160 - threshold) / 125));

      setSceneState((prev) => ({
        ...prev,
        focus: {
          ...DEFAULT_FOCUS,
          active: matched.size > 0 || prev.focus.active,
          focusedIds: matched,
          intensities,
          scanProgress,
          colorOverrides: null,
          nodeTypeFilter: options?.drepOnly
            ? 'drep'
            : (options?.nodeTypeFilter ?? prev.focus.nodeTypeFilter),
          activationDelays: activationDelays.size > 0 ? activationDelays : null,
          intermediateIds: intermediateIds.size > 0 ? intermediateIds : null,
        },
      }));

      if (options?.noZoom) return;

      if (options?.zoomToCluster && matched.size > 0 && cameraControlsRef.current) {
        let cx = 0,
          cy = 0,
          cz = 0,
          count = 0;
        for (const node of getState().nodes) {
          if (matched.has(node.id)) {
            const [rx, ry, rz] = rotateAroundY(node.position, rotationAngleRef.current);
            cx += rx;
            cy += ry;
            cz += rz;
            count++;
          }
        }
        if (count > 0) {
          cx /= count;
          cy /= count;
          cz /= count;
          const dir = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
          const nx = cx / dir,
            ny = cy / dir,
            nz = cz / dir;

          const sp = options?.scanProgressOverride ?? 0;
          rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * Math.max(0.05, 0.4 - sp * 0.35);
          const camDist = 4 + 9 * Math.pow(1 - sp, 2.2);

          let camX = nx * camDist;
          let camY = ny * camDist + 1.5;
          let camZ = nz * camDist;

          if (options?.cameraAngle) {
            const cos = Math.cos(options.cameraAngle);
            const sin = Math.sin(options.cameraAngle);
            const rx = camX * cos - camZ * sin;
            const rz = camX * sin + camZ * cos;
            camX = rx;
            camZ = rz;
          }
          if (options?.cameraElevation) {
            camY += camDist * Math.sin(options.cameraElevation);
          }

          const controls = cameraControlsRef.current;
          controls.smoothTime = Math.max(0.8, 1.5 - sp * 0.8);
          controls.setLookAt(camX, camY, camZ, cx * 0.7, cy * 0.7, cz * 0.7, true);
          setCinematicDollyTarget(camDist);
          setTimeout(() => {
            if (cameraControlsRef.current) cameraControlsRef.current.smoothTime = 0.8;
          }, 1500);
        }
        return;
      }

      if (matched.size > 0 && cameraControlsRef.current) {
        let cx = 0,
          cy = 0,
          cz = 0,
          count = 0;
        for (const node of getState().nodes) {
          if (matched.has(node.id)) {
            const [rx, ry, rz] = rotateAroundY(node.position, rotationAngleRef.current);
            cx += rx;
            cy += ry;
            cz += rz;
            count++;
          }
        }
        if (count > 0) {
          cx /= count;
          cy /= count;
          cz /= count;
          const zoomFactor = Math.max(0, Math.min(1, (160 - threshold) / 125));
          rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * (1 - zoomFactor * 0.85);
          const camDist = 14 - zoomFactor * 6;
          const lookWeight = 0.4 + zoomFactor * 0.5;
          const dir = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
          const nx = cx / dir,
            ny = cy / dir,
            nz = cz / dir;
          cameraControlsRef.current.setLookAt(
            nx * camDist * lookWeight,
            ny * camDist * lookWeight + (3 - zoomFactor * 1.5),
            nz * camDist * (1 - lookWeight * 0.3) + camDist * 0.5,
            cx * lookWeight,
            cy * lookWeight,
            cz * lookWeight,
            true,
          );
        }
      }
    },

    flyToMatch: async (drepId: string) => {
      const node = getState().nodes.find((n) => n.id === drepId || n.fullId === drepId);
      if (!node || !cameraControlsRef.current) return;

      rotationSpeedRef.current = 0;
      const [x, y, z] = rotateAroundY(node.position, rotationAngleRef.current);
      const dist = Math.sqrt(x * x + y * y + z * z);
      const nx = dist > 0 ? x / dist : 0;
      const ny = dist > 0 ? y / dist : 0;
      const nz = dist > 0 ? z / dist : 1;

      setSceneState((prev) => {
        const newFocusedIds = new Set(prev.focus.focusedIds);
        newFocusedIds.add(drepId);
        const newIntensities = new Map(prev.focus.intensities);
        newIntensities.set(drepId, 1.0);
        const newColors = new Map(prev.focus.colorOverrides ?? []);
        newColors.set(drepId, '#fbbf24');
        return {
          ...prev,
          pulseId: drepId,
          animating: true,
          flyToTarget: [x, y, z],
          flyToActive: true,
          focus: {
            ...prev.focus,
            focusedIds: newFocusedIds,
            intensities: newIntensities,
            colorOverrides: newColors,
          },
        };
      });

      const camDist = Math.max(dist * 1.8, 8);
      const controls = cameraControlsRef.current;
      controls.smoothTime = 1.5;
      await controls.setLookAt(nx * camDist, ny * camDist, nz * camDist, x, y, z, true);
      controls.smoothTime = 0.4;

      if (cinematicRef.current) {
        cinematicRef.current.orbitSpeed = 0.003;
        cinematicRef.current.active = true;
      }

      await sleep(3000);

      if (cinematicRef.current) {
        cinematicRef.current.orbitSpeed = 0;
        cinematicRef.current.active = false;
      }

      setSceneState((prev) => ({
        ...prev,
        pulseId: null,
        animating: false,
        flyToActive: false,
      }));
    },

    matchStart: () => {
      if (engineActiveRef.current) return;

      const drepIds = new Set<string>();
      const intensities = new Map<string, number>();
      const activationDelays = new Map<string, number>();

      let maxDist = 0;
      const drepDistances: Array<{ id: string; dist: number }> = [];
      for (const node of getState().nodes) {
        if (node.nodeType === 'drep') {
          drepIds.add(node.id);
          intensities.set(node.id, 0.6);
          const [x, y, z] = node.position;
          const d = Math.sqrt(x * x + y * y + z * z);
          drepDistances.push({ id: node.id, dist: d });
          if (d > maxDist) maxDist = d;
        }
      }

      const WAVE_DURATION = 0.3;
      for (const { id, dist: d } of drepDistances) {
        const normalizedDist = maxDist > 0 ? d / maxDist : 0;
        activationDelays.set(id, normalizedDist * WAVE_DURATION);
      }

      setSceneState((prev) => ({
        ...prev,
        focus: {
          ...DEFAULT_FOCUS,
          active: true,
          focusedIds: drepIds,
          intensities,
          scanProgress: 0,
          colorOverrides: null,
          nodeTypeFilter: 'drep',
          activationDelays,
          intermediateIds: null,
        },
        flyToTarget: null,
        flyToActive: false,
      }));

      rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * 0.6;
      if (cameraControlsRef.current) {
        cameraControlsRef.current.setLookAt(-2, 1.5, 15, -1, 0, 0, true);
      }
      setCinematicDollyTarget(15);
    },

    clearMatches: () => {
      setSceneState((prev) => ({
        ...prev,
        focus: { ...DEFAULT_FOCUS },
        flyToTarget: null,
        flyToActive: false,
        voteSplitMap: null,
        temporalProgress: 0,
        temporalVoteMap: new Map(),
        temporalActive: false,
      }));
      rotationSpeedRef.current = DEFAULT_ROTATION_SPEED;
      cameraControlsRef.current?.setLookAt(...effectiveCamera, ...effectiveTarget, true);
    },

    setVoteSplit: (map) => {
      if (!map) {
        setSceneState((prev) => ({
          ...prev,
          voteSplitMap: null,
          focus: { ...DEFAULT_FOCUS },
        }));
        return;
      }
      const focusedIds = new Set<string>();
      const intensities = new Map<string, number>();
      const colorOverrides = new Map<string, string>();
      const VOTE_COLORS = { Yes: '#2dd4bf', No: '#ef4444', Abstain: '#9ca3af' };
      for (const [nodeId, vote] of map) {
        focusedIds.add(nodeId);
        intensities.set(nodeId, 1.0);
        colorOverrides.set(nodeId, VOTE_COLORS[vote]);
      }
      setSceneState((prev) => ({
        ...prev,
        voteSplitMap: map,
        focus: {
          ...DEFAULT_FOCUS,
          active: true,
          focusedIds,
          intensities,
          scanProgress: 0,
          colorOverrides,
          nodeTypeFilter: null,
          activationDelays: null,
          intermediateIds: null,
        },
      }));
    },

    setTemporalState: (progress, voteMap) => {
      const focusedIds = new Set<string>();
      const intensities = new Map<string, number>();
      const colorOverrides = new Map<string, string>();
      const VOTE_COLORS = { Yes: '#2dd4bf', No: '#ef4444', Abstain: '#9ca3af' };
      for (const [nodeId, vote] of voteMap) {
        focusedIds.add(nodeId);
        intensities.set(nodeId, 1.0);
        colorOverrides.set(nodeId, VOTE_COLORS[vote]);
      }
      setSceneState((prev) => ({
        ...prev,
        temporalProgress: progress,
        temporalVoteMap: voteMap,
        temporalActive: true,
        focus: {
          ...DEFAULT_FOCUS,
          active: true,
          focusedIds,
          intensities,
          scanProgress: 0,
          colorOverrides,
          nodeTypeFilter: null,
          activationDelays: null,
          intermediateIds: null,
        },
      }));
    },

    clearTemporal: () => {
      setSceneState((prev) => ({
        ...prev,
        temporalProgress: 0,
        temporalVoteMap: new Map(),
        temporalActive: false,
        focus: { ...DEFAULT_FOCUS },
      }));
    },

    dimAll: () => {
      setSceneState((prev) => ({
        ...prev,
        focus: { ...DEFAULT_FOCUS, active: true },
      }));
    },

    highlightNode: (nodeId) => {
      if (!nodeId) {
        setSceneState((prev) => ({ ...prev, focus: { ...DEFAULT_FOCUS } }));
        return;
      }
      setSceneState((prev) => ({
        ...prev,
        focus: {
          ...DEFAULT_FOCUS,
          active: true,
          focusedIds: new Set([nodeId]),
          intensities: new Map([[nodeId, 1.0]]),
        },
      }));
    },

    setRotationSpeed: (multiplier) => {
      rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * multiplier;
    },

    zoomToDistance: (distance) => {
      cameraControlsRef.current?.dollyTo(distance, true);
    },

    flashNode: (nodeId) => {
      setSceneState((prev) => {
        const newFocusedIds = new Set(prev.focus.focusedIds);
        newFocusedIds.add(nodeId);
        const newIntensities = new Map(prev.focus.intensities);
        newIntensities.set(nodeId, 1.0);
        const newColors = new Map(prev.focus.colorOverrides ?? []);
        newColors.set(nodeId, '#fbbf24');
        return {
          ...prev,
          pulseId: nodeId,
          focus: {
            ...prev.focus,
            focusedIds: newFocusedIds,
            intensities: newIntensities,
            colorOverrides: newColors,
          },
        };
      });
      setTimeout(() => setSceneState((prev) => ({ ...prev, pulseId: null })), 600);
    },

    setCinematicState: (state) => {
      const c = cinematicRef.current;
      if (state.orbitSpeed !== undefined) {
        c.orbitSpeed = state.orbitSpeed;
        deps.setCinematicOrbitSpeed(state.orbitSpeed);
      }
      if (state.dollyTarget !== undefined) {
        c.dollyTarget = state.dollyTarget;
        setCinematicDollyTarget(state.dollyTarget);
      }
      if (state.dimTarget !== undefined) c.dimTarget = state.dimTarget;
      if (state.transitionDuration !== undefined) c.transitionDuration = state.transitionDuration;
      c.active = true;
    },

    flyToPosition: async (target, options) => {
      const controls = cameraControlsRef.current;
      if (!controls) return;

      const [tx, ty, tz] = rotateAroundY(target, rotationAngleRef.current);
      const dist = options?.distance ?? 12;
      const len = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
      const camX = (tx / len) * dist;
      const camY = (ty / len) * dist + 1.5;
      const camZ = (tz / len) * dist;

      controls.smoothTime = options?.duration ?? 1.2;
      setSceneState((prev) => ({ ...prev, animating: true }));
      await controls.setLookAt(camX, camY, camZ, tx * 0.7, ty * 0.7, tz * 0.7, true);
      setCinematicDollyTarget(dist);
      setTimeout(
        () => {
          if (cameraControlsRef.current) cameraControlsRef.current.smoothTime = 0.8;
          setSceneState((prev) => ({ ...prev, animating: false }));
        },
        (options?.duration ?? 1.2) * 1000 + 200,
      );
    },

    narrowTo: (nodeIds, options) => {
      if (!nodeIds.length) return;

      const matched = new Set(nodeIds);
      const intensities = new Map<string, number>();
      let cx = 0,
        cy = 0,
        cz = 0,
        count = 0;

      for (const node of getState().nodes) {
        if (matched.has(node.id)) {
          intensities.set(node.id, 1.0);
          const [rx, ry, rz] = rotateAroundY(node.position, rotationAngleRef.current);
          cx += rx;
          cy += ry;
          cz += rz;
          count++;
        }
      }

      const dimOthers = options?.dimOthers ?? true;
      const sp = options?.scanProgress ?? 0.7;

      setSceneState((prev) => ({
        ...prev,
        focus: {
          ...DEFAULT_FOCUS,
          active: true,
          focusedIds: matched,
          intensities,
          scanProgress: dimOthers ? sp : 0,
        },
      }));

      const fly = options?.fly ?? true;
      if (fly && count > 0 && cameraControlsRef.current) {
        cx /= count;
        cy /= count;
        cz /= count;
        const dir = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
        const nx = cx / dir,
          ny = cy / dir,
          nz = cz / dir;

        rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * Math.max(0.05, 0.4 - sp * 0.35);
        const camDist = 4 + 9 * Math.pow(1 - sp, 2.2);
        let camX = nx * camDist;
        let camY = ny * camDist + 1.5;
        let camZ = nz * camDist;

        if (options?.cameraAngle) {
          const cos = Math.cos(options.cameraAngle);
          const sin = Math.sin(options.cameraAngle);
          const rx2 = camX * cos - camZ * sin;
          const rz2 = camX * sin + camZ * cos;
          camX = rx2;
          camZ = rz2;
        }
        if (options?.cameraElevation) {
          camY += camDist * Math.sin(options.cameraElevation);
        }

        const controls = cameraControlsRef.current;
        controls.smoothTime = Math.max(0.8, 1.5 - sp * 0.8);
        controls.setLookAt(camX, camY, camZ, cx * 0.7, cy * 0.7, cz * 0.7, true);
        setCinematicDollyTarget(camDist);
        setTimeout(() => {
          if (cameraControlsRef.current) cameraControlsRef.current.smoothTime = 0.8;
        }, 1500);
      }
    },
  };
}
