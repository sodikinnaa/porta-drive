import type { AIRepository } from "../../application/repositories/ai.repository";

export class AIClientImpl implements AIRepository {
  async fetchAvailableModels(provider: string, apiKey: string, baseUrl?: string): Promise<any[]> {
    if (provider === 'gemini') {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const res = await fetch(geminiUrl);
      if (!res.ok) {
        throw new Error('Failed to authorize Gemini API Key. Please check the key.');
      }

      const data = await res.json();
      return (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => {
          const id = m.name.startsWith('models/') ? m.name.substring(7) : m.name;
          return { id, displayName: m.displayName || id };
        });
    } else if (provider === 'openai_compatible') {
      if (!baseUrl) {
        throw new Error('OpenAI Compatible Base URL is required.');
      }
      
      let finalBaseUrl = baseUrl;
      let openaiUrl = `${finalBaseUrl.replace(/\/$/, '')}/models`;
      let res = await fetch(openaiUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (!res.ok) {
        if (!finalBaseUrl.includes('/v1')) {
          const retryBaseUrl = `${finalBaseUrl.replace(/\/$/, '')}/v1`;
          const retryUrl = `${retryBaseUrl}/models`;
          const retryRes = await fetch(retryUrl, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          if (retryRes.ok) {
            res = retryRes;
            finalBaseUrl = retryBaseUrl;
          }
        }
      }

      if (!res.ok) {
        throw new Error('Failed to authorize OpenAI Provider. Check Base URL or API Key.');
      }

      const data = await res.json();
      const modelsList = Array.isArray(data) ? data : (data.data || []);
      return modelsList.map((m: any) => ({
        id: m.id || m.name,
        displayName: m.display_name || m.id || m.name,
        category: m.category || '',
        capabilities: m.capabilities || null
      }));
    } else {
      throw new Error('Invalid provider specified.');
    }
  }

  async chatCompletion(
    provider: string,
    apiKey: string,
    baseUrl: string | null,
    model: string,
    messages: any[],
    tools: any[],
    systemInstruction?: string
  ): Promise<any> {
    if (provider === 'gemini') {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload: any = { contents: messages, tools };
      if (systemInstruction) {
        payload.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API Error: ${errText}`);
      }

      return await res.json();
    } else {
      if (!baseUrl) throw new Error('OpenAI Compatible Base URL is required.');
      const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI compatible API returned an error: ${errText}`);
      }

      return await res.json();
    }
  }

  async generateImage(
    baseUrl: string,
    apiKey: string,
    model: string,
    prompt: string
  ): Promise<string> {
    const imgGenUrl = `${baseUrl.replace(/\/$/, '')}/images/generations`;
    const imgRes = await fetch(imgGenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        n: 1,
        size: '1024x1024'
      })
    });

    if (!imgRes.ok) {
      const errText = await imgRes.text();
      throw new Error(`Image generation failed: ${errText}`);
    }

    const imgData = await imgRes.json();
    if (imgData.data && imgData.data[0]) {
      const b64 = imgData.data[0].b64_json;
      const url = imgData.data[0].url;
      
      if (b64) {
        return `![Generated Image](data:image/png;base64,${b64})`;
      } else if (url) {
        return `![Generated Image](${url})`;
      }
    }
    throw new Error('No image data returned from provider.');
  }
}
