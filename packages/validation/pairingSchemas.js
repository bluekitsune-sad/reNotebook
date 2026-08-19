import { z } from 'zod';

export const pairingInitiateSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const pairingScanSchema = z.object({
  pairingToken: z.string().uuid(),
  deviceName: z.string().min(1).max(100),
  deviceType: z.enum(['web', 'mobile', 'desktop']),
});

export const pairingConfirmSchema = z.object({
  pairingSessionId: z.string().uuid(),
  verificationCode: z.string().length(6).optional(),
});
