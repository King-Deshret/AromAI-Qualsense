import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ApiError } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function makeApiError(
  status: number,
  code: string,
  message: string,
  errors?: ApiError['errors']
): Response {
  const body: ApiError = { status, code, message, ...(errors ? { errors } : {}) };
  return Response.json(body, { status });
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export function generateLotCode(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `LOT-${y}${m}${d}-${rand}`;
}

export function rotCategory(level: number): string {
  if (level < 10) return 'Fresh';
  if (level < 30) return 'Early Decay';
  if (level < 60) return 'Moderate';
  return 'Severely Rotten';
}

export function bboxColor(confidence: number, rotLevel: number): string {
  if (rotLevel >= 60 || confidence < 0.4) return '#ef4444'; // red — rejected
  if (rotLevel >= 30 || confidence < 0.7) return '#eab308'; // yellow — warning
  return '#22c55e'; // green — ok
}
