// Chat application JavaScript
class ChatApp {
    constructor() {
        this.sessionId = null;
        this.conversationId = null;
        this.isEscalated = false;
        this.isTyping = false;
        
        this.init();
    }
    
    init() {
        // DOM elements
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messages = document.getElementById('messages');
        this.chatForm = document.getElementById('chatForm');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.sessionIndicator = document.getElementById('sessionIndicator');
        this.sessionStatus = document.getElementById('sessionStatus');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.escalationModal = document.getElementById('escalationModal');
        this.escalationForm = document.getElementById('escalationForm');
        this.modalClose = document.getElementById('modalClose');
        this.cancelEscalation = document.getElementById('cancelEscalation');
        this.suggestions = document.querySelector('.suggestions');
        
        // Event listeners
        this.setupEventListeners();
        
        // Initialize session
        this.startSession();
        this.checkSessionStatus();
        
        // Auto-resize textarea
        this.setupTextareaAutoResize();
        
        // Check session status periodically
        setInterval(() => this.checkSessionStatus(), 60000); // Every minute
    }
    
    setupEventListeners() {
        // Send message
        this.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
        
        // Enter key to send (Shift+Enter for new line)
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // New chat button
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
        
        // Escalation modal
        this.modalClose.addEventListener('click', () => this.closeEscalationModal());
        this.cancelEscalation.addEventListener('click', () => this.closeEscalationModal());
        this.escalationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitEscalation();
        });
        
        // Close modal on overlay click
        this.escalationModal.addEventListener('click', (e) => {
            if (e.target === this.escalationModal) {
                this.closeEscalationModal();
            }
        });
    }
    
    setupTextareaAutoResize() {
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        });
    }
    
    async startSession() {
        try {
            // Check if we have a conversation_id in sessionStorage
            const storedConversationId = sessionStorage.getItem('conversation_id');
            
            if (storedConversationId) {
                // Try to load existing conversation
                const response = await fetch('/api/start_session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        load_existing: true,
                        conversation_id: storedConversationId
                    })
                });
                
                const data = await response.json();
                
                if (data.success && data.loaded) {
                    this.conversationId = data.conversation_id;
                    sessionStorage.setItem('conversation_id', this.conversationId);
                    
                    // Load messages
                    if (data.messages && data.messages.length > 0) {
                        this.messages.innerHTML = '';
                        data.messages.forEach(msg => {
                            this.addMessage(msg.role, msg.content);
                        });
                        // Hide suggestions if conversation has messages
                        if (this.suggestions) {
                            this.suggestions.style.display = 'none';
                        }
                    }
                    
                    if (data.escalated) {
                        this.isEscalated = true;
                    }
                    
                    return;
                }
            }
            
            // Create new session
            const response = await fetch('/api/start_session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ load_existing: false })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.conversationId = data.conversation_id;
                sessionStorage.setItem('conversation_id', this.conversationId);
                
                // Show welcome message if provided
                if (data.welcome_message) {
                    this.messages.innerHTML = '';
                    this.addMessage('assistant', data.welcome_message);
                }
                
                // Show suggestions for new sessions
                if (this.suggestions) {
                    this.suggestions.style.display = 'flex';
                }
            }
        } catch (error) {
            console.error('Error starting session:', error);
            this.showError('Failed to start session. Please refresh the page.');
        }
    }
    
    async startNewChat() {
        try {
            const response = await fetch('/api/new-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.conversationId = data.conversation_id;
                sessionStorage.setItem('conversation_id', this.conversationId);
                this.isEscalated = false;
                
                // Clear messages and show welcome
                this.messages.innerHTML = '';
                this.addMessage('assistant', 'Welcome to Strength Club! I\'m here if you have any questions about training, nutrition, or coaching. What can I help you with today?');
                
                // Show suggestions for new chat
                if (this.suggestions) {
                    this.suggestions.style.display = 'flex';
                }
            }
        } catch (error) {
            console.error('Error starting new chat:', error);
            this.showError('Failed to start new chat. Please try again.');
        }
    }
    
    async sendMessage(messageText = null) {
        const message = messageText || this.messageInput.value.trim();
        
        if (!message || this.isTyping || this.isEscalated) {
            return;
        }
        
        // Hide suggestions after first message
        if (this.suggestions) {
            this.suggestions.style.display = 'none';
        }
        
        // Add user message to UI
        this.addMessage('user', message);
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    session_id: this.conversationId
                })
            });
            
            const data = await response.json();
            
            this.hideTypingIndicator();
            
            if (data.response) {
                this.addMessage('assistant', data.response);
                
                // Update conversation_id if provided
                if (data.session_id) {
                    this.conversationId = data.session_id;
                    sessionStorage.setItem('conversation_id', this.conversationId);
                }
                
                // Check for escalation
                if (data.escalation_needed) {
                    this.isEscalated = true;
                    setTimeout(() => {
                        this.showEscalationModal();
                    }, 500);
                }
            } else if (data.error) {
                this.showError(data.error);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.showError('Failed to send message. Please try again.');
        }
    }
    
    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role === 'user' ? 'user-message' : 'bot-message'}`;
        
        const avatar = role === 'user' 
            ? '<div class="message-avatar user-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></div>'
            : '<div class="message-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg></div>';
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            ${avatar}
            <div class="message-content">
                <div class="message-text">${this.formatMessage(content)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
        
        this.messages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    formatMessage(text) {
        // Convert markdown-style formatting to HTML
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/\n/g, '<br>');
        return text;
    }
    
    showTypingIndicator() {
        this.isTyping = true;
        this.typingIndicator.style.display = 'block';
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        this.isTyping = false;
        this.typingIndicator.style.display = 'none';
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }
    
    showEscalationModal() {
        this.escalationModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    closeEscalationModal() {
        this.escalationModal.style.display = 'none';
        document.body.style.overflow = '';
        this.escalationForm.reset();
    }
    
    async submitEscalation() {
        const formData = {
            name: document.getElementById('escalationName').value,
            phone: document.getElementById('escalationPhone').value,
            goal: document.getElementById('escalationGoal').value,
            preference: document.getElementById('escalationPreference').value,
            reason: document.getElementById('escalationReason').value || 'Customer requested human assistance'
        };
        
        if (!formData.name || !formData.phone) {
            alert('Please fill in all required fields.');
            return;
        }
        
        try {
            // Ensure conversation is saved before escalating
            // The backend will save the conversation when escalation is submitted
            const response = await fetch('/api/escalate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contact_info: {
                        name: formData.name,
                        phone: formData.phone,
                        goal: formData.goal,
                        preference: formData.preference
                    },
                    reason: formData.reason
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.closeEscalationModal();
                this.addMessage('assistant', data.message || 'Your conversation has been escalated to our support team. A representative will contact you within 24 hours.');
            } else {
                alert('Failed to submit escalation. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting escalation:', error);
            alert('Failed to submit escalation. Please try again.');
        }
    }
    
    async checkSessionStatus() {
        try {
            const response = await fetch('/api/session_info');
            const data = await response.json();
            
            if (data.success && data.session) {
                const session = data.session;
                const isActive = session.last_activity && new Date(session.last_activity) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                
                if (isActive) {
                    this.sessionStatus.textContent = 'Active';
                    this.sessionStatus.className = 'session-status active';
                } else {
                    this.sessionStatus.textContent = 'Expired';
                    this.sessionStatus.className = 'session-status expired';
                }
            }
        } catch (error) {
            console.error('Error checking session status:', error);
        }
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        this.messages.appendChild(errorDiv);
        this.scrollToBottom();
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is ready
let chatApp;
document.addEventListener('DOMContentLoaded', () => {
    chatApp = new ChatApp();
});

// Global function for suggestion buttons
function usePrompt(promptText) {
    if (chatApp) {
        chatApp.sendMessage(promptText);
    }
}

