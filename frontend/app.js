// app.js
// Configure Markdown parser
marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: (code) => hljs.highlightAuto(code).value
});

let currentStream = null;
let attachedImages = [];

// Add this at the very top of app.js
const API_BASE_URL = 'http://localhost:3000';

// Modified model loading code
async function loadModels() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tags`, {
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        if (!data.models || !data.models.length) throw new Error('No models available');
        
        const select = document.getElementById('model-select');
        select.innerHTML = '';
        
        data.models.forEach(modelData => {
            const option = document.createElement('option');
            option.value = modelData.model;  // Use "model" field from response
            option.textContent = modelData.model;  // Display full model name
            select.appendChild(option);
        });

        // Enable UI components
        select.disabled = false;
        document.getElementById('user-input').disabled = false;
        
    } catch (error) {
        console.error('Model loading failed:', error);
        appendMessage('system', `Error: ${error.message}`);
        setTimeout(loadModels, 5000);
    }
}

// Modified initialization
window.onload = () => {
    loadModels();
    loadHistory();
};

// Updated sendMessage function
async function sendMessage() {
    const input = document.getElementById('user-input');
    const sendBtn = document.querySelector('button');
    const message = input.value.trim();
    const modelSelect = document.getElementById('model-select');
    const model = modelSelect.value;
    
    if (!model) {
        appendMessage('system', 'Please select a model first');
        return;
    }
    
    // Add validation for model format
    if (!model.includes(':')) {
        appendMessage('system', 'Invalid model format - use "model:tag" format');
        return;
    }

    if (!message) return;
    if (!model || modelSelect.disabled) {
        appendMessage('system', 'Please wait while models are loading...');
        return;
    }

    // Disable button during processing
    sendBtn.disabled = true;
    sendBtn.classList.remove('active');

    // Add user message with images
    appendMessage('user', message, attachedImages);
    input.value = '';
    
    // Collect full history BEFORE clearing images
    const messageElements = document.querySelectorAll('#messages .message');
    const messages = Array.from(messageElements).map(element => {
        const isUser = element.classList.contains('user-message');
        const messageObj = {
            role: isUser ? 'user' : 'assistant',
            content: element.querySelector('.content').textContent
        };
        
        // Only add images array if we have attachments
        if (isUser && element === messageElements[messageElements.length - 1] && attachedImages.length > 0) {
            messageObj.images = [...attachedImages]; 
        }
        
        return messageObj;
    });

    // Clear images AFTER API call preparation
    attachedImages = [];
    document.getElementById('image-previews').innerHTML = '';

    // Add bot message container
    const botMessageId = appendMessage('bot', '');

    try {
        currentStream = await streamChat({
            model: model,
            messages: messages
        }, botMessageId);
    } catch (error) {
        updateMessage(botMessageId, `Error: ${error.message}`);
    }

    // Re-enable if message failed to send
    if (!currentStream) {
        sendBtn.disabled = false;
        if (input.value.trim()) sendBtn.classList.add('active');
    }
}

// Add keypress handler for input
document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});

// Update input listener to consider model loading state
document.getElementById('user-input').addEventListener('input', function(e) {
    const sendBtn = document.querySelector('button');
    const hasText = e.target.value.trim();
    const modelsLoaded = !document.getElementById('model-select').disabled;
    
    sendBtn.disabled = !(hasText && modelsLoaded);
    sendBtn.classList.toggle('active', hasText && modelsLoaded);
});

// Modified appendMessage function
function appendMessage(role, content, images = []) {
    const messagesDiv = document.getElementById('messages');
    const messageId = `msg-${Date.now()}-${role}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = `message ${role}-message`;
    
    // Create content container once
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    
    if (role === 'bot') {
        // Add typing indicator as separate elements
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        contentDiv.appendChild(typingIndicator);
    }
    
    // Add initial content as text node
    contentDiv.appendChild(document.createTextNode(content));
    messageDiv.appendChild(contentDiv);

    // Add images if present
    if (images.length > 0) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';
        images.forEach(imgData => {
            const img = document.createElement('img');
            img.className = 'message-image';
            img.src = `data:image/jpeg;base64,${imgData}`; // Display with prefix
            imageContainer.appendChild(img);
        });
        messageDiv.appendChild(imageContainer);
    }
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // Save to local storage
    saveHistory();
    
    return messageId;
}

