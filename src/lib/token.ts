import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const hashToken = async (token: string): Promise<string> => {
  return bcrypt.hash(token, 10);
};

export const compareToken = async (token: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(token, hash);
};
