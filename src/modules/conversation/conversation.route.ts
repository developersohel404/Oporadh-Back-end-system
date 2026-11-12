import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as controller from './conversation.controller.js';

const router = Router();

router.use(authenticate);

// Conversations
router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getOne);

// Messages
router.get('/:id/messages', controller.listMessages);
router.post('/:id/messages', controller.sendMessage);

// Actions
router.patch('/:id/read', controller.markRead);
router.post('/:id/close', controller.close);

export const conversationRouter = router;
