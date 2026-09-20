/**
 * Sending feedback: gather what the diagnostics need from the database and
 * the device, build the mail, write the attachment to the cache directory
 * and hand it all to the system compose sheet. The user writes and sends
 * from their own account; nothing leaves the phone otherwise.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { File, Paths } from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';
import { Platform } from 'react-native';

import { FORECAST_META } from '@/data/forecast-refresh';
import { FEEDBACK_EMAIL } from '@/data/project';
import { getMeta } from '@/db/database';
import { getForecasts } from '@/db/forecasts';
import { inventoryStatus } from '@/db/inventory';
import { buildFeedbackMail, type Diagnostics, type FeedbackInput } from '@/lib/diagnostics';

export type SendOutcome = 'sent' | 'saved' | 'cancelled';

/** Whether the system compose sheet can be shown (a mail account is set up). */
export async function canSendMail(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await MailComposer.isAvailableAsync();
  } catch {
    return false;
  }
}

type SettingsSlice = Pick<Diagnostics, 'myActs' | 'activity' | 'units' | 'maxDistanceKm' | 'prefs' | 'locationGranted'>;

export async function sendFeedback(
  input: Omit<FeedbackInput, 'diagnostics' | 'forecasts'>,
  settings: SettingsSlice,
): Promise<SendOutcome> {
  const [inv, lastAttemptAt, lastError, forecasts] = await Promise.all([
    inventoryStatus().catch(() => ({ count: 0, source: null, fetchedAt: null, lastError: 'unreadable' })),
    getMeta(FORECAST_META.lastAttemptAt).catch(() => null),
    getMeta(FORECAST_META.lastError).catch(() => null),
    input.place ? getForecasts([input.place.key]).catch(() => new Map()) : Promise.resolve(new Map()),
  ]);

  const mail = buildFeedbackMail({
    ...input,
    forecasts: input.place ? (forecasts.get(input.place.key) ?? []) : [],
    diagnostics: {
      ...settings,
      appVersion: Constants.expoConfig?.version ?? null,
      device: Device.modelName,
      osVersion: Device.osVersion,
      now: new Date(),
      inventory: { count: inv.count, source: inv.source, fetchedAt: inv.fetchedAt, lastError: inv.lastError },
      forecast: { lastAttemptAt, lastError },
    },
  });

  // The composer needs a file URI; the cache directory is the right home for
  // something the OS may discard once the sheet has read it.
  const attachments: string[] = [];
  if (mail.attachment) {
    const file = new File(Paths.cache, mail.attachment.name);
    file.write(mail.attachment.json);
    attachments.push(file.uri);
  }

  const result = await MailComposer.composeAsync({ recipients: [FEEDBACK_EMAIL], subject: mail.subject, body: mail.body, attachments });
  return result.status === 'sent' ? 'sent' : result.status === 'saved' ? 'saved' : 'cancelled';
}
