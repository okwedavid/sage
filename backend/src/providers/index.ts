/**
 * providers/index.ts — Public surface of the provider system.
 */
export * from './types';
export { ChatGateway } from './gateway';
export { providerService } from './service';
export type { ProviderCredential, ConnectInput, ConnectResult } from './service';
export {
  getAdapter,
  getCustomAdapter,
  getCatalogEntry,
  listAdapterIds,
  PROVIDER_CATALOG,
} from './adapters';
export { encryptSecret, decryptSecret, maskSecret, isCredentialEncryptionReady } from './credentials';
