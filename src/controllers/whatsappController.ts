import { Request, Response } from 'express';
import { AIMessageService } from '../services/ai/conversational/aiMessageService';
import { whatsappService } from '../services/infrastructure/whatsappService';
import { conversationService } from '../services/infrastructure/conversationService';
import { WhatsAppWebhookPayload } from '../types/whatsapp';

export class WhatsAppController {
  constructor(private readonly aiMessageService: AIMessageService) {}

  /**
   * Handle incoming WhatsApp webhook messages
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as WhatsAppWebhookPayload;

      console.log('Received WhatsApp webhook:', JSON.stringify(payload, null, 2));

      // Ignore messages from the bot itself
      if (payload.fromMe) {
        console.log('Ignoring message from bot itself');
        res.json({ success: true, ignored: true, reason: 'fromMe' });
        return;
      }

      // Validate payload
      if (!payload.remoteJid || !payload.text) {
        console.warn('Invalid webhook payload:', payload);
        res.status(200).json({ 
          error: 'Payload was ignored due to missing fields',
          message: 'Missing required fields: remoteJid or text' 
        });
        return;
      }

      const userId = payload.remoteJid;
      const userMessage = payload.text;
      const userName = payload.pushName || 'User';

      console.log(`Processing message from ${userName} (${userId}): ${userMessage}`);

      // Get conversation history
      const conversationHistory = await conversationService.getConversationHistory(userId);

      // Process the message with AI (passing the conversation history)
      const result = await this.aiMessageService.handleMessage(userMessage, conversationHistory);

      // Save the new conversation entries (user message, function calls/responses, and model response)
      await conversationService.addMessagesToConversation(userId, result.newConversationEntries);

      // Send the response back to WhatsApp
      const sendResult = await whatsappService.sendMessage(userId, result.response);

      console.log(`Response sent to ${userId}:`, sendResult);

      // Respond to the webhook
      res.json({
        success: true,
        messageId: sendResult.id,
        to: sendResult.to
      });

    } catch (error) {
      console.error('Error processing WhatsApp webhook:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clear conversation history for a user
   */
  async handleClearConversation(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          error: 'Bad request',
          message: 'userId parameter is required'
        });
        return;
      }

      console.log(`Clearing conversation history for user: ${userId}`);

      const deletedCount = await conversationService.clearConversation(userId);

      res.json({
        success: true,
        message: `Conversation history cleared for user ${userId}`,
        deletedMessages: deletedCount
      });

    } catch (error) {
      console.error('Error clearing conversation:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Health check endpoint
   */
  async handleHealthCheck(_req: Request, res: Response): Promise<void> {
    try {
      // Check if AI service is initialized
      const aiServiceStatus = this.aiMessageService ? 'ok' : 'not initialized';

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          aiMessageService: aiServiceStatus,
          conversationService: 'ok',
          whatsappService: 'ok'
        }
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
