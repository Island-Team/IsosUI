import { describe, expect, it } from 'vitest';
import { decodeVisionFrame } from './vision';

function packet(metadata: unknown, body = [0xff, 0xd8, 0xff, 0xd9]): ArrayBuffer {
  const header = new TextEncoder().encode(JSON.stringify(metadata));
  const bytes = new Uint8Array(4 + header.length + body.length);
  new DataView(bytes.buffer).setUint32(0, header.length, true);
  bytes.set(header, 4); bytes.set(body, 4 + header.length);
  return bytes.buffer;
}

describe('EOS Vision binary frames', () => {
  it('decodes bounded metadata and JPEG bytes', () => {
    const result = decodeVisionFrame(packet({ gate_path: 'cores/eos/layers/interface/groups/gate/nodes/front-preview', width_px: 640, height_px: 480, sequence: 7 }));
    expect(result.metadata.sequence).toBe(7);
    expect(result.jpeg.type).toBe('image/jpeg');
    expect(result.jpeg.size).toBe(4);
  });
  it('rejects invalid dimensions, JPEG and oversized payloads', () => {
    expect(() => decodeVisionFrame(packet({ gate_path: 'gate', width_px: 5000, height_px: 480 }))).toThrow();
    expect(() => decodeVisionFrame(packet({ gate_path: 'gate', width_px: 640, height_px: 480 }, [1, 2, 3, 4]))).toThrow();
    expect(() => decodeVisionFrame(new ArrayBuffer(4_000_001))).toThrow();
  });
});
