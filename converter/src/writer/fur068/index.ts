import { deflateSync } from "node:zlib";

export type FurRoundTripDocument = {
  data: Buffer;
  compressed: boolean;
};

export function writeFurRoundTrip(document: FurRoundTripDocument, options: { compress?: boolean } = {}): Buffer {
  const compress = options.compress ?? document.compressed;
  return compress ? deflateSync(document.data) : Buffer.from(document.data);
}
