import type { UserRepository } from "../repositories/user.repository";
import type { MessageRepository } from "../repositories/message.repository";
import type { DriveRepository } from "../repositories/drive.repository";
import type { AIRepository } from "../repositories/ai.repository";
import type { User, Message } from "../../domain/entities";

export class ChatUseCase {
  constructor(
    private userRepository: UserRepository,
    private messageRepository: MessageRepository,
    private driveRepository: DriveRepository,
    private aiRepository: AIRepository
  ) {}

  async fetchAvailableModels(userId: number): Promise<{ provider: string; models: any[] }> {
    const user = this.userRepository.getUserById(userId);
    if (!user) throw new Error("User not found");

    const provider = user.provider || 'gemini';
    if (provider === 'gemini') {
      const apiKey = user.gemini_api_key;
      if (!apiKey) return { provider, models: [] };
      const models = await this.aiRepository.fetchAvailableModels(provider, apiKey);
      return { provider, models };
    } else {
      const apiKey = user.openai_api_key;
      const baseUrl = user.openai_base_url;
      if (!apiKey || !baseUrl) return { provider, models: [] };
      const models = await this.aiRepository.fetchAvailableModels(provider, apiKey, baseUrl);
      return { provider, models };
    }
  }

  async testConnection(
    userId: number,
    provider: string,
    geminiApiKey: string,
    openaiApiKey: string,
    openaiBaseUrl: string
  ): Promise<{ success: boolean; provider: string; models: any[]; baseUrl?: string }> {
    if (provider === 'gemini') {
      if (!geminiApiKey) throw new Error('Gemini API Key is required');
      const models = await this.aiRepository.fetchAvailableModels(provider, geminiApiKey);
      return { success: true, provider, models };
    } else if (provider === 'openai_compatible') {
      if (!openaiApiKey || !openaiBaseUrl) throw new Error('API Key and Base URL are required');
      
      let finalBaseUrl = openaiBaseUrl;
      let models: any[] = [];
      try {
        models = await this.aiRepository.fetchAvailableModels(provider, openaiApiKey, finalBaseUrl);
      } catch (err) {
        if (!finalBaseUrl.includes('/v1')) {
          const retryBaseUrl = `${finalBaseUrl.replace(/\/$/, '')}/v1`;
          models = await this.aiRepository.fetchAvailableModels(provider, openaiApiKey, retryBaseUrl);
          finalBaseUrl = retryBaseUrl;
        } else {
          throw err;
        }
      }
      return { success: true, provider, models, baseUrl: finalBaseUrl };
    } else {
      throw new Error('Invalid provider specified');
    }
  }

  async executeChat(
    userId: number,
    conversationId: string,
    messageText: string,
    folderId: string,
    folderStructure: any[],
    modelName?: string
  ): Promise<{ text: string; toolCalls: any[] }> {
    const user = this.userRepository.getUserById(userId);
    if (!user) throw new Error("User not found");

    const provider = user.provider || 'gemini';

    // 1. Save user's new message to DB
    this.messageRepository.saveMessage(conversationId, 'user', messageText, null);

    // 2. Fetch updated message history
    const dbMessages = this.messageRepository.getMessagesByConversationId(conversationId);

    if (provider === 'openai_compatible') {
      const openaiKey = user.openai_api_key;
      const openaiBase = user.openai_base_url;
      const openaiModel = modelName || user.openai_model;

      if (!openaiKey || !openaiBase || !openaiModel) {
        throw new Error('OpenAI Compatible configuration is incomplete in settings.');
      }

      return this.runOpenAILoop(openaiKey, openaiBase, openaiModel, conversationId, dbMessages, folderId, folderStructure, user.gemini_api_key);
    } else {
      // Gemini API
      const apiKey = user.gemini_api_key;
      if (!apiKey) throw new Error('Please set your Gemini API Key first');

      // Use target modelName or fallback
      const targetModel = modelName || 'gemini-1.5-flash';
      return this.runGeminiLoop(apiKey, targetModel, conversationId, dbMessages, folderId, folderStructure);
    }
  }

