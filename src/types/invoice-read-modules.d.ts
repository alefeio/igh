declare module "jsqr" {
  export type QRCode = {
    data: string;
    location: unknown;
  };

  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" },
  ): QRCode | null;
}

declare module "jpeg-js" {
  export function decode(
    data: Buffer | Uint8Array,
    opts?: { useTArray?: boolean },
  ): { data: Uint8Array; width: number; height: number };
}
