import { Router } from 'express';
import { AIMessageService } from '../services/ai/conversational/aiMessageService';
import { WhatsAppService } from '../services/infrastructure/whatsappService';
import { ConversationService } from '../services/infrastructure/conversationService';
import { WhatsAppController } from '../controllers/whatsappController';

export function createWhatsAppRoutes(
  aiMessageService: AIMessageService,
  whatsappService: WhatsAppService,
  conversationService: ConversationService
) {
  const router = Router();
  const controller = new WhatsAppController(aiMessageService, whatsappService, conversationService);

  /**
   * Webhook endpoint to receive messages from WhatsApp
   * This endpoint will be called by the WhatsApp API when a message is received
   */
  router.post('/', (req, res) => controller.handleWebhook(req, res));

  return router;
}
