import { bytesToBase64 } from '@/services/ozzie-audio';

function bytesOf(str: string): Uint8Array {
  return new Uint8Array([...str].map((c) => c.charCodeAt(0)));
}

describe('bytesToBase64', () => {
  it('encodes a 1-byte input (length % 3 === 1), needing "==" padding', () => {
    expect(bytesToBase64(bytesOf('M'))).toBe('TQ==');
  });

  it('encodes a 2-byte input (length % 3 === 2), needing "=" padding', () => {
    expect(bytesToBase64(bytesOf('Ma'))).toBe('TWE=');
  });

  it('encodes a 3-byte input (length % 3 === 0), needing no padding', () => {
    expect(bytesToBase64(bytesOf('Man'))).toBe('TWFu');
  });

  it('encodes an empty byte array as an empty string', () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe('');
  });

  it('encodes a longer multi-group string matching the reference "Base64" encoding', () => {
    // Known-correct base64 for "Hello, World!" (13 bytes, length % 3 === 1).
    expect(bytesToBase64(bytesOf('Hello, World!'))).toBe('SGVsbG8sIFdvcmxkIQ==');
  });

  it('round-trips arbitrary byte values (0-255) through the standard base64 alphabet', () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 128, 64, 32]);
    const encoded = bytesToBase64(bytes);
    // Decode using the platform's atob-equivalent (Buffer is available in the
    // Jest/Node test environment, even though it isn't on-device) to verify
    // round-trip correctness independently of the implementation under test.
    const decoded = Buffer.from(encoded, 'base64');
    expect(Uint8Array.from(decoded)).toEqual(bytes);
  });
});
