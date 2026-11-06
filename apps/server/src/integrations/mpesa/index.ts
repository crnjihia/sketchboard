// path: apps/server/src/integrations/mpesa/index.ts
import { config } from '../../config';
import { MpesaClient } from './types';
import { MockMpesaClient } from './mock';
import { DarajaMpesaClient } from './client';

export * from './types';
export * from './mock';
export * from './client';

let mpesaClientInstance: MpesaClient | null = null;

export function getMpesaClient(): MpesaClient {
  if (mpesaClientInstance) {
    return mpesaClientInstance;
  }

  // Use mock adapter if flag is true or if real Daraja credentials are not provided
  const useMock =
    config.mpesaMock ||
    !config.darajaConsumerKey ||
    !config.darajaConsumerSecret;

  if (useMock) {
    mpesaClientInstance = new MockMpesaClient();
  } else {
    mpesaClientInstance = new DarajaMpesaClient({
      consumerKey: config.darajaConsumerKey,
      consumerSecret: config.darajaConsumerSecret,
      passkey: config.darajaPasskey,
      shortcode: config.darajaShortcode,
      callbackUrl: config.darajaCallbackUrl,
    });
  }

  return mpesaClientInstance;
}

export function resetMpesaClient(): void {
  mpesaClientInstance = null;
}

