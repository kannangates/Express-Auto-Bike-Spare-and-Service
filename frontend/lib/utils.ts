import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines class names with Tailwind conflict resolution.
 * Used by shadcn/ui components throughout the app.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
