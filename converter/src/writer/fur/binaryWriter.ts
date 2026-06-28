export class BinaryWriter {
  private data: number[] = [];

  get length(): number {
    return this.data.length;
  }

  tell(): number {
    return this.data.length;
  }

  patchI32(offset: number, value: number): void {
    this.data[offset] = value & 0xff;
    this.data[offset + 1] = (value >> 8) & 0xff;
    this.data[offset + 2] = (value >> 16) & 0xff;
    this.data[offset + 3] = (value >> 24) & 0xff;
  }

  patchU16(offset: number, value: number): void {
    this.data[offset] = value & 0xff;
    this.data[offset + 1] = (value >> 8) & 0xff;
  }

  u8(value: number): void {
    this.data.push(value & 0xff);
  }

  u16(value: number): void {
    this.data.push(value & 0xff, (value >> 8) & 0xff);
  }

  i32(value: number): void {
    this.data.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
  }

  f32(value: number): void {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeFloatLE(value, 0);
    this.bytes(buffer);
  }

  ascii(value: string, fixedLength?: number): void {
    const bytes = Buffer.from(value, "ascii");
    this.bytes(fixedLength === undefined ? bytes : bytes.subarray(0, fixedLength));
    if (fixedLength !== undefined) {
      for (let i = bytes.length; i < fixedLength; i++) this.u8(0);
    }
  }

  string(value: string): void {
    this.bytes(Buffer.from(value, "utf8"));
    this.u8(0);
  }

  bytes(value: Buffer | Uint8Array | number[]): void {
    for (const byte of value) this.u8(byte);
  }

  block(id: string, writeBody: () => void): number {
    const pointer = this.tell();
    this.ascii(id, 4);
    const sizeOffset = this.tell();
    this.i32(0);
    const bodyStart = this.tell();
    writeBody();
    this.patchI32(sizeOffset, this.tell() - bodyStart);
    return pointer;
  }

  toBuffer(): Buffer {
    return Buffer.from(this.data);
  }
}
