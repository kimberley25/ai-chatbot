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
        this.discoveryContainer = document.getElementById('discoveryContainer');
        this.discoveryChips = document.getElementById('discoveryChips');
        this.discoveryLabel = document.getElementById('discoveryLabel');
        
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
        
        // Discovery chips are handled via click events on individual chips
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
                        // Check if the last message from assistant is a discovery question
                        const lastAssistantMessage = data.messages.filter(m => m.role === 'assistant').pop();
                        if (lastAssistantMessage) {
                            this.checkForDiscoveryQuestion(lastAssistantMessage.content);
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
                    // Check if welcome message is a discovery question
                    this.checkForDiscoveryQuestion(data.welcome_message);
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
                const welcomeMsg = 'Welcome to Strength Club! I\'m here if you have any questions about training, nutrition, or coaching. What can I help you with today?';
                this.messages.innerHTML = '';
                this.addMessage('assistant', welcomeMsg);
                // Check if welcome message is a discovery question
                this.checkForDiscoveryQuestion(welcomeMsg);
                
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
        
        // Hide discovery chips when sending message
        this.hideDiscoveryChips();
        
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
                
                // Check if bot is asking a discovery question and show chips
                // Use setTimeout to ensure DOM is fully updated
                setTimeout(() => {
                    this.checkForDiscoveryQuestion(data.response);
                }, 100);
                
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
    
    checkForDiscoveryQuestion(botMessage) {
        const message = botMessage.toLowerCase();
        
        // Training experience question - check FIRST (most specific patterns)
        if (message.includes('training experience') || 
            message.includes('experience level') || 
            message.includes('what is your experience') || 
            message.includes('describe your training experience') ||
            message.includes('let me know your training experience') ||
            message.includes('are you a beginner') ||
            message.includes('beginner, intermediate') ||
            message.includes('advanced/competitive') ||
            message.includes('advanced or competitive')) {
            this.showDiscoveryChips('What is your training experience level?', [
                { value: 'Beginner', text: 'Beginner' },
                { value: 'Intermediate', text: 'Intermediate' },
                { value: 'Advanced / Competitive', text: 'Advanced / Competitive' }
            ]);
            return;
        }
        
        // Primary goal question - be very specific to avoid false matches
        // Only match when explicitly asking about goals, not when goal is mentioned in context
        if (message.includes('primary goal') || 
            message.includes('what is your goal') ||
            message.includes('what\'s your goal') ||
            (message.includes('what') && message.includes('goal') && 
             (message.includes('nutrition coaching') || message.includes('strength') || 
              message.includes('powerlifting performance') || message.includes('competition preparation')) &&
             !message.includes('training experience') && !message.includes('experience level'))) {
            this.showDiscoveryChips('What is your primary goal?', [
                { value: 'Nutrition Coaching (fat loss/muscle gain)', text: 'Nutrition Coaching (fat loss/muscle gain)' },
                { value: 'Strength / powerlifting performance', text: 'Strength / powerlifting performance' },
                { value: 'Competition preparation', text: 'Competition preparation' }
            ]);
            return;
        }
        
        // Age question detection
        if (message.includes('age range') || 
            message.includes('how old are you') ||
            message.includes('how old') || 
            message.includes('can i ask how old') ||
            (message.includes('age') && (message.includes('what') || message.includes('tell me') || message.includes('let me know') || message.includes('can i ask')))) {
            this.showDiscoveryChips('What is your age range?', [
                { value: 'Under 18', text: 'Under 18' },
                { value: '18-29', text: '18-29' },
                { value: '30-39', text: '30-39' },
                { value: '40+', text: '40+' }
            ]);
            return;
        }
        
        // Check-in frequency question (for Online Coaching and Nutrition) - check FIRST before coaching preference
        // Check for weekly/fortnightly patterns first, then exclude if it's a recommendation
        if ((message.includes('weekly or fortnightly') ||
             message.includes('fortnightly or weekly') ||
             message.includes('prefer weekly or fortnightly') ||
             (message.includes('weekly') && message.includes('fortnightly') && 
              (message.includes('prefer') || message.includes('would you') || message.includes('how often'))) ||
             (message.includes('how often') && (message.includes('weekly') || message.includes('fortnightly'))) ||
             ((message.includes('check') && (message.includes('in') || message.includes('-in'))) && 
              (message.includes('weekly') || message.includes('fortnightly') || message.includes('frequency')))) &&
            !message.includes('would be a perfect fit') &&
            !message.includes('pricing') &&
            !message.includes('per week') &&
            !message.includes('next step') &&
            !message.includes('recommend') &&
            !message.includes('perfect fit')) {
            this.showDiscoveryChips('How often would you like check-ins?', [
                { value: 'Weekly check-ins', text: 'Weekly' },
                { value: 'Fortnightly check-ins', text: 'Fortnightly' }
            ]);
            return;
        }
        
        // Coaching preference question - make sure it doesn't match check-in frequency questions
        // Check if message asks about coaching preference but NOT check-in frequency
        const hasWeeklyFortnightly = message.includes('weekly') || message.includes('fortnightly');
        const hasCheckIn = message.includes('check-in') || message.includes('check in');
        
        // Allow coaching preference even after explaining Full Athlete Package (which includes pricing)
        const isExplainingPackage = message.includes('full athlete package') && 
                                     (message.includes('includes') || message.includes('pricing') || message.includes('per week'));
        
        if (!hasWeeklyFortnightly && !hasCheckIn &&
            (message.includes('coaching preference') || 
             message.includes('open to recommendations') ||
             (message.includes('would you prefer') && 
              (message.includes('online coaching') || message.includes('in-person coaching')) &&
              (message.includes('online coaching') || message.includes('in-person coaching') || message.includes('recommendations'))) ||
             (message.includes('prefer online coaching')) ||
             (message.includes('prefer in-person')) ||
             (message.includes('online coaching') && message.includes('in-person coaching') && 
              (message.includes('prefer') || message.includes('recommendation'))) ||
             (isExplainingPackage && (message.includes('would you prefer') || message.includes('coaching preference'))))) {
            this.showDiscoveryChips('What is your coaching preference?', [
                { value: 'Online coaching', text: 'Online coaching' },
                { value: 'In-person coaching', text: 'In-person coaching' },
                { value: 'Not sure / open to recommendations', text: 'Not sure / open to recommendations' }
            ]);
            return;
        }
        // Don't show chips if bot is making a recommendation/plan suggestion
        if (!message.includes('would be a perfect fit') &&
            !message.includes('pricing') &&
            !message.includes('per week') &&
            !message.includes('next step') &&
            !message.includes('recommend') &&
            !message.includes('perfect fit') &&
            (message.includes('weekly or fortnightly') ||
             message.includes('fortnightly or weekly') ||
             message.includes('prefer weekly or fortnightly') ||
             (message.includes('how often would you like') && !message.includes('next step')) ||
             ((message.includes('check') && (message.includes('in') || message.includes('-in'))) && 
              (message.includes('weekly') || message.includes('fortnightly') || message.includes('frequency')) &&
              !message.includes('pricing') && !message.includes('per week')) ||
             ((message.includes('weekly') && message.includes('fortnightly')) && 
              (message.includes('prefer') || message.includes('would you') || message.includes('how often')) &&
              !message.includes('pricing')) ||
             (message.includes('how often') && (message.includes('weekly') || message.includes('fortnightly')) &&
              !message.includes('pricing') && !message.includes('per week')))) {
            this.showDiscoveryChips('How often would you like check-ins?', [
                { value: 'Weekly check-ins', text: 'Weekly' },
                { value: 'Fortnightly check-ins', text: 'Fortnightly' }
            ]);
            return;
        }
        
        // Services explanation - show interest chips after explaining what we offer
        if ((message.includes('services') || message.includes('offer') || message.includes('coaching options')) &&
            (message.includes('online coaching') || message.includes('club coaching') || 
             message.includes('nutrition coaching') || message.includes('1-to-1') ||
             message.includes('full athlete'))) {
            this.showDiscoveryChips('What are you interested in?', [
                { value: 'I want to get stronger', text: 'Build Strength' },
                { value: 'I want to compete', text: 'Competition Preparation' },
                { value: 'I need help with nutrition', text: 'Nutrition Coaching' }
            ]);
            return;
        }
        
        // Nutrition goal question (Flow 3: Nutrition)
        if (message.includes('nutrition goal') || 
            message.includes('what is your nutrition goal') ||
            (message.includes('nutrition') && (message.includes('goal') || message.includes('aiming for'))) ||
            (message.includes('aiming for') && (message.includes('muscle gain') || message.includes('fat loss') || message.includes('maintain'))) ||
            ((message.includes('muscle gain') || message.includes('fat loss') || message.includes('maintain')) &&
             (message.includes('what') || message.includes('which') || message.includes('tell me') || message.includes('are you') || message.includes('aiming'))) ||
            (message.includes('primary goal') && message.includes('looking for') && 
             (message.includes('fat loss') || message.includes('muscle gain')))) {
            this.showDiscoveryChips('What is your primary goal?', [
                { value: 'Build muscle', text: 'Build muscle' },
                { value: 'Fat loss / body recomposition', text: 'Fat loss / body recomposition' },
                { value: 'Maintain weight / healthier habits', text: 'Maintain weight / healthier habits' }
            ]);
            return;
        }
        
        // Training context question (Flow 3: Nutrition - optional)
        if ((message.includes('training context') || 
             message.includes('currently training') ||
             message.includes('are you training') ||
             message.includes('are you currently training') ||
             message.includes('what is your training context') ||
             (message.includes('training') && (message.includes('currently') || message.includes('context')) &&
              !message.includes('experience') && !message.includes('level')))) {
            this.showDiscoveryChips('What is your training context?', [
                { value: 'Currently training', text: 'Currently training' },
                { value: 'Not currently training', text: 'Not currently training' },
                { value: 'Planning to start training', text: 'Planning to start training' }
            ]);
            return;
        }
        
        // Competed before question (Flow 2: Competition)
        if (message.includes('competed before') || 
            message.includes('have you competed') ||
            message.includes('have you ever competed') ||
            message.includes('competed in a powerlifting') ||
            message.includes('competed in powerlifting') ||
            (message.includes('competition') && message.includes('before') && 
             (message.includes('have') || message.includes('ever') || message.includes('you')))) {
            this.showDiscoveryChips('Have you competed before?', [
                { value: 'Yes', text: 'Yes' },
                { value: 'No', text: 'No' }
            ]);
            return;
        }
        
        // Package type question (Flow 2: Competition - training only vs full athlete)
        // Only show if bot is asking about package choice, not if it's explaining/recommending
        const isAskingPackage = message.includes('training only') ||
                                 message.includes('training-only') ||
                                 message.includes('full athlete package') ||
                                 message.includes('would you like training only') ||
                                 message.includes('would you like to choose') ||
                                 message.includes('are you interested in the full athlete') ||
                                 (message.includes('would you like') && 
                                  (message.includes('training only') || message.includes('training-only') || message.includes('full athlete') || message.includes('package')) &&
                                  !message.includes('coaching preference')) ||
                                 (message.includes('choose') && 
                                  (message.includes('training') || message.includes('package')) &&
                                  (message.includes('or') || message.includes('full athlete'))) ||
                                 ((message.includes('package') || message.includes('both')) &&
                                  (message.includes('training') && message.includes('nutrition')) &&
                                  (message.includes('which') || message.includes('what') || message.includes('would you') || message.includes('choose'))) ||
                                 (message.includes('which') && (message.includes('package') || message.includes('training only') || message.includes('full athlete')));
        
        const isRecommending = message.includes('recommend') ||
                               (message.includes('pricing') && !message.includes('would you like')) ||
                               (message.includes('per week') && !message.includes('would you like')) ||
                               (message.includes('includes') && !message.includes('would you like') && !message.includes('choose')) ||
                               message.includes('would be a perfect fit');
        
        if (isAskingPackage && !isRecommending) {
            this.showDiscoveryChips('What would you like?', [
                { value: 'Training only', text: 'Training only' },
                { value: 'Full Athlete Package (training + nutrition)', text: 'Full Athlete Package (training + nutrition)' }
            ]);
            return;
        }
        
        // Hide chips if no discovery question detected
        this.hideDiscoveryChips();
    }
    
    showDiscoveryChips(label, options) {
        this.discoveryLabel.textContent = label;
        this.discoveryChips.innerHTML = '';
        
        options.forEach(option => {
            const chip = document.createElement('button');
            chip.className = 'discovery-chip';
            chip.type = 'button';
            chip.textContent = option.text;
            chip.dataset.value = option.value;
            
            // Add click handler
            chip.addEventListener('click', () => {
                // Remove selected class from all chips
                this.discoveryChips.querySelectorAll('.discovery-chip').forEach(c => {
                    c.classList.remove('selected');
                });
                
                // Add selected class to clicked chip
                chip.classList.add('selected');
                
                // Submit the selected value after a brief delay for visual feedback
                setTimeout(() => {
                    this.submitDiscovery(option.value);
                }, 150);
            });
            
            this.discoveryChips.appendChild(chip);
        });
        
        this.discoveryContainer.style.display = 'block';
        this.messageInput.style.display = 'none';
        
        // Scroll to bottom to ensure chips are visible
        this.scrollToBottom();
    }
    
    hideDiscoveryChips() {
        this.discoveryContainer.style.display = 'none';
        this.messageInput.style.display = 'block';
        this.discoveryChips.innerHTML = '';
    }
    
    submitDiscovery(value) {
        if (!value) {
            return;
        }
        
        // Send the selected value as a message
        this.sendMessage(value);
        
        // Hide the chips
        this.hideDiscoveryChips();
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

