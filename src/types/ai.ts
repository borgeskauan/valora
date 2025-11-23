export interface FunctionCallResult {
  response: string;
  newConversationEntries: Content[]; // Only the new entries added during this interaction
}

export interface Content {
  role: "user" | "model";
  parts: Part[];
}

export interface Part {
  text?: string;
  functionResponse?: {
    name: string;
    response: { resultValue: any };
  };
}

export interface IAIConversationalService {
  generateContent(contents: Content[]): Promise<GenerateContentResponse>;
}

export interface GenerateContentResponse {
  functionCalls?: any[];
  candidates?: Array<{
    content: Content;
  }>;
  text?: string;
}

export interface IAIMessageService {
  handleMessage(userId: string, message: string, conversationHistory?: Content[]): Promise<FunctionCallResult>;
}