  private async runGeminiLoop(
    apiKey: string,
    model: string,
    conversationId: string,
    dbMessages: Message[],
    folderId: string,
    folderStructure: any[]
  ): Promise<{ text: string; toolCalls: any[] }> {
    
    // Construct Gemini payload using repaired mapping logic
    const contents: any[] = [];
    dbMessages.forEach(msg => {
      if (msg.role === 'function') {
        try {
          contents.push({
            role: 'function',
            parts: JSON.parse(msg.content || '[]')
          });
        } catch (e) {
          console.error("Failed to parse function response content:", e);
        }
      } else if (msg.role === 'model') {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          contents.push({
            role: 'model',
            parts: msg.toolCalls.map((tc: any) => ({
              functionCall: {
                name: tc.name,
                args: tc.args
              }
            }))
          });
        } else {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content || '' }]
          });
        }
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content || '' }]
        });
      }
    });

    const tools = [{
      functionDeclarations: [
        {
          name: 'get_folder_structure',
          description: 'Returns the complete JSON tree structure of all files and folders in the connected Google Drive.',
          parameters: { type: 'OBJECT', properties: {} }
        },
        {
          name: 'read_file',
          description: 'Downloads and reads the content of a file (e.g. PDF, Image, Document, text) using its ID from the Drive.',
          parameters: {
            type: 'OBJECT',
            properties: {
              fileId: { type: 'STRING', description: 'The unique ID of the file to read.' },
              fileName: { type: 'STRING', description: 'The name of the file being read (optional).' }
            },
            required: ['fileId']
          }
        }
      ]
    }];

    const systemInstruction = `You are an AI assistant helping a user explore their public Google Drive folder (ID: ${folderId}).
You have tools to get the folder structure and read files.
Always refer to files by their actual names.
If the user asks about the folder structure or what files are in it, call the "get_folder_structure" tool.
If the user wants you to analyze, summarize, or search inside a specific file, call the "read_file" tool with the correct file ID.
Since you can read PDFs and images, do not hesitate to call the "read_file" tool on them.`;

    let loopCount = 0;
    const maxLoops = 5;
    const loggedToolCalls: any[] = [];
    let finalResponseText = '';

    while (loopCount < maxLoops) {
      console.log(`[Gemini Loop] Iteration ${loopCount + 1}`);
      const responseData = await this.aiRepository.chatCompletion(
        'gemini',
        apiKey,
        null,
        model,
        contents,
        tools,
        systemInstruction
      );

      const candidate = responseData.candidates?.[0];
      const modelMessage = candidate?.content;
      if (!modelMessage) throw new Error("Empty response from Gemini API.");

      contents.push(modelMessage);
      const parts = modelMessage.parts || [];
      const functionCalls = parts.filter((p: any) => p.functionCall);
      const textParts = parts.filter((p: any) => p.text);

      if (textParts.length > 0) {
        finalResponseText += textParts.map((tp: any) => tp.text).join('\n');
      }

      if (functionCalls.length === 0) {
        this.messageRepository.saveMessage(conversationId, 'model', finalResponseText, null);
        break;
      }

      const mappedCalls = functionCalls.map((p: any) => ({
        name: p.functionCall.name,
        args: p.functionCall.args
      }));
      this.messageRepository.saveMessage(conversationId, 'model', null, JSON.stringify(mappedCalls));

      const functionResponses: any[] = [];
      for (const part of functionCalls) {
        const fc = part.functionCall;
        const callId = fc.name;
        const args = fc.args;
        
        console.log(`[Gemini Loop] Executing tool: ${callId}`, args);
        loggedToolCalls.push({ name: callId, args });

        let resultObj = {};
        if (callId === 'get_folder_structure') {
          resultObj = { structure: folderStructure };
        } else if (callId === 'read_file') {
          const fileId = args.fileId;
          const fileInfo = folderStructure.find((f: any) => f.id === fileId);
          const mimeType = fileInfo ? fileInfo.mimeType : 'application/octet-stream';
          
          try {
            const content = await this.driveRepository.downloadFileContent(fileId, mimeType, apiKey);
            resultObj = { content };
          } catch (err: any) {
            resultObj = { error: `Could not read file. Error: ${err.message}` };
          }
        }

        functionResponses.push({
          functionResponse: { name: callId, response: resultObj }
        });
      }

      contents.push({ role: 'function', parts: functionResponses });
      this.messageRepository.saveMessage(conversationId, 'function', JSON.stringify(functionResponses), null);
      loopCount++;
    }

    if (loopCount === maxLoops) {
      finalResponseText += "\n\n[Warning: Tool invocation limit reached]";
      this.messageRepository.saveMessage(conversationId, 'model', finalResponseText, null);
    }

    return { text: finalResponseText, toolCalls: loggedToolCalls };
  }

  private async runOpenAILoop(
    apiKey: string, 
    baseUrl: string, 
    model: string, 
    conversationId: string,
    dbMessages: Message[], 
    folderId: string, 
    folderStructure: any[],
    geminiApiKey?: string | null
  ): Promise<{ text: string, toolCalls: any[] }> {
    const openAIMessages: any[] = [];
    
    // 1. Detect if custom provider has an image model
    let hasImageGen = false;
    let imageModelName = '';
    try {
      const modelsList = await this.aiRepository.fetchAvailableModels('openai_compatible', apiKey, baseUrl);
      const imgModel = modelsList.find((m: any) => 
        m.category === 'image' || 
        m.capabilities?.image_generation === true ||
        /image|dalle|dall-e|flux|stable-diffusion|generation/i.test(m.id || '')
      );
      if (imgModel) {
        hasImageGen = true;
        imageModelName = imgModel.id;
      }
    } catch (err) {
      console.error('Failed to check for image generation capability:', err);
    }

    // Map messages to OpenAI format
    dbMessages.forEach((msg, index) => {
      if (msg.role === 'user') {
        openAIMessages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'model') {
        if (msg.toolCalls) {
          openAIMessages.push({
            role: 'assistant',
            tool_calls: msg.toolCalls.map((tc: any, tcIdx: number) => ({
              id: `call_${index}_${tcIdx}`,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.args)
              }
            }))
          });
        } else {
          openAIMessages.push({ role: 'assistant', content: msg.content });
        }
      } else if (msg.role === 'function') {
        try {
          const parts = JSON.parse(msg.content || '[]');
          parts.forEach((part: any, pIdx: number) => {
            const resp = part.functionResponse;
            openAIMessages.push({
              role: 'tool',
              tool_call_id: `call_${index}_${pIdx}`,
              name: resp.name,
              content: JSON.stringify(resp.response)
            });
          });
        } catch (err) {
          openAIMessages.push({
            role: 'tool',
            tool_call_id: `call_${index}`,
            name: 'get_folder_structure',
            content: msg.content
          });
        }
      }
    });

    const tools: any[] = [
      {
        type: 'function',
        function: {
          name: 'get_folder_structure',
          description: 'Returns the complete JSON tree structure of all files and folders in the connected Google Drive.',
          parameters: { type: 'OBJECT', properties: {} }
        }
      },
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Downloads and reads the content of a file (e.g. PDF, Image, Document, text) using its ID from the Drive.',
          parameters: {
            type: 'OBJECT',
            properties: {
              fileId: { type: 'STRING', description: 'The unique ID of the file to read.' },
              fileName: { type: 'STRING', description: 'The name of the file being read (optional).' }
            },
            required: ['fileId']
          }
        }
      }
    ];

    if (hasImageGen) {
      tools.push({
        type: 'function',
        function: {
          name: 'generate_image',
          description: 'Generates a new image based on a descriptive text prompt. Use this when the user asks to draw, generate, or create an image/picture.',
          parameters: {
            type: 'OBJECT',
            properties: {
              prompt: { type: 'STRING', description: 'A detailed description of the image to generate.' }
            },
            required: ['prompt']
          }
        }
      });
    }

    let systemContent = `You are an AI assistant helping a user explore their public Google Drive folder (ID: ${folderId}).
You have tools to get the folder structure and read files.
Always refer to files by their actual names.
If the user asks about the folder structure or what files are in it, call the "get_folder_structure" tool.
If the user wants you to analyze, summarize, or search inside a specific file, call the "read_file" tool with the correct file ID.
Since you can read PDFs and images, do not hesitate to call the "read_file" tool on them.`;

    if (hasImageGen) {
      systemContent += `\n\nAdditionally, you have the "generate_image" tool. If the user asks you to draw, generate, paint, or create an image/picture (e.g., "bikin gambar kucing", "draw a sunset"), call the "generate_image" tool. When the tool returns, it will provide a markdown image tag. You MUST copy and include this markdown tag exactly in your final text response so the user can view the image.`;
    }

    openAIMessages.unshift({ role: 'system', content: systemContent });

    let loopCount = 0;
    const maxLoops = 5;
    const loggedToolCalls: any[] = [];
    let finalResponseText = '';

    while (loopCount < maxLoops) {
      console.log(`[OpenAI Loop] Iteration ${loopCount + 1}`);
      const data = await this.aiRepository.chatCompletion(
        'openai_compatible',
        apiKey,
        baseUrl,
        model,
        openAIMessages,
        tools
      );

      const choice = data.choices?.[0];
      const assistantMsg = choice?.message;
      if (!assistantMsg) {
        throw new Error('Received an empty response from custom API provider.');
      }

      openAIMessages.push(assistantMsg);

      if (assistantMsg.content) {
        finalResponseText += assistantMsg.content;
      }

      const toolCalls = assistantMsg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        this.messageRepository.saveMessage(conversationId, 'model', finalResponseText, null);
        break;
      }

      const mappedCalls = toolCalls.map((tc: any) => ({
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments || '{}')
      }));

      this.messageRepository.saveMessage(conversationId, 'model', null, JSON.stringify(mappedCalls));

      const functionResponses: any[] = [];
      const results: any[] = [];

      for (const tc of toolCalls) {
        const callId = tc.function.name;
        const args = JSON.parse(tc.function.arguments || '{}');
        
        console.log(`[OpenAI Loop] Executing tool: ${callId}`, args);
        loggedToolCalls.push({ name: callId, args });

        let resultObj = {};
        if (callId === 'get_folder_structure') {
          resultObj = { structure: folderStructure };
        } else if (callId === 'read_file') {
          const fileId = args.fileId;
          const fileInfo = folderStructure.find((f: any) => f.id === fileId);
          const mimeType = fileInfo ? fileInfo.mimeType : 'application/octet-stream';
          
          try {
            const content = await this.driveRepository.downloadFileContent(fileId, mimeType, geminiApiKey, apiKey, baseUrl, model);
            resultObj = { content };
          } catch (err: any) {
            resultObj = { error: `Could not read file. Error: ${err.message}` };
          }
        } else if (callId === 'generate_image') {
          const promptText = args.prompt;
          console.log(`[Tool: generate_image] Generating image with model: ${imageModelName}, prompt: ${promptText}`);
          try {
            const markdownTag = await this.aiRepository.generateImage(baseUrl, apiKey, imageModelName, promptText);
            resultObj = { success: true, message: `Image generated successfully.`, markdown: markdownTag };
          } catch (err: any) {
            resultObj = { error: `Could not generate image. Error: ${err.message}` };
          }
        }

        results.push(resultObj);

        openAIMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: callId,
          content: JSON.stringify(resultObj)
        });
      }

      const partsResponse = toolCalls.map((tc: any, index: number) => ({
        functionResponse: {
          name: tc.function.name,
          response: results[index]
        }
      }));

      this.messageRepository.saveMessage(conversationId, 'function', JSON.stringify(partsResponse), null);
      loopCount++;
    }

    if (loopCount === maxLoops) {
      finalResponseText += "\n\n[Warning: Tool invocation limit reached]";
      this.messageRepository.saveMessage(conversationId, 'model', finalResponseText, null);
    }

    return { text: finalResponseText, toolCalls: loggedToolCalls };
  }
}
