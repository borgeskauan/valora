import { config } from '../../config/config';
import { markdownToWhatsapp } from '../../lib/WhatsAppPostProcessor';

export interface SendMessageRequest {
  to: string;
  message: string;
}

export interface SendMessageResponse {
  ok: boolean;
  id: string;
  to: string;
}

export class WhatsAppService {
  private readonly apiUrl: string;

  constructor(apiUrl: string = config.whatsapp.apiUrl) {
    this.apiUrl = apiUrl;
  }

  /**
   * Send a text message to a WhatsApp user
   * @param to - Phone number or JID (e.g., "1234567890" or "1234567890@s.whatsapp.net")
   * @param message - The text message to send
   * @returns Response from the WhatsApp API
   */
  async sendMessage(to: string, message: string): Promise<SendMessageResponse> {
    try {
      // Convert Markdown formatting to WhatsApp formatting
      const formattedMessage = markdownToWhatsapp(message.trim());
      
      if (message !== formattedMessage) {
        console.log('Message formatting converted:', {
          original: message,
          formatted: formattedMessage
        });
      }
      
      const url = `${this.apiUrl}/send`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          message: formattedMessage,
        } as SendMessageRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WhatsApp API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as SendMessageResponse;
      console.log(`Message sent to ${to}: ${data.id} with content "${formattedMessage}"`);
      return data;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }
}

// Singleton instance
export const whatsappService = new WhatsAppService();
