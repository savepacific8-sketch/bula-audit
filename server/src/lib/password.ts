import { z } from 'zod';

// Top common passwords — short embedded list so we don't ship a 1MB file.
// For production-grade defense use zxcvbn or pwned-passwords API.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd',
  '12345678', '123456789', '1234567890', 'qwerty123',
  'qwertyuiop', 'qwerty12345', 'qwertyuiop123',
  'iloveyou1', 'iloveyou123', 'letmein123', 'welcome1', 'welcome123',
  'admin1234', 'administrator', 'changeme', 'changeme1', 'changeme123',
  'football1', 'baseball1', 'monkey123', 'dragon123',
  'sunshine1', 'princess1', 'iloveu123', 'qwerty12',
  'abcd1234', 'abcdefgh', 'asdf1234', 'asdfghjk',
  'bulaaudit', 'bulaaudit1', 'fiji1234', 'fiji123456',
]);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .refine((v) => /[A-Za-z]/.test(v), 'Password must contain a letter')
  .refine((v) => /[0-9]/.test(v), 'Password must contain a digit')
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), 'Password is too common')
  .refine((v) => !/\s/.test(v), 'Password cannot contain spaces');
