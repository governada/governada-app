declare module '@fabianbormann/cardano-peer-connect' {
  export class DAppPeerConnect {
    constructor(params: Record<string, unknown>);
    shutdownServer(): void;
    generateQRCode(canvas: HTMLElement): void;
    getConnectedWallet(): string | null;
    getAddress(): string;
    getSeed(): string;
  }
}
