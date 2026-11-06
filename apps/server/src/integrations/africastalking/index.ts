// path: apps/server/src/integrations/africastalking/index.ts
import { config } from '../../config';
import { AfricaTalkingClient } from './types';
import { MockAfricaTalkingClient } from './mock';
import { AfricaTalkingHttpClient } from './client';

export * from './types';
export * from './mock';
export * from './client';

let africaTalkingInstance: AfricaTalkingClient | null = null;

export function getAfricaTalkingClient(): AfricaTalkingClient {
  if (africaTalkingInstance) {
    return africaTalkingInstance;
  }

  // Use mock adapter if flag is true or if API key is not configured
  const useMock =
    config.africasTalkingMock || !config.africasTalkingApiKey;

  if (useMock) {
    africaTalkingInstance = new MockAfricaTalkingClient();
  } else {
    africaTalkingInstance = new AfricaTalkingHttpClient({
      username: config.africasTalkingUsername,
      apiKey: config.africasTalkingApiKey,
      senderId: config.africasTalkingSenderId,
    });
  }

  return africaTalkingInstance;
}

export function resetAfricaTalkingClient(): void {
  africaTalkingInstance = null;
}

