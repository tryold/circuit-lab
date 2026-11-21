/** The largest program an Uno holds: 32 KB of flash less the 0.5 KB bootloader. */
const MAX_FIRMWARE_BYTES = 32_256;

/**
 * Reads Intel HEX text into a flash image. Throws an Error whose message says
 * what is wrong with the file.
 */
export function parseIntelHex(text: string): { bytes: Uint8Array; size: number } {
  const flash = new Uint8Array(MAX_FIRMWARE_BYTES);
  let size = 0;
  let base = 0;
  let ended = false;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error("The file is empty.");
  for (const [index, line] of lines.entries()) {
    const at = `Line ${index + 1}`;
    if (ended) throw new Error(`${at} comes after the end-of-file record.`);
    if (!/^:([0-9A-Fa-f]{2})+$/.test(line) || line.length < 11) {
      throw new Error(`${at} is not an Intel HEX record.`);
    }
    const record = Array.from({ length: (line.length - 1) / 2 }, (_, i) =>
      parseInt(line.slice(1 + i * 2, 3 + i * 2), 16),
    );
    const [count, high, low, type] = record as [number, number, number, number];
    if (record.length !== count + 5) throw new Error(`${at} has the wrong length.`);
    if (record.reduce((sum, byte) => sum + byte, 0) % 256 !== 0) {
      throw new Error(`${at} fails its checksum.`);
    }
    const data = record.slice(4, 4 + count);
    if (type === 0) {
      const address = base + (high << 8) + low;
      if (address + count > MAX_FIRMWARE_BYTES) {
        throw new Error(`The firmware is larger than the ${MAX_FIRMWARE_BYTES} bytes an Uno holds.`);
      }
      flash.set(data, address);
      size += count;
    } else if (type === 1) {
      ended = true;
    } else if (type === 2) {
      base = ((data[0]! << 8) + data[1]!) * 16;
    } else if (type === 4) {
      base = ((data[0]! << 8) + data[1]!) << 16;
    } else if (type !== 3 && type !== 5) {
      throw new Error(`${at} has an unknown record type.`);
    }
  }
  if (!ended) throw new Error("The file has no end-of-file record.");
  if (size === 0) throw new Error("The file holds no program.");
  return { bytes: flash, size };
}
