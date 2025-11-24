import { PrismaClient } from '../../generated/prisma';
import { Content } from '../../types/ai';
import { PrismaClientManager } from '../../lib/PrismaClientManager';

export class ConversationService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = PrismaClientManager.getClient();
  }
  /**
   * Get or create a conversation for a user
   * @param userId - WhatsApp JID
   * @returns Conversation with messages
   */
  async getOrCreateConversation(userId: string) {
    let conversation = await this.prisma.conversation.findFirst({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    return conversation;
  }

  /**
   * Get conversation history as Content array
   * @param userId - WhatsApp JID
   * @returns Array of Content objects
   */
  async getConversationHistory(userId: string): Promise<Content[]> {
    const conversation = await this.getOrCreateConversation(userId);
    
    return conversation.messages.map(msg => ({
      role: msg.role as 'user' | 'model',
      parts: JSON.parse(msg.content).parts,
    }));
  }

  /**
   * Add messages to conversation
   * @param userId - WhatsApp JID
   * @param newMessages - Array of new messages to add
   */
  async addMessagesToConversation(userId: string, newMessages: Content[]) {
    const conversation = await this.getOrCreateConversation(userId);

    for (const message of newMessages) {
      // Skip messages with no parts or empty content
      if (!this.isValidContent(message)) {
        console.warn('Skipping empty content message:', message);
        continue;
      }

      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: message.role,
          content: JSON.stringify({ parts: message.parts }),
        },
      });
    }
  }

  /**
   * Check if content has meaningful data
   * @param content - Content to validate
   * @returns true if content is valid, false otherwise
   */
  private isValidContent(content: Content): boolean {
    // Content is invalid if it has no parts or all parts are empty
    if (!content.parts || content.parts.length === 0) {
      return false;
    }

    // Check if at least one part has meaningful content
    return content.parts.some(part => {
      // Valid if has text content
      if (part.text && part.text.trim() !== '') {
        return true;
      }
      // Valid if has function response
      if (part.functionResponse) {
        return true;
      }
      return false;
    });
  }
}

export const conversationService = new ConversationService();
