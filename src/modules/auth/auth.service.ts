import type { z } from 'zod';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { comparePassword, hashPassword } from '../../lib/bcrypt.js';
import { sendVerificationEmail } from '../../lib/email.js';
import { signAccessToken, signRefreshToken } from '../../lib/jwt.js';
import { compareToken, generateToken, hashToken } from '../../lib/token.js';
import { AppError } from '../../middleware/error.js';
import type { loginSchema, registerSchema, resetPasswordSchema } from './auth.validation.js';

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ============================================================
// REGISTER
// ============================================================

export const register = async (input: RegisterInput) => {
  // 1. Email already exists?
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (existing) {
    throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
  }

  // 2. Division resolve (name → id)
  const division = await prisma.division.findUnique({
    where: { name: input.divisionName },
  });
  if (!division) {
    throw new AppError(`Division "${input.divisionName}" not found`, 400, 'DIVISION_NOT_FOUND');
  }

  // 3. District resolve (division-এর অধীনে)
  const district = await prisma.district.findFirst({
    where: {
      name: input.districtName,
      divisionId: division.id,
    },
  });
  if (!district) {
    throw new AppError(
      `District "${input.districtName}" not found under ${division.name}`,
      400,
      'DISTRICT_NOT_FOUND'
    );
  }

  // 4. Upazila resolve (district-এর অধীনে)
  const upazila = await prisma.upazila.findFirst({
    where: {
      name: input.upazilaName,
      districtId: district.id,
    },
  });
  if (!upazila) {
    throw new AppError(
      `Upazila "${input.upazilaName}" not found under ${district.name}`,
      400,
      'UPAZILA_NOT_FOUND'
    );
  }

  // 5. Union অথবা Pourashava resolve
  let unionId: string | undefined;
  let pourashavaId: string | undefined;

  if (input.unionName) {
    const union = await prisma.union.findFirst({
      where: {
        name: input.unionName,
        upazilaId: upazila.id,
      },
    });
    if (!union) {
      throw new AppError(
        `Union "${input.unionName}" not found under ${upazila.name}`,
        400,
        'UNION_NOT_FOUND'
      );
    }
    unionId = union.id;
  } else if (input.pourashavaName) {
    const pourashava = await prisma.pourashava.findFirst({
      where: {
        name: input.pourashavaName,
        upazilaId: upazila.id,
      },
    });
    if (!pourashava) {
      throw new AppError(
        `Pourashava "${input.pourashavaName}" not found under ${upazila.name}`,
        400,
        'POURASHAVA_NOT_FOUND'
      );
    }
    pourashavaId = pourashava.id;
  }

  // 6. Password hash
  const passwordHash = await hashPassword(input.password);

  // 7. User + Profile create (transaction)
  const user = await prisma.$transaction(async (tx) => {
    return tx.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role: 'USER',
        status: 'PENDING_VERIFICATION',

        divisionId: division.id,
        districtId: district.id,
        upazilaId: upazila.id,
        unionId,
        pourashavaId,

        profile: {
          create: {
            name: input.name,
            nickname: input.nickname,
            age: input.age,
          },
        },
      },
      select: {
        id: true,
        email: true,
        status: true,
        role: true,
        createdAt: true,
        division: { select: { name: true } },
        district: { select: { name: true } },
        upazila: { select: { name: true } },
        union: { select: { name: true } },
        pourashava: { select: { name: true } },
      },
    });
  });

  // 8. Email verification token
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + env.EMAIL_VERIFY_EXPIRES_HOURS * 60 * 60 * 1000);

  await prisma.emailVerification.create({
    data: {
      userId: user.id,
      tokenHash,
      purpose: 'EMAIL_VERIFY',
      expiresAt,
    },
  });

  const link = `${env.FRONTEND_URL}/verify-email?token=${token}`;

  try {
    await sendVerificationEmail({
      to: user.email,
      link,
      purpose: 'EMAIL_VERIFY',
    });
  } catch (err) {
    console.error('Email send failed:', err);
  }

  return {
    message: 'Registration successful. Please check your email to verify.',
    user,
  };
};

// ============================================================
// VERIFY EMAIL
// ============================================================