// Modified updateMessage function
function updateMessage(id, newContent) {
    const messageDiv = document.getElementById(id);
    if (messageDiv) {
        const contentSpan = messageDiv.querySelector('.content');
        if (contentSpan) {
            const typingIndicator = contentSpan.querySelector('.typing-indicator');
            if (typingIndicator) {
                contentSpan.removeChild(typingIndicator);
            }
            
            if (messageDiv.classList.contains('bot-message')) {
                const sanitized = DOMPurify.sanitize(marked.parse(newContent));
                contentSpan.innerHTML = sanitized;
                
                // Add copy buttons to code blocks
                contentSpan.querySelectorAll('pre > code').forEach(pre => {
                    const button = document.createElement('button');
                    button.className = 'copy-button';
                    // button.textContent = '';
                    button.onclick = () => {
                        navigator.clipboard.writeText(pre.textContent).then(() => {
                            // button.textContent = 'Copied!';
                            button.classList.add('copied');
                            setTimeout(() => {
                                button.textContent = '';
                                button.classList.remove('copied');
                            }, 2000);
                        }).catch(err => {
                            button.textContent = 'Failed';
                            console.error('Copy failed:', err);
                        });
                    };
                    pre.parentElement.insertBefore(button, pre);
                });
            } else {
                contentSpan.textContent = newContent;
            }
            
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Save updated message to local storage
            saveHistory();
        }
    }
}

// Add to app.js
document.getElementById('settings-button').addEventListener('click', (e) => {
    e.stopPropagation();
    const panel = document.getElementById('settings-panel');
    panel.classList.toggle('show');
});

// Close settings when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.settings-dropdown')) {
        document.getElementById('settings-panel').classList.remove('show');
    }
});

// Update streamChat function to use parameters
async function streamChat(chatData, messageId) {
    const systemPrompt = document.getElementById('system-prompt-input').value;
    
    // Get last message from chatData instead of attachedImages
    const lastMessage = chatData.messages[chatData.messages.length - 1];
    
    // No need to modify the message here - it already contains images
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ 
            ...chatData, 
            stream: true,
            system_prompt: systemPrompt || null,
            temperature: parseFloat(document.getElementById('temperature').value),
            top_p: parseFloat(document.getElementById('top-p').value),
            max_tokens: parseInt(document.getElementById('max-tokens').value),
            top_k: parseInt(document.getElementById('top-k').value),
            presence_penalty: parseFloat(document.getElementById('presence-penalty').value),
            seed: Date.now() % 1000000
        })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';  // Track complete response

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        while (buffer.includes('\n\n')) {
            const eventEnd = buffer.indexOf('\n\n');
            const eventData = buffer.slice(0, eventEnd);
            buffer = buffer.slice(eventEnd + 2);

            if (eventData.startsWith('data: ')) {
                const jsonData = eventData.replace('data: ', '');
                if (jsonData === '[DONE]') break;
                
                try {
                    const { content, error } = JSON.parse(jsonData);
                    if (error) {
                        updateMessage(messageId, `\n[ERROR: ${error}]`);
                        break;
                    }
                    fullResponse += content;
                    updateMessage(messageId, fullResponse);  // Update with full response
                } catch (e) {
                    console.error('Error parsing event:', e);
                }
            }
        }
    }
}

// Add to app.js initialization
document.getElementById('new-conversation').addEventListener('click', () => {
    document.getElementById('messages').innerHTML = '';
    document.getElementById('system-prompt-input').value = '';
    localStorage.removeItem('chatHistory');
});

