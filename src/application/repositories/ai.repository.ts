export interface AIRepository {
  fetchAvailableModels(provider: string, apiKey: string, baseUrl?: string): Promise<any[]>;
  chatCompletion(
    provider: string,
    apiKey: string,
    baseUrl: string | null,
    model: string,
    messages: any[],
    tools: any[],
    systemInstruction?: string
  ): Promise<any>;
  generateImage(
    baseUrl: string,
    apiKey: string,
    model: string,
    prompt: string
  ): Promise<string>;
}
