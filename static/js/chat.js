// Chat application JavaScript

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const ICONS = {
    bot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
    </svg>`,
    user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>`
};

const WELCOME_MESSAGE = "Welcome to Strength Club! I'm here if you have any questions about training, nutrition, or coaching. What can I help you with today?";

// Discovery patterns are loaded from discovery-patterns.js
// DISCOVERY_PATTERNS, SORTED_DISCOVERY_PATTERNS, PATTERN_GROUPS, and PATTERN_BY_ID
// are defined in that file and must be loaded before this file

// Optimized regex patterns for exclusion checks (faster than multiple includes())
const HANDOVER_REGEX = /name:\s*.+mobile:\s*.+goal:\s*.+plan:/i;
const RECOMMENDATION_REGEX = /(i|we|i'?d|would)\s+recommend|recommend.*for you|pricing|per week|would be a perfect fit|perfect fit|next step|connect you|take the next step/i;
const PERSONAL_INFO_REGEX = /(your name|what'?s your name|what is your name|may i have your name|can i get your name|phone number|contact (number|details|information)|email address|how can we reach you|best way to contact|get in touch)/i;

// Patterns that indicate the bot is making a recommendation (hide chips)
// Kept for backward compatibility, but RECOMMENDATION_REGEX is used instead
const RECOMMENDATION_PATTERNS = [
    'i recommend', 'we recommend', 'i\'d recommend', 'would recommend',
    'pricing', 'per week', 'would be a perfect fit', 'perfect fit',
    'next step', 'connect you', 'take the next step'
];

// Patterns that indicate the bot is collecting personal info (hide chips)
// Kept for backward compatibility, but PERSONAL_INFO_REGEX is used instead
const PERSONAL_INFO_PATTERNS = [
    'your name', 'what is your name', 'what\'s your name', 'may i have your name',
    'can i get your name', 'phone number', 'contact number', 'contact details',
    'contact information', 'email address', 'how can we reach you',
    'best way to contact', 'get in touch'
];

// ============================================================================
// CHAT APPLICATION CLASS
// ============================================================================

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
        
        // Initialize typing indicator avatar from constant
        const typingAvatar = document.getElementById('typingAvatar');
        if (typingAvatar) {
            typingAvatar.innerHTML = ICONS.bot;
        }
        
        // Event listeners
        this.setupEventListeners();
        
        // Initialize session (handles welcome message display)
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
                
                // Show welcome message (use API response or fall back to constant)
                const welcomeMsg = data.welcome_message || WELCOME_MESSAGE;
                this.messages.innerHTML = '';
                this.addMessage('assistant', welcomeMsg);
                // Check if welcome message is a discovery question
                this.checkForDiscoveryQuestion(welcomeMsg);
                
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
                this.addMessage('assistant', WELCOME_MESSAGE);
                // Check if welcome message is a discovery question
                this.checkForDiscoveryQuestion(WELCOME_MESSAGE);
                
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
        
        const avatarClass = role === 'user' ? 'message-avatar user-avatar' : 'message-avatar';
        const icon = role === 'user' ? ICONS.user : ICONS.bot;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="${avatarClass}">${icon}</div>
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
    
    async extractGoalAndPlan() {
        // Fetch conversation messages from API for accurate extraction
        let userMessages = [];
        let assistantMessages = [];
        
        try {
            const response = await fetch('/api/get_history');
            const data = await response.json();
            
            if (data.success && data.messages) {
                data.messages.forEach(msg => {
                    if (msg.role === 'user') {
                        userMessages.push(msg.content);
                    } else if (msg.role === 'assistant') {
                        assistantMessages.push(msg.content);
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching conversation history:', error);
            // Fallback to DOM extraction
            const messages = Array.from(this.messages.querySelectorAll('.message'));
            messages.forEach(msg => {
                const isUser = msg.classList.contains('user-message');
                const content = msg.querySelector('.message-text')?.textContent || '';
                if (isUser) {
                    userMessages.push(content);
                } else {
                    assistantMessages.push(content);
                }
            });
        }
        
        // Extract goal and experience level from user messages
        let goal = 'General Inquiry';
        let experienceLevel = '';
        const userText = userMessages.join(' ').toLowerCase();
        const fullUserText = userMessages.join(' ').toLowerCase();
        
        // First, try to extract from handover confirmation in assistant messages (most accurate)
        const handoverGoalPattern = /Goal:\s*(.+?)(?:\n|Plan:|$)/i;
        for (const msg of assistantMessages) {
            const match = msg.match(handoverGoalPattern);
            if (match) {
                goal = match[1].trim();
                break;
            }
        }
        
        // If not found in handover, extract from user messages
        if (goal === 'General Inquiry') {
            // Extract experience level
            if (fullUserText.includes('beginner')) {
                experienceLevel = 'beginner';
            } else if (fullUserText.includes('intermediate')) {
                experienceLevel = 'intermediate';
            } else if (fullUserText.includes('advanced') || fullUserText.includes('competitive')) {
                experienceLevel = 'advanced';
            }
            
            // Extract goal
            if (userText.includes('compete') || userText.includes('competition')) {
                goal = 'Competition prep';
            } else if (userText.includes('stronger') || userText.includes('strength') || userText.includes('powerlifting')) {
                goal = 'Build strength';
            } else if (userText.includes('nutrition') || userText.includes('fat loss') || userText.includes('muscle gain')) {
                goal = 'Nutrition Coaching';
            }
            
            // Append experience level to goal if available
            if (goal !== 'General Inquiry' && experienceLevel) {
                goal = `${goal} (${experienceLevel})`;
            }
        }
        
        // Extract plan from user selections
        let packageType = '';
        let coachingPreference = '';
        let checkInFrequency = '';
        
        const fullText = userMessages.join(' ').toLowerCase();
        
        // Check for package type (exact matches first)
        if (fullText.includes('training only') && !fullText.includes('full athlete')) {
            packageType = 'Training only';
        } else if (fullText.includes('full athlete package') || fullText.includes('full athlete')) {
            packageType = 'Full Athlete Package';
        }
        
        // Check for coaching preference
        if (fullText.includes('online coaching') || (fullText.includes('online') && fullText.includes('coaching'))) {
            coachingPreference = 'Online coaching';
        } else if (fullText.includes('in-person coaching') || (fullText.includes('in-person') && fullText.includes('coaching'))) {
            coachingPreference = 'In-person coaching';
        } else if (fullText.includes('club coaching')) {
            coachingPreference = 'Club coaching';
        }
        
        // Check for check-in frequency
        if (fullText.includes('weekly check-in') || fullText.includes('weekly check-ins') || 
            (fullText.includes('weekly') && fullText.includes('check'))) {
            checkInFrequency = 'weekly check-ins';
        } else if (fullText.includes('fortnightly check-in') || fullText.includes('fortnightly check-ins') ||
                   (fullText.includes('fortnightly') && fullText.includes('check'))) {
            checkInFrequency = 'fortnightly check-ins';
        }
        
        // Build plan string in format: "Package Type (coaching preference, check-in frequency)"
        let plan = 'Not specified';
        
        if (packageType) {
            const details = [];
            if (coachingPreference) details.push(coachingPreference);
            if (checkInFrequency) details.push(checkInFrequency);
            
            if (details.length > 0) {
                plan = `${packageType} (${details.join(', ')})`;
            } else {
                plan = packageType;
            }
        } else if (coachingPreference) {
            // If no package type but we have coaching preference
            const details = [];
            if (checkInFrequency) details.push(checkInFrequency);
            if (details.length > 0) {
                plan = `${coachingPreference} (${details.join(', ')})`;
            } else {
                plan = coachingPreference;
            }
        } else {
            // If no plan parts found, try to extract from assistant messages
            // First check for handover confirmation format (most accurate)
            const handoverPlanPattern = /Plan:\s*(.+?)(?:\n|$)/i;
            for (const msg of assistantMessages) {
                const match = msg.match(handoverPlanPattern);
                if (match) {
                    plan = match[1].trim();
                    break;
                }
            }
            
            // Fallback to keyword matching if handover format not found
            if (plan === 'Not specified') {
                const assistantText = assistantMessages.join(' ').toLowerCase();
                if (assistantText.includes('online coaching')) {
                    plan = 'Online coaching';
                } else if (assistantText.includes('club coaching')) {
                    plan = 'Club coaching';
                } else if (assistantText.includes('nutrition coaching')) {
                    plan = 'Nutrition coaching';
                }
            }
        }
        
        return { goal, plan };
    }
    
    displayEscalationConfirmation() {
        const confirmation = "We've received your details, and we will be in touch soon. Feel free to ask me if you have any other questions!";
        // Hide chips before displaying confirmation
        this.hideDiscoveryChips();
        this.addMessage('assistant', confirmation);
        // Ensure chips stay hidden after adding the message
        setTimeout(() => {
            this.hideDiscoveryChips();
        }, 50);
    }
    
    async extractConversationContext() {
        // Extract recent conversation context for high priority escalations
        let contextMessages = [];
        
        try {
            const response = await fetch('/api/get_history');
            const data = await response.json();
            
            if (data.success && data.messages) {
                // Get last 10 messages for context (excluding system messages)
                const recentMessages = data.messages
                    .filter(msg => msg.role !== 'system')
                    .slice(-10);
                
                contextMessages = recentMessages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));
            }
        } catch (error) {
            console.error('Error fetching conversation history:', error);
        }
        
        return contextMessages;
    }
    
    async submitEscalation() {
        const name = document.getElementById('escalationName').value.trim();
        const mobile = document.getElementById('escalationPhone').value.trim();
        const email = document.getElementById('escalationEmail').value.trim();
        const issue = document.getElementById('escalationIssue').value.trim();
        
        if (!name || !mobile || !email || !issue) {
            alert('Please fill in all required fields.');
            return;
        }
        
        // Extract goal and plan from conversation
        const { goal, plan } = await this.extractGoalAndPlan();
        
        // Extract conversation context for high priority escalation
        const conversationContext = await this.extractConversationContext();
        
        // Close modal first
        this.closeEscalationModal();
        
        // Display confirmation message
        this.displayEscalationConfirmation();
        
        // Wait a moment for the message to display, then submit escalation
        setTimeout(async () => {
            try {
                // Submit escalation to backend
                const response = await fetch('/api/escalate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversation_id: this.conversationId, // Send conversation_id explicitly
                        contact_info: {
                            name: name,
                            phone: mobile,
                            email: email,
                            goal: goal,
                            plan: plan,
                            issue: issue,
                            conversation_context: conversationContext
                        },
                        reason: 'Customer requested immediate human assistance'
                    })
                });
                
                if (!response.ok) {
                    // Try to get error message from response
                    let errorMessage = 'Failed to submit your request. Please try again.';
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                        console.error('Failed to submit escalation:', errorData);
                    } catch (e) {
                        console.error('Failed to parse error response:', e);
                        console.error('Response status:', response.status, response.statusText);
                    }
                    alert(errorMessage);
                    return;
                }
                
                const data = await response.json();
                
                if (!data.success) {
                    console.error('Failed to submit escalation:', data.error);
                    alert(data.error || 'Failed to submit your request. Please try again.');
                } else {
                    // Success - the confirmation message is already displayed
                    console.log('Escalation submitted successfully:', data);
                }
            } catch (error) {
                console.error('Error submitting escalation:', error);
                alert('An error occurred. Please try again. Error: ' + error.message);
            }
        }, 500);
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
        
        // Fast exclusion checks using regex (optimization #2) - return early if we should hide chips
        
        // Check if this is a handover summary - hide chips
        // Handover summaries have format: Name: ... Mobile: ... Goal: ... Plan: ...
        if (HANDOVER_REGEX.test(botMessage)) {
            this.hideDiscoveryChips();
            return;
        }
        
        // Check if bot is making a recommendation - hide chips (using regex for speed)
        if (RECOMMENDATION_REGEX.test(botMessage)) {
            this.hideDiscoveryChips();
            return;
        }

        // Check if bot is collecting personal information - hide chips (using regex for speed)
        if (PERSONAL_INFO_REGEX.test(botMessage)) {
            this.hideDiscoveryChips();
            return;
        }

        // Find matching discovery pattern using pre-sorted array (optimization #1)
        // Patterns are already sorted by priority, so first match is highest priority
        for (const pattern of SORTED_DISCOVERY_PATTERNS) {
            if (pattern.match(message)) {
                this.showDiscoveryChips(pattern.label, pattern.options);
                return;
            }
        }
        
        // Hide chips if no discovery question detected
        this.hideDiscoveryChips();
    }
    
    showDiscoveryChips(label, options) {
        // Label is hidden - question appears only in chat message
        // this.discoveryLabel.textContent = label;
        this.discoveryChips.innerHTML = '';
        
        options.forEach(option => {
            const chip = document.createElement('button');
            chip.className = 'discovery-chip';
            chip.type = 'button';
            chip.textContent = option.text;
            chip.dataset.value = option.value;
            
            // Add click handler
            chip.addEventListener('click', () => {
                // Handle "Something else" specially - show input for free text
                // Works for both general struggles and nutrition-specific struggles
                if (option.value === 'Something else') {
                    // Remove selected class from all chips
                    this.discoveryChips.querySelectorAll('.discovery-chip').forEach(c => {
                        c.classList.remove('selected');
                    });
                    
                    // Add selected class to clicked chip
                    chip.classList.add('selected');
                    
                    // Show input field and prompt user to type
                    this.messageInput.style.display = 'block';
                    this.messageInput.placeholder = 'Tell us what you struggle with...';
                    this.messageInput.focus();
                    
                    // Add a submit handler for the input when Enter is pressed or form submitted
                    const handleSomethingElseSubmit = (e) => {
                        if ((e.type === 'keydown' && e.key === 'Enter' && !e.shiftKey) || e.type === 'submit') {
                            e.preventDefault();
                            const userInput = this.messageInput.value.trim();
                            if (userInput) {
                                // Send the free text as the struggle
                                this.submitDiscovery(`Something else: ${userInput}`);
                                this.messageInput.removeEventListener('keydown', handleSomethingElseSubmit);
                                this.chatForm.removeEventListener('submit', handleSomethingElseSubmit);
                                this.messageInput.placeholder = 'Type your message here...';
                            }
                        }
                    };
                    
                    this.messageInput.addEventListener('keydown', handleSomethingElseSubmit);
                    this.chatForm.addEventListener('submit', handleSomethingElseSubmit);
                    return;
                }
                
                // Normal chip selection
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
        
        // Keep input visible for services-interest chips (users can type or click chips)
        // Hide input for other discovery questions
        const isServicesInterest = label === 'What are you interested in?';
        if (!isServicesInterest) {
            this.messageInput.style.display = 'none';
        } else {
            this.messageInput.style.display = 'block';
        }
        
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