// Update the download handler in app.js
document.getElementById('download-model').addEventListener('click', async () => {
    const modelName = prompt(`Enter model name to download (format: repository:tag)\nFind models at: https://ollama.com/library\nExample: llama2:7b`, 'llama2:7b');
    if (!modelName) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/pull`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ llm_name: modelName })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        // Create progress element
        const progressTemplate = document.getElementById('progress-template');
        const progressClone = progressTemplate.content.cloneNode(true);
        const progressContainer = progressClone.querySelector('.progress-container');
        const progressFill = progressClone.querySelector('.progress-fill');
        const progressPercentage = progressClone.querySelector('.progress-percentage');
        const progressStatus = progressClone.querySelector('.progress-status');
        
        // Insert progress bar at bottom of messages
        const messagesDiv = document.getElementById('messages');
        messagesDiv.appendChild(progressClone);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            while (buffer.includes('\n\n')) {
                const eventEnd = buffer.indexOf('\n\n');
                const eventData = buffer.slice(0, eventEnd);
                buffer = buffer.slice(eventEnd + 2);

                if (eventData.startsWith('data: ')) {
                    const jsonData = eventData.replace('data: ', '');
                    try {
                        const progress = JSON.parse(jsonData);
                        
                        if (progress.status === 'error') {
                            progressContainer.classList.add('error');
                            progressStatus.textContent = `Error: ${progress.message || 'Unknown error'}`;
                            return;
                        }
                        
                        if (progress.status === 'success') {
                            progressContainer.classList.add('complete');
                            progressFill.style.width = '100%';
                            progressPercentage.textContent = '100%';
                            progressStatus.textContent = 'Download complete!';
                            loadModels();
                            return;
                        }
                        
                        // Calculate percentage
                        let percentage = 0;
                        if (progress.completed && progress.total) {
                            percentage = Math.round((progress.completed / progress.total) * 100);
                            progressFill.style.width = `${percentage}%`;
                            progressPercentage.textContent = `${percentage}%`;
                        }
                        
                        // Update status
                        const statusMessage = progress.message || progress.status || 'Downloading...';
                        progressStatus.textContent = statusMessage;

                    } catch (e) {
                        console.error('Error parsing progress:', e);
                    }
                }
            }
        }
    } catch (error) {
        if (progressContainer) {
            progressContainer.classList.add('error');
            progressStatus.textContent = `Failed: ${error.message}`;
        }
    }
});

// Add to app.js initialization
document.getElementById('model-help').addEventListener('click', () => {
    const modal = document.getElementById('model-help-modal');
    modal.classList.toggle('show');
});

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('model-help-modal');
    if (!e.target.closest('#model-help-modal') && !e.target.matches('#model-help')) {
        modal.classList.remove('show');
    }
});

// Add new saveHistory function
function saveHistory() {
    const messageElements = document.querySelectorAll('#messages .message');
    const history = Array.from(messageElements).map(element => {
        const isUser = element.classList.contains('user-message');
        return {
            role: isUser ? 'user' : 'assistant',
            content: element.querySelector('.content').textContent
        };
    });
    localStorage.setItem('chatHistory', JSON.stringify(history));
}

// Add new loadHistory function
function loadHistory() {
    const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
    history.forEach(msg => {
        appendMessage(msg.role, msg.content);
    });
}

// Update image preview handling to store raw base64
document.getElementById('image-upload').addEventListener('change', async function(e) {
    const files = e.target.files;
    attachedImages = [];
    
    // Clear previous previews
    const previewContainer = document.getElementById('image-previews');
    previewContainer.innerHTML = '';
    
    for (let file of files) {
        const reader = new FileReader();
        reader.onload = () => {
            // Extract ONLY the base64 part
            const base64Data = reader.result.split(',')[1];
            attachedImages.push(base64Data);
            
            // Create preview with correct MIME type
            const img = document.createElement('img');
            img.src = `data:${file.type};base64,${base64Data}`; // Use actual file type
            img.className = 'upload-preview';
            img.title = 'Click to remove';
            
            // Add remove functionality
            img.onclick = () => {
                const index = attachedImages.indexOf(base64Data);
                if (index > -1) {
                    attachedImages.splice(index, 1);
                }
                previewContainer.removeChild(img);
            };
            
            previewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    }
});

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}