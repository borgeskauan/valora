import { Request, Response } from 'express';
import { AIMessageService } from '../services/ai/conversational/aiMessageService';
import { WhatsAppService } from '../services/infrastructure/whatsappService';
import { ConversationService } from '../services/infrastructure/conversationService';
import { WhatsAppWebhookPayload } from '../types/whatsapp';

interface WebhookResponse {
  success: boolean;
  error?: string;
  message?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
}

export class WhatsAppController {
  constructor(
    private readonly aiMessageService: AIMessageService,
    private readonly whatsappService: WhatsAppService,
    private readonly conversationService: ConversationService
  ) {}

  /**
   * Handle incoming WhatsApp webhook messages
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as WhatsAppWebhookPayload;

      console.log('Received WhatsApp webhook:', JSON.stringify(payload, null, 2));

      // Check if message should be ignored
      if (this.shouldIgnoreMessage(payload)) {
        console.log('Ignoring message from bot itself');
        res.json(this.buildSuccessResponse());
        return;
      }

      // Validate payload
      const validationResult = this.validatePayload(payload);
      if (!validationResult.valid) {
        console.warn('Invalid webhook payload:', payload);
        res.status(200).json(this.buildErrorResponse(
          validationResult.error!,
          validationResult.message
        ));
        return;
      }

      const userId = payload.remoteJid;
      const userMessage = payload.text;
      const userName = payload.pushName || 'User';

      console.log(`Processing message from ${userName} (${userId}): ${userMessage}`);

      // Respond to webhook immediately with 200
      res.json(this.buildSuccessResponse());

      // Process the message asynchronously (fire-and-forget)
      this.processUserMessage(userId, userMessage).catch(error => {
        console.error(`Unhandled error in background processing for user ${userId}:`, error);
      });

    } catch (error) {
      console.error('Error processing WhatsApp webhook:', error);
      res.status(500).json(this.buildErrorResponse(
        'Internal server error',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  }

  /**
   * Process user message in the background
   */
  private async processUserMessage(userId: string, userMessage: string): Promise<void> {
    try {
      // Get conversation history
      const conversationHistory = await this.conversationService.getConversationHistory(userId);

      // Process the message with AI (passing userId and conversation history)
      const result = await this.aiMessageService.handleMessage(userId, userMessage, conversationHistory);

      // Save the new conversation entries (user message, function calls/responses, and model response)
      await this.conversationService.addMessagesToConversation(userId, result.newConversationEntries);

      // Send the response back to WhatsApp
      const sendResult = await this.whatsappService.sendMessage(userId, result.response);

      console.log(`Response sent to ${userId}:`, sendResult);

    } catch (error) {
      console.error(`Error processing message for user ${userId}:`, error);
      await this.sendFallbackMessage(userId);
    }
  }

  /**
   * Check if message should be ignored
   */
  private shouldIgnoreMessage(payload: WhatsAppWebhookPayload): boolean {
    return payload.fromMe === true;
  }

  /**
   * Validate webhook payload
   */
  private validatePayload(payload: WhatsAppWebhookPayload): ValidationResult {
    if (!payload.remoteJid || !payload.text) {
      return {
        valid: false,
        error: 'Payload was ignored due to missing fields',
        message: 'Missing required fields: remoteJid or text'
      };
    }

    return { valid: true };
  }

  /**
   * Send fallback message when processing fails
   */
  private async sendFallbackMessage(userId: string): Promise<void> {
    try {
      await this.whatsappService.sendMessage(
        userId,
        'Sorry, I encountered an error processing your message. Please try again.'
      );
    } catch (error) {
      console.error(`Failed to send fallback message to ${userId}:`, error);
    }
  }

  /**
   * Build success response
   */
  private buildSuccessResponse(): WebhookResponse {
    return { success: true };
  }

  /**
   * Build error response
   */
  private buildErrorResponse(error: string, message?: string): WebhookResponse {
    return {
      success: false,
      error,
      ...(message && { message })
    };
  }
}