export const verifyEmail = async (token: string) => {
  if (!token) {
    throw new AppError('Token required', 400, 'TOKEN_REQUIRED');
  }

  const verifications = await prisma.emailVerification.findMany({
    where: {
      purpose: 'EMAIL_VERIFY',
      verifiedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  let matched = null;
  for (const v of verifications) {
    if (await compareToken(token, v.tokenHash)) {
      matched = v;
      break;
    }
  }

  if (!matched) {
    throw new AppError('Invalid or expired token', 400, 'INVALID_TOKEN');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: matched.userId },
      data: { emailVerified: true, status: 'ACTIVE' },
    }),
    prisma.emailVerification.update({
      where: { id: matched.id },
      data: { verifiedAt: new Date() },
    }),
  ]);

  return { message: 'Email verified successfully. You can now login.' };
};

// ============================================================
// RESEND VERIFICATION
// ============================================================

export const resendVerification = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    return { message: 'If the email exists, a verification link has been sent.' };
  }
  if (user.emailVerified) {
    return { message: 'Email already verified.' };
  }

  await prisma.emailVerification.updateMany({
    where: { userId: user.id, purpose: 'EMAIL_VERIFY', verifiedAt: null },
    data: { expiresAt: new Date() },
  });

  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + env.EMAIL_VERIFY_EXPIRES_HOURS * 60 * 60 * 1000);

  await prisma.emailVerification.create({
    data: { userId: user.id, tokenHash, purpose: 'EMAIL_VERIFY', expiresAt },
  });

  const link = `${env.FRONTEND_URL}/verify-email?token=${token}`;
  await sendVerificationEmail({
    to: user.email,
    link,
    purpose: 'EMAIL_VERIFY',
  });

  return { message: 'Verification link sent.' };
};

// ============================================================
// LOGIN
// ============================================================

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: { profile: true },
  });

  if (!user) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }
  if (user.status === 'PENDING_VERIFICATION') {
    throw new AppError('Please verify your email first', 403, 'EMAIL_NOT_VERIFIED');
  }
  if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
    throw new AppError('Account is ' + user.status.toLowerCase(), 403, 'ACCOUNT_' + user.status);
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  const payload = {
    userId: user.id,
    role: user.role,
    status: user.status,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const refreshTokenHash = await hashToken(refreshToken);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      name: user.profile?.name,
      nickname: user.profile?.nickname,
    },
  };
};

// ============================================================
// LOGOUT
// ============================================================

export const logout = async (userId: string) => {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { message: 'Logged out' };
};

// ============================================================
// ME
// ============================================================

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerified: true,
      phone: true,
      createdAt: true,
      profile: {
        select: {
          name: true,
          nickname: true,
          age: true,
          avatarUrl: true,
        },
      },
      division: { select: { id: true, name: true, nameBn: true } },
      district: { select: { id: true, name: true, nameBn: true } },
      upazila: { select: { id: true, name: true, nameBn: true } },
      union: { select: { id: true, name: true, nameBn: true } },
      pourashava: { select: { id: true, name: true, nameBn: true } },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  return user;
};

// ============================================================
// FORGOT PASSWORD
// ============================================================

export const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    return { message: 'If the email exists, a reset link has been sent.' };
  }

  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_HOURS * 60 * 60 * 1000);

  await prisma.emailVerification.create({
    data: { userId: user.id, tokenHash, purpose: 'PASSWORD_RESET', expiresAt },
  });

  const link = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendVerificationEmail({
    to: user.email,
    link,
    purpose: 'PASSWORD_RESET',
  });

  return { message: 'Reset link sent.' };
};

// ============================================================
// RESET PASSWORD
// ============================================================

export const resetPassword = async (input: ResetPasswordInput) => {
  const verifications = await prisma.emailVerification.findMany({
    where: {
      purpose: 'PASSWORD_RESET',
      verifiedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  let matched = null;
  for (const v of verifications) {
    if (await compareToken(input.token, v.tokenHash)) {
      matched = v;
      break;
    }
  }

  if (!matched) {
    throw new AppError('Invalid or expired token', 400, 'INVALID_TOKEN');
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: matched.userId },
      data: { passwordHash },
    }),
    prisma.emailVerification.update({
      where: { id: matched.id },
      data: { verifiedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: matched.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { message: 'Password reset successfully. Please login.' };
};
