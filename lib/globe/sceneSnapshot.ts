/**
 * Scene Snapshots — Serialize/deserialize globe state for bookmarkable URLs.
 *
 * Captures focused node IDs, color overrides, camera position/target,
 * rotation angle, and active effect layers. Encoded as base64url for URL safety.
 */

// ---------------------------------------------------------------------------
// Serializable snapshot structure
// ---------------------------------------------------------------------------

interface SceneSnapshotData {
  /** Focused node IDs */
  f: string[];
  /** Color overrides as [id, hex][] */
  c: [string, string][];
  /** Camera position [x, y, z] */
  cp: [number, number, number];
  /** Camera target [x, y, z] */
  ct: [number, number, number];
  /** Zoom distance */
  d: number;
  /** Active layer IDs */
  l: string[];
  /** Scan progress (0-1) */
  sp: number;
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

export function serializeSnapshot(params: {
  focusedIds: Set<string>;
  colorOverrides: Map<string, string> | null;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  zoomDistance: number;
  scanProgress?: number;
  activeLayers?: string[];
}): string {
  const data: SceneSnapshotData = {
    f: Array.from(params.focusedIds),
    c: params.colorOverrides ? Array.from(params.colorOverrides.entries()) : [],
    cp: params.cameraPosition.map((v) => Math.round(v * 100) / 100) as [number, number, number],
    ct: params.cameraTarget.map((v) => Math.round(v * 100) / 100) as [number, number, number],
    d: Math.round(params.zoomDistance * 100) / 100,
    l: params.activeLayers ?? [],
    sp: Math.round((params.scanProgress ?? 0) * 100) / 100,
  };

  const json = JSON.stringify(data);
  // Base64url encode (URL-safe variant)
  if (typeof btoa === 'function') {
    return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return Buffer.from(json).toString('base64url');
}

// ---------------------------------------------------------------------------
// Deserialize
// ---------------------------------------------------------------------------

export interface DeserializedSnapshot {
  focusedIds: Set<string>;
  colorOverrides: Map<string, string>;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  zoomDistance: number;
  scanProgress: number;
  activeLayers: string[];
}

export function deserializeSnapshot(encoded: string): DeserializedSnapshot | null {
  try {
    // Restore base64url padding
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    let json: string;
    if (typeof atob === 'function') {
      json = atob(padded);
    } else {
      json = Buffer.from(padded, 'base64').toString('utf-8');
    }

    const data = JSON.parse(json) as SceneSnapshotData;

    return {
      focusedIds: new Set(data.f),
      colorOverrides: new Map(data.c),
      cameraPosition: data.cp,
      cameraTarget: data.ct,
      zoomDistance: data.d,
      scanProgress: data.sp,
      activeLayers: data.l,
    };
  } catch {
    return null;
  }
}
