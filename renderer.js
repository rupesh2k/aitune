const { ipcRenderer, clipboard } = require('electron');

// Initialize the original text when the window loads
window.addEventListener('DOMContentLoaded', () => {
    // Load current clipboard content into the original text field
    try {
        const currentText = clipboard.readText();
        console.log('DEBUG: clipboard.readText() on load ->', currentText);
        // Debugger statement to pause if devtools open
        // debugger;
        document.getElementById('originalText').value = currentText;
    } catch (err) {
        console.error('Error reading clipboard on load:', err);
        document.getElementById('originalText').value = '';
    }

    // After exposing enhanceText globally, bind the button click
    const fixButton = document.getElementById('fixButton');
    if (fixButton) {
        fixButton.addEventListener('click', enhanceText);
    }
});

// Listen for text selection from main process
ipcRenderer.on('text-selected', (event, text) => {
    console.log('DEBUG: Received text-selected event ->', text);
    if (text && text.trim()) {
        document.getElementById('originalText').value = text;
    } else {
        document.getElementById('originalText').value = 'No text selected. Please select some text and try again.';
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
        alert('Error enhancing text. Please try again.');
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
        
        // Close the window
        window.close();
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