export class FurBinaryReader {
  constructor(
    private readonly buffer: Buffer,
    private offset = 0
  ) {}

  get length(): number {
    return this.buffer.length;
  }

  tell(): number {
    return this.offset;
  }

  seek(offset: number): void {
    if (offset < 0 || offset > this.buffer.length) throw new Error(`Seek out of range: ${offset}`);
    this.offset = offset;
  }

  skip(bytes: number): void {
    this.ensure(bytes);
    this.offset += bytes;
  }

  u8(): number {
    this.ensure(1);
    return this.buffer.readUInt8(this.offset++);
  }

  i8(): number {
    this.ensure(1);
    return this.buffer.readInt8(this.offset++);
  }

  u16(): number {
    this.ensure(2);
    const value = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  i32(): number {
    this.ensure(4);
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  u32(): number {
    this.ensure(4);
    const value = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  f32(): number {
    this.ensure(4);
    const value = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  ascii(length: number): string {
    this.ensure(length);
    const value = this.buffer.toString("ascii", this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  string(): string {
    const start = this.offset;
    while (this.offset < this.buffer.length && this.buffer[this.offset] !== 0) this.offset++;
    if (this.offset >= this.buffer.length) throw new Error(`Unterminated string at ${start}`);
    const value = this.buffer.toString("utf8", start, this.offset);
    this.offset++;
    return value;
  }

  fork(offset: number): FurBinaryReader {
    return new FurBinaryReader(this.buffer, offset);
  }

  private ensure(bytes: number): void {
    if (this.offset + bytes > this.buffer.length) {
      throw new Error(`Unexpected EOF at 0x${this.offset.toString(16)}; need ${bytes} byte(s).`);
    }
  }
}
