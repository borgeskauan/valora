import { Content, FunctionCallResult, IAIConversationalService, IAIMessageService } from "../../../types/ai";
import { FunctionDeclarationService } from "../functionDeclarationService";


export class AIMessageService implements IAIMessageService {
  private readonly aiService: IAIConversationalService;
  private readonly functionDeclarationService: FunctionDeclarationService;
  private readonly MAX_ITERATIONS = 50;

  constructor(aiService: IAIConversationalService, functionDeclarationService: FunctionDeclarationService) {
    this.aiService = aiService;
    this.functionDeclarationService = functionDeclarationService;
  }

  async handleMessage(userId: string, message: string, conversationHistory: Content[] = []): Promise<FunctionCallResult> {
    let iterations = 0;
    const originalHistoryLength = conversationHistory.length;
    const currentContents = [...conversationHistory];

    try {
      this.addUserMessage(currentContents, message);

      const finalResponse = await this.processFunctionCalls(
        userId,
        currentContents,
        iterations
      );

      this.addModelResponse(currentContents, finalResponse);

      return this.buildSuccessResult(finalResponse, currentContents, originalHistoryLength);
    } catch (error) {
      console.error('Error in function calling:', error);
      throw error;
    }
  }

  private async processFunctionCalls(
    userId: string,
    contents: Content[],
    iterations: number
  ): Promise<any> {
    while (iterations < this.MAX_ITERATIONS) {
      iterations++;
      console.log(`Iteration ${iterations}`);

      const generateContentResponse = await this.aiService.generateContent(contents);
      const functionCalls = generateContentResponse.functionCalls || [];

      if (functionCalls.length === 0) {
        return generateContentResponse;
      }

      console.log(`Function call(s) detected in iteration ${iterations}:`, functionCalls);

      this.addModelResponse(contents, generateContentResponse);
      await this.executeFunctionCalls(userId, functionCalls, contents);

      console.log(`Completed iteration ${iterations}, function responses sent back to model`);
    }

    throw new Error(`Maximum iterations (${this.MAX_ITERATIONS}) reached. Possible infinite loop.`);
  }

  private async executeFunctionCalls(
    userId: string,
    functionCalls: any[],
    contents: Content[]
  ): Promise<void> {
    const functionResponses = [];

    for (const functionCall of functionCalls) {
      if (!this.isValidFunctionCall(functionCall)) {
        console.warn('Invalid function call:', functionCall);
        continue;
      }

      const result = await this.executeSingleFunctionCall(userId, functionCall);

      functionResponses.push({
        name: functionCall.name,
        response: { resultValue: result }
      });
    }

    this.addFunctionResponses(contents, functionResponses);
  }

  private async executeSingleFunctionCall(userId: string, functionCall: any): Promise<any> {
    const result = await this.functionDeclarationService.executeFunction(functionCall.name, userId, functionCall.args);

    console.log(`Function ${functionCall.name} result:`, result);
    return result;
  }

  private isValidFunctionCall(functionCall: any): boolean {
    return functionCall.name && functionCall.args;
  }

  private addUserMessage(contents: Content[], message: string): void {
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });
  }

  private addModelResponse(contents: Content[], response: any): void {
    if (response.candidates?.[0]?.content) {
      contents.push(response.candidates[0].content);
    }
  }

  private addFunctionResponses(contents: Content[], functionResponses: any[]): void {
    if (functionResponses.length > 0) {
      contents.push({
        role: 'user',
        parts: functionResponses.map(fr => ({ functionResponse: fr }))
      });
    }
  }

  private buildSuccessResult(
    finalResponse: any,
    conversationHistory: Content[],
    originalHistoryLength: number
  ): FunctionCallResult {
    // Check if the final response has any valid content
    if (!finalResponse.text || finalResponse.text.trim() === '') {
      throw new Error('AI returned empty response with no content');
    }

    // Extract only the new entries added during this interaction
    const newConversationEntries = conversationHistory.slice(originalHistoryLength);

    return {
      response: finalResponse.text,
      newConversationEntries: newConversationEntries
    };
  }
}