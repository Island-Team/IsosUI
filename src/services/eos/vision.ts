const ORIGIN = typeof ISOSUI_EOS_API_ORIGIN === 'undefined' ? 'http://127.0.0.1:16020' : ISOSUI_EOS_API_ORIGIN;
const BASE = `${ORIGIN}/api/eos/v2/vision`;
const MAX_FRAME_BYTES = 4_000_000;

export interface VisionGate { path: string; label?: string; output_port?: string; source_path?: string; source_rate_hz?: number }
export interface VisionGates { revision: string; gates: VisionGate[] }
export interface VisionFrameMetadata { gate_path: string; sequence?: number; timestamp_unix_ms?: number; width_px: number; height_px: number; source_rate_hz?: number }
export interface VisionFrame { metadata: VisionFrameMetadata; jpeg: Blob }
export interface VisionSubscription { op: 'subscribe'; gate_path: string; revision: string; target_fps?: number; max_width_px?: number; jpeg_quality?: number }
type LoopbackRequestInit = RequestInit & { targetAddressSpace?: 'loopback' };

export async function getVisionGates(): Promise<VisionGates> {
  const options: LoopbackRequestInit = { credentials: 'omit', cache: 'no-store', mode: 'cors', targetAddressSpace: 'loopback', signal: AbortSignal.timeout(4000) };
  const response = await fetch(`${BASE}/gates`, options);
  if (!response.ok) throw new Error(`EOS Vision discovery failed (${response.status}).`);
  const body = await response.json() as VisionGates;
  if (!body || typeof body.revision !== 'string' || !Array.isArray(body.gates)) throw new Error('EOS returned an invalid Vision gate catalog.');
  return body;
}

export function visionSocketUrl(): string {
  const url = new URL(`${BASE}/ws`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/** LE length-prefixed metadata followed by a JPEG body; reject oversized or malformed frames. */
export function decodeVisionFrame(buffer: ArrayBuffer): VisionFrame {
  if (buffer.byteLength < 8 || buffer.byteLength > MAX_FRAME_BYTES) throw new Error('Vision frame exceeds display limits.');
  const metadataLength = new DataView(buffer).getUint32(0, true);
  if (metadataLength < 2 || metadataLength > 16_384 || metadataLength + 6 > buffer.byteLength) throw new Error('Invalid Vision frame metadata length.');
  const metadata = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, metadataLength))) as VisionFrameMetadata;
  if (!metadata || typeof metadata.gate_path !== 'string' || !Number.isInteger(metadata.width_px) || !Number.isInteger(metadata.height_px) || metadata.width_px < 1 || metadata.height_px < 1 || metadata.width_px > 4096 || metadata.height_px > 4096) throw new Error('Invalid Vision frame dimensions.');
  const jpeg = new Uint8Array(buffer, 4 + metadataLength);
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[jpeg.length - 2] !== 0xff || jpeg[jpeg.length - 1] !== 0xd9) throw new Error('Invalid Vision JPEG payload.');
  return { metadata, jpeg: new Blob([jpeg], { type: 'image/jpeg' }) };
}
