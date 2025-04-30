# AI Tune

A cross-platform desktop application that enhances selected text using AI language models.

## Features

- Runs in the system tray
- Global text selection support
- Hotkey trigger (Ctrl+Alt+I)
- AI text enhancement
- Support for OpenAI and Ollama
- Modern, user-friendly interface

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your LLM settings in `config.json`:
   - For OpenAI: Set your API key and provider
   - For Ollama: Set the provider and endpoint

## Usage

1. Start the application:
   ```bash
   npm start
   ```
2. Select text in any application
3. Press Ctrl+Alt+I to trigger the enhancement
4. Click "Fix with AI" to enhance the text
5. Click "Accept" to apply the changes or "Reject" to cancel

## Development

To run the application in development mode:
```bash
npm run dev
```

## Building

To build the application for distribution:
```bash
npm run build
```

## Configuration

Edit `config.json` to configure:
- LLM provider (openai or ollama)
- API key (for OpenAI)
- Model selection
- Endpoint (for Ollama)

## Requirements

- Node.js 16+
- Electron 28+
- OpenAI API key (if using OpenAI)
- Ollama running locally (if using Ollama)

## License

MIT 