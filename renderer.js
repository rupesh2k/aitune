const { ipcRenderer, clipboard } = require('electron');
const { encode } = require('gpt-3-encoder');

// Initialize the original text when the window loads
window.addEventListener('DOMContentLoaded', () => {
    // Add drag event handling for the header bar
    const headerBar = document.querySelector('.header-bar');
    if (headerBar) {
        headerBar.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('header-bar') || e.target.classList.contains('app-title')) {
                e.preventDefault();
            }
        });
    }

    // Load current clipboard content into the original text field
    try {
        const currentText = clipboard.readText();
        console.log('DEBUG: clipboard.readText() on load ->', currentText);
        // Debugger statement to pause if devtools open
        // debugger;
        document.getElementById('originalText').value = currentText;
        // Update token count on load
        updateTokenCount();
    } catch (err) {
        console.error('Error reading clipboard on load:', err);
        document.getElementById('originalText').value = '';
    }

    // After exposing enhanceText globally, bind the button click
    const fixButton = document.getElementById('fixButton');
    if (fixButton) {
        fixButton.addEventListener('click', enhanceText);
    }
    // Bind input event on original text to update token count
    const originalEl = document.getElementById('originalText');
    originalEl.addEventListener('input', updateTokenCount);

    // Display provider, model, and cost info
    showConfigInfo();

    const copyEnhancedBtn = document.getElementById('copyEnhancedBtn');
    if (copyEnhancedBtn) {
        copyEnhancedBtn.addEventListener('click', () => {
            const text = document.getElementById('enhancedText').value;
            clipboard.writeText(text);
            alert('Enhanced text copied to clipboard');
        });
    }
    const resetBtn = document.getElementById('resetButton');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            document.getElementById('originalText').value = '';
            document.getElementById('enhancedText').value = '';
            updateTokenCount();
        });
    }

    const closeBtn = document.getElementById('closeBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('DEBUG: closeBtn clicked, sending close-main-window');
            ipcRenderer.send('close-main-window');
        });
    }

    const closeFooterBtn = document.getElementById('closeFooterBtn');
    if (closeFooterBtn) {
        closeFooterBtn.addEventListener('click', () => {
            console.log('DEBUG: closeFooterBtn clicked, sending close-main-window');
            ipcRenderer.send('close-main-window');
        });
    }

    // Voice input functionality removed
});

// Listen for text selection from main process
ipcRenderer.on('text-selected', (event, text) => {
    console.log('DEBUG: Received text-selected event ->', text);
    if (text && text.trim()) {
        document.getElementById('originalText').value = text;
        updateTokenCount();
    } else {
        document.getElementById('originalText').value = 'No text selected. Please select some text and try again.';
        updateTokenCount();
    }
});

// Handle streaming chunks and append to enhanced text
ipcRenderer.on('enhance-text-chunk', (event, chunk) => {
    const enhancedEl = document.getElementById('enhancedText');
    // On first chunk, ensure existing content is not duplicated
    enhancedEl.value += chunk;
});

// Handle streaming errors
ipcRenderer.on('enhance-text-error', (event, errorMsg) => {
    console.error('Stream error from main:', errorMsg);
    alert(`Error enhancing text: ${errorMsg}`);
});

// After other ipcRenderer.on calls
/*
ipcRenderer.on('trigger-enhance', () => {
    // Trigger the same flow as clicking the Fix with AI button
    enhanceText();
});
*/
async function enhanceText() {
    const originalText = document.getElementById('originalText').value;
    if (!originalText.trim() || originalText === 'No text selected. Please select some text and try again.') {
        alert('Please select some text first');
        return;
    }

    try {
        // Clear previous enhanced text
        const enhancedEl = document.getElementById('enhancedText');
        enhancedEl.value = '';
        // Remove existing listeners to avoid duplicates
        ipcRenderer.removeAllListeners('enhance-text-chunk');
        // Stream enhanced text chunks
        ipcRenderer.on('enhance-text-chunk', (event, chunk) => {
            enhancedEl.value += chunk;
        });
        ipcRenderer.send('stream-enhance-text', originalText);
    } catch (error) {
        console.error('Error enhancing text:', error);
        // Show the specific error message (e.g., quota exceeded)
        alert(`Error enhancing text: ${error.message}`);
    }
}

async function acceptChanges() {
    const enhancedText = document.getElementById('enhancedText').value;
    if (!enhancedText.trim()) {
        alert('No enhanced text available');
        return;
    }

    try {
        // Copy enhanced text to clipboard
        clipboard.writeText(enhancedText);
        
        // Note: Pasting will use system paste after close
        
        // Hide the window via main process
        ipcRenderer.send('close-main-window');
    } catch (error) {
        console.error('Error accepting changes:', error);
        alert('Error accepting changes. Please try again.');
    }
}

// Copy original text to clipboard
function copyOriginal() {
    const originalText = document.getElementById('originalText').value;
    if (originalText && originalText.trim() && originalText !== 'No text selected. Please select some text and try again.') {
        clipboard.writeText(originalText);
        alert('Original text copied to clipboard');
    } else {
        alert('No original text to copy');
    }
}

// Expose the enhanceText function globally for popup.html onclick
window.enhanceText = enhanceText;

// Token count updater function
function updateTokenCount() {
    const text = document.getElementById('originalText').value || '';
    const count = encode(text).length;
    const tokenEl = document.getElementById('tokenCount');
    if (tokenEl) tokenEl.innerText = `Tokens: ${count}`;
}

// Display provider and model info
async function showConfigInfo() {
    try {
        const cfg = await ipcRenderer.invoke('get-llm-config');
        const infoEl = document.getElementById('configInfo');
        if (infoEl) {
            infoEl.innerText = `Provider: ${cfg.provider} | Model: ${cfg.model}`;
        }
    } catch (err) {
        console.error('Error fetching config for display:', err);
    }
} 