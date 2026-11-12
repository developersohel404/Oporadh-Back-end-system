import { Server as HTTPServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken, type JwtPayload } from './jwt.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../config/database.js';
import * as conversationService from '../modules/conversation/conversation.service.js';

// ============================================================
// Socket.IO Server Setup
// ============================================================

let io: Server | null = null;

interface AuthenticatedSocket extends Socket {
  data: {
    user: JwtPayload;
  };
}

// ============================================================
// Initialize Socket.IO
// ============================================================

export const initSocket = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  // ==========================================================
  // Auth middleware — cookie বা auth token verify
  // ==========================================================

  io.use((socket, next) => {
    try {
      // Cookie parse
      const cookieHeader = socket.handshake.headers.cookie ?? '';
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map((c) => {
          const [k, ...v] = c.split('=');
          return [k, v.join('=')];
        })
      );

      const token = cookies.accessToken || (socket.handshake.auth?.token as string | undefined);

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = verifyAccessToken(token);
      (socket as AuthenticatedSocket).data.user = payload;
      next();
    } catch (err) {
      logger.warn({ err }, 'Socket auth failed');
      next(new Error('Invalid or expired token'));
    }
  });

  // ==========================================================
  // Connection
  // ==========================================================

  io.on('connection', (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const user = authSocket.data.user;

    logger.info({ userId: user.userId }, 'Socket connected');

    // Personal room — সব notification/message এখানে যাবে
    socket.join(`user:${user.userId}`);

    // ==========================================================
    // message:send — নতুন message পাঠাও
    // ==========================================================
    socket.on(
      'message:send',
      async (
        data: { conversationId: string; message: string; attachment?: string },
        callback?: (response: any) => void
      ) => {
        try {
          const { conversationId, message, attachment } = data;

          if (!conversationId || !message) {
            return callback?.({ error: 'conversationId and message required' });
          }

          // Service call — DB-তে save + notification create
          const created = await conversationService.sendMessage(conversationId, user.userId, {
            message,
            attachment,
          });

          // Conversation-এর অন্য participant কে?
          const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { userId: true, moderatorId: true },
          });

          if (conversation) {
            const receiverId =
              conversation.userId === user.userId ? conversation.moderatorId : conversation.userId;

            // Real-time push to receiver's personal room
            io?.to(`user:${receiverId}`).emit('message:new', created);

            // Real-time push to conversation room (if both joined)
            io?.to(`conversation:${conversationId}`).emit('message:new', created);
          }

          callback?.({ success: true, message: created });
        } catch (err: any) {
          logger.error({ err, data }, 'message:send failed');
          callback?.({ error: err?.message ?? 'Failed to send message' });
        }
      }
    );

    // ==========================================================
    // conversation:join — conversation room-এ যোগ দাও
    // ==========================================================
    socket.on(
      'conversation:join',
      async (data: { conversationId: string }, callback?: Function) => {
        try {
          const { conversationId } = data;

          // Verify participant
          const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { userId: true, moderatorId: true },
          });

          if (!conversation) {
            return callback?.({ error: 'Conversation not found' });
          }
          if (conversation.userId !== user.userId && conversation.moderatorId !== user.userId) {
            return callback?.({ error: 'Not authorized' });
          }

          socket.join(`conversation:${conversationId}`);
          callback?.({ success: true });
        } catch (err) {
          callback?.({ error: 'Failed to join' });
        }
      }
    );

    // ==========================================================
    // conversation:leave
    // ==========================================================
    socket.on('conversation:leave', (data: { conversationId: string }, callback?: Function) => {
      socket.leave(`conversation:${data.conversationId}`);
      callback?.({ success: true });
    });

    // ==========================================================
    // message:read — message read marker (conversation-level)
    // ==========================================================
    socket.on('message:read', async (data: { conversationId: string }, callback?: Function) => {
      try {
        const { conversationId } = data;

        await conversationService.markConversationRead(conversationId, user.userId);

        // জানাও opposite পাশে
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { userId: true, moderatorId: true },
        });

        if (conversation) {
          const otherId =
            conversation.userId === user.userId ? conversation.moderatorId : conversation.userId;

          io?.to(`user:${otherId}`).emit('message:read', {
            conversationId,
            readBy: user.userId,
            readAt: new Date().toISOString(),
          });

          io?.to(`conversation:${conversationId}`).emit('message:read', {
            conversationId,
            readBy: user.userId,
          });
        }

        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ error: err?.message ?? 'Failed' });
      }
    });

    // ==========================================================
    // typing:start / typing:stop
    // ==========================================================
    socket.on('typing:start', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
        conversationId: data.conversationId,
        userId: user.userId,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
        conversationId: data.conversationId,
        userId: user.userId,
      });
    });

    // ==========================================================
    // Disconnect
    // ==========================================================
    socket.on('disconnect', (reason) => {
      logger.info({ userId: user.userId, reason }, 'Socket disconnected');
    });
  });

  logger.info('🔌 Socket.IO initialized');
  return io;
};

// ============================================================
// Emit helpers — HTTP controllers থেকে use করা যাবে
// ============================================================

export const emitToUser = (userId: string, event: string, data: any) => {
  io?.to(`user:${userId}`).emit(event, data);
};

export const emitToConversation = (conversationId: string, event: string, data: any) => {
  io?.to(`conversation:${conversationId}`).emit(event, data);
};

export const getIO = () => io;
