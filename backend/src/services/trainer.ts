/**
 * Trainer service — business logic for trainer-client relationships and invitations.
 */
import crypto from 'crypto';
import { NotFoundError, ConflictError, ValidationError } from '../errors.js';
import * as trainerClientModel from '../models/trainerClient.js';
import * as userModel from '../models/user.js';
import { publishEvent } from '../events/publish.js';
import { config } from '../config/index.js';
import { sendMail } from '../lib/email.js';

const CLIENT_LIMITS: Record<string, number> = {
  trainer: 10,
  trainer_pro: 50,
};

const INVITE_EXPIRY_DAYS = 7;

function escapeHtml(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAppBaseUrl() {
  return (config.appBaseUrl || config.frontendOrigin || 'http://localhost:5173').replace(/\/+$/, '');
}

async function sendTrainerInviteEmail({
  trainerId,
  email,
  invitationId,
  expiresAt,
}: {
  trainerId: string;
  email: string;
  invitationId: string;
  expiresAt: string;
}) {
  const trainer = await userModel.findById(trainerId);
  const trainerName = trainer?.name || 'Your trainer';
  const appBaseUrl = getAppBaseUrl();
  const inviteUrl = `${appBaseUrl}/settings?trainerInvite=${encodeURIComponent(invitationId)}`;
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  await sendMail({
    to: email,
    subject: `${trainerName} invited you to TrackVibe`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.55; max-width: 560px;">
        <h2 style="margin: 0 0 12px;">You're invited to train with ${escapeHtml(trainerName)}</h2>
        <p>${escapeHtml(trainerName)} invited you to connect on TrackVibe so they can help guide your workouts, food, goals, and progress.</p>
        <p>
          <a href="${escapeHtml(inviteUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #111827; color: #ffffff; text-decoration: none; font-weight: 700;">
            Accept invite
          </a>
        </p>
        <p style="font-size: 14px; color: #5b6472;">If the button does not open the app, sign up or log in with this email address and enter this invite code in Settings:</p>
        <p style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; padding: 12px; border-radius: 10px; background: #f3f4f6; color: #111827;">${escapeHtml(invitationId)}</p>
        <p style="font-size: 13px; color: #6b7280;">This invite expires on ${escapeHtml(expiryDate)}. If you did not expect this invite, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function listClients(trainerId: string) {
  return trainerClientModel.findClientsByTrainerId(trainerId);
}

export async function inviteByEmail(trainerId: string, email: string) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new ValidationError('Valid email is required');
  }
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const invitation = await trainerClientModel.createInvitation(trainerId, { email: normalizedEmail, expiresAt });
  await sendTrainerInviteEmail({
    trainerId,
    email: normalizedEmail,
    invitationId: invitation.id,
    expiresAt: invitation.expiresAt,
  });
  await publishEvent('trainer.InvitationCreated', { invitationId: invitation.id, email: normalizedEmail }, trainerId);
  return invitation;
}

export async function generateInviteCode(trainerId: string) {
  const inviteCode = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const invitation = await trainerClientModel.createInvitation(trainerId, { inviteCode, expiresAt });
  await publishEvent('trainer.InviteCodeGenerated', { invitationId: invitation.id, inviteCode }, trainerId);
  return invitation;
}

export async function acceptInvitation(clientId: string, inviteCode: string, clientEmail?: string) {
  if (!inviteCode) {
    throw new ValidationError('Invite code is required');
  }
  // Try by invite code first (code-based invitations)
  let invitation = await trainerClientModel.findInvitationByCode(inviteCode);
  // Fall back to invitation ID lookup for email-based invitations
  if (!invitation && clientEmail) {
    invitation = await trainerClientModel.findInvitationByIdForEmail(inviteCode, clientEmail);
  }
  if (!invitation) {
    throw new NotFoundError('Invitation not found or expired');
  }
  // Prevent trainer from accepting their own invitation
  if (invitation.trainerId === clientId) {
    throw new ConflictError('Cannot accept your own invitation');
  }
  await trainerClientModel.acceptInvitation(invitation.id, clientId);
  // Trainer-granted pro mirrors the trainer's billing period and plan.
  const grant = await userModel.getSubscriptionGrant(invitation.trainerId);
  await userModel.grantTrainerSubscription(clientId, grant);
  await publishEvent('trainer.ClientAdded', { trainerId: invitation.trainerId, clientId }, clientId);
  return { trainerId: invitation.trainerId };
}

export async function removeClient(trainerId: string, clientId: string) {
  if (!clientId) {
    throw new ValidationError('Client ID is required');
  }
  const removed = await trainerClientModel.removeClient(trainerId, clientId);
  if (!removed) {
    throw new NotFoundError('Client relationship not found');
  }
  // Revoke trainer-granted pro (only if pro was granted by trainer, not self-purchased)
  await userModel.revokeTrainerSubscription(clientId);
  await publishEvent('trainer.ClientRemoved', { trainerId, clientId }, trainerId);
}

export function getClientLimit(subscriptionStatus: string): number {
  return CLIENT_LIMITS[subscriptionStatus] ?? CLIENT_LIMITS.trainer ?? 10;
}

export async function canAddClient(trainerId: string, subscriptionStatus: string): Promise<boolean> {
  const currentCount = await trainerClientModel.getClientCount(trainerId);
  const limit = getClientLimit(subscriptionStatus);
  return currentCount < limit;
}

export async function listInvitations(trainerId: string) {
  return trainerClientModel.listInvitationsByTrainer(trainerId);
}

export async function getMyTrainer(clientId: string) {
  return trainerClientModel.findTrainerByClientId(clientId);
}

export async function getPendingInvitations(email: string) {
  if (!email) {
    throw new ValidationError('Email is required');
  }
  return trainerClientModel.findPendingInvitationsByEmail(email);
}
