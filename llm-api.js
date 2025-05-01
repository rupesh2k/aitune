import OpenAI from 'openai';
import fetch from 'node-fetch';

class LLMHandler {
    constructor(config) {
        this.config = config;
        if (config.provider === 'openai') {
            this.openai = new OpenAI({
                apiKey: config.apiKey
            });
        }
    }

    async enhanceText(text) {
        if (this.config.provider === 'openai') {
            return this.enhanceWithOpenAI(text);
        } else if (this.config.provider === 'ollama') {
            return this.enhanceWithOllama(text);
        } else if (this.config.provider === 'lmstudio') {
            return this.enhanceWithLmstudio(text);
        }
        throw new Error('Invalid LLM provider');
    }

    async enhanceWithOpenAI(text) {
        try {
            const response = await this.openai.chat.completions.create({
                model: this.config.model || 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful writing assistant. Improve the following text while maintaining its original meaning and style. Make it more clear, concise, and professional.'
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI API error:', error);
            throw error;
        }
    }

    async enhanceWithOllama(text) {
        try {
            const response = await fetch(this.config.endpoint || 'http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.model || 'llama2',
                    prompt: `Improve the following text while maintaining its original meaning and style. Make it more clear, concise, and professional:\n\n${text}`,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error('Ollama API error:', error);
            throw error;
        }
    }

    async enhanceWithLmstudio(text) {
        try {
            // Send chat completion request to LM Studio endpoint
            const response = await fetch(this.config.endpoint || 'http://localhost:1234/api/v0/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [
                        { role: 'user', content: text }
                    ]
                })
            });
            if (!response.ok) {
                throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            // Expecting OpenAI-compatible response format
            return data.choices[0].message.content;
        } catch (error) {
            console.error('LM Studio API error:', error);
            throw error;
        }
    }

    // Stream-enhance text method for streaming responses
    async streamEnhanceText(text, onChunk) {
        if (this.config.provider === 'openai') {
            try {
                const stream = await this.openai.chat.completions.create({
                    model: this.config.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'You are a helpful writing assistant. Stream and improve the following text.' },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000,
                    stream: true
                });
                for await (const part of stream) {
                    const delta = part.choices[0].delta.content;
                    if (delta) onChunk(delta);
                }
            } catch (error) {
                console.error('Error streaming OpenAI response:', error);
                throw error;
            }
        } else if (this.config.provider === 'ollama') {
            // Ollama streaming is not implemented; fallback
            const full = await this.enhanceWithOllama(text);
            onChunk(full);
        } else {
            throw new Error('Invalid LLM provider for streaming');
        }
    }
}

export default LLMHandler; 