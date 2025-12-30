// Discovery question patterns - data-driven configuration
// Each pattern has: id, label, options, and match conditions

const DISCOVERY_PATTERNS = [
    {
        id: 'package-type',
        label: 'What would you like?',
        options: [
            { value: 'Training only', text: 'Training only' },
            { value: 'Full Athlete Package (training + nutrition)', text: 'Full Athlete Package (training + nutrition)' }
        ],
        match: (msg) => {
            // Optimization #3: Early return for exclusions, combine checks
            // Don't match on goal classification questions
            if (msg.includes('getting stronger') || msg.includes('preparing for a competition')) {
                return false;
            }
            
            // But allow "nutrition support" when it's describing a package
            if (msg.includes('nutrition support') && 
                !msg.includes('includes nutrition support') && 
                !msg.includes('full athlete package')) {
                return false;
            }
            
            if (msg.includes('mainly looking for') && 
                (msg.includes('stronger') || msg.includes('competition') || msg.includes('nutrition'))) {
                return false;
            }
            
            // Combined positive checks
            const hasPackageKeywords = msg.includes('training only') || 
                                      msg.includes('training-only') || 
                                      msg.includes('full athlete package');
            const isQuestion = msg.includes('would you') || 
                              msg.includes('prefer') || 
                              msg.includes('choose') || 
                              msg.includes('interested in') || 
                              msg.includes('which');
            
            return hasPackageKeywords && isQuestion;
        },
        priority: 10
    },
    {
        id: 'check-in-frequency',
        label: 'How often would you like check-ins?',
        options: [
            { value: 'Weekly check-ins', text: 'Weekly' },
            { value: 'Fortnightly check-ins', text: 'Fortnightly' },
            { value: 'Not sure / open to recommendations', text: 'Not sure / open to recommendations' }
        ],
        match: (msg) => {
            // Optimization #3: Early returns for exclusions
            // Don't match if this is a services listing or general information
            if (msg.includes('we offer') || 
                (msg.includes('services') && (msg.includes('include') || msg.includes('variety'))) ||
                (msg.includes('coaching services') && msg.includes('including'))) {
                return false;
            }
            
            // Don't match support preference questions (handled by specific patterns)
            if (msg.includes('what kind of support would help you most') ||
                msg.includes('what kind of support would help you stay on track') ||
                (msg.includes('what kind of support') && msg.includes('help you'))) {
                return false;
            }
            
            // Combined positive checks for better performance
            const hasCheckIn = (msg.includes('check') && msg.includes('in')) ||
                              msg.includes('check-in') || 
                              msg.includes('checkin');
            const hasFrequency = msg.includes('how often') || msg.includes('frequency');
            const hasOptions = msg.includes('weekly or fortnightly') ||
                              msg.includes('fortnightly or weekly') ||
                              msg.includes('prefer weekly or fortnightly');
            const isQuestion = msg.includes('?') || 
                              msg.includes('would you') || 
                              msg.includes('do you') ||
                              msg.includes('prefer');
            
            // Primary match: "how often" + "check in"
            if (hasFrequency && hasCheckIn) {
                return true;
            }
            
            // Secondary match: "how often" in coaching/nutrition context (must be a question)
            if (hasFrequency && (hasCheckIn || msg.includes('coaching') || msg.includes('nutrition')) && isQuestion) {
                return true;
            }
            
            // Match explicit options
            return hasOptions;
        },
        priority: 20
    },
    {
        id: 'training-experience',
        label: 'What is your training experience level?',
        options: [
            { value: 'Beginner', text: 'Beginner' },
            { value: 'Intermediate', text: 'Intermediate' },
            { value: 'Advanced or Competitive', text: 'Advanced or Competitive' }
        ],
        match: (msg) => {
            return msg.includes('training experience') ||
                   msg.includes('experience level') ||
                   msg.includes('what is your experience') ||
                   msg.includes('describe your training experience') ||
                   msg.includes('let me know your training experience') ||
                   msg.includes('are you a beginner') ||
                   msg.includes('beginner, intermediate') ||
                   msg.includes('advanced/competitive') ||
                   msg.includes('advanced or competitive');
        },
        priority: 30
    },
    {
        id: 'coaching-preference',
        label: 'What is your coaching preference?',
        options: [
            { value: 'Online coaching', text: 'Online coaching' },
            { value: 'In-person coaching', text: 'In-person coaching' },
            { value: 'Not sure / open to recommendations', text: 'Not sure / open to recommendations' }
        ],
        match: (msg) => {
            const isAskingAboutCoachingMode = msg.includes('online coaching') || msg.includes('in-person coaching');
            const hasWeeklyFortnightly = msg.includes('weekly') || msg.includes('fortnightly');
            const hasCheckIn = msg.includes('check-in') || msg.includes('check in');
            const isCheckInQuestion = hasWeeklyFortnightly && hasCheckIn;
            const isAskingPackageType = (msg.includes('training only') || msg.includes('full athlete package')) &&
                                        (msg.includes('would you like') || msg.includes('would you prefer')) &&
                                        !msg.includes('coaching preference') && !isAskingAboutCoachingMode;

            if (isCheckInQuestion || isAskingPackageType) return false;

            return msg.includes('coaching preference') ||
                   msg.includes('open to recommendations') ||
                   (msg.includes('would you prefer') && isAskingAboutCoachingMode && !msg.includes('training only')) ||
                   msg.includes('prefer online coaching') ||
                   msg.includes('prefer in-person') ||
                   (msg.includes('online coaching') && msg.includes('in-person coaching') &&
                    (msg.includes('prefer') || msg.includes('recommendation') || 
                     msg.includes('open to') || msg.includes('would you')));
        },
        priority: 60
    },
    {
        id: 'services-interest',
        label: 'What are you interested in?',
        options: [
            { value: 'I want to get stronger', text: 'Build Strength' },
            { value: 'I want to compete', text: 'Competition Preparation' },
            { value: 'I need help with nutrition', text: 'Nutrition Coaching' }
        ],
        match: (msg) => {
            // Optimization #3: Early returns, combine checks
            // Don't match on welcome messages
            if (msg.includes('welcome') && 
                (msg.includes('what can i help') || msg.includes('questions about'))) {
                return false;
            }
            
            // Combined checks for goal classification
            const hasGoalKeywords = msg.includes('getting stronger') || 
                                   msg.includes('preparing for a competition') ||
                                   msg.includes('nutrition support') ||
                                   msg.includes('point you in the right direction');
            const isAskingGoal = msg.includes('mainly looking for') || 
                                msg.includes('what are you') ||
                                msg.includes('right now');
            
            if (hasGoalKeywords && isAskingGoal) {
                return true;
            }
            
            // Combined checks for services explanation
            const hasServicesKeywords = msg.includes('five coaching options') ||
                                       msg.includes('coaching options, covering') ||
                                       (msg.includes('online') && msg.includes('in-person') && msg.includes('club training'));
            
            if (hasServicesKeywords && msg.includes('point you in the right direction') && isAskingGoal) {
                return true;
            }
            
            // Check for five options + asking what looking for
            if ((msg.includes('five coaching options') || 
                 (msg.includes('coaching options') && msg.includes('covering'))) &&
                (msg.includes('mainly looking for') || 
                 (msg.includes('what are you') && msg.includes('looking')))) {
                return true;
            }
            
            // Combined checks for services context
            const hasServicesContext = (msg.includes('services') || msg.includes('offer') || 
                                       msg.includes('coaching options') || msg.includes('variety')) &&
                                      (msg.includes('online coaching') || msg.includes('club coaching') ||
                                       msg.includes('nutrition coaching') || msg.includes('1-to-1') ||
                                       msg.includes('full athlete') || msg.includes('athlete package'));
            
            const hasMultipleServices = (msg.includes('online coaching') && msg.includes('club coaching')) ||
                                       (msg.includes('online coaching') && (msg.includes('nutrition') || msg.includes('athlete'))) ||
                                       (msg.includes('club coaching') && msg.includes('nutrition')) ||
                                       (msg.includes('variety') && (msg.includes('coaching') || msg.includes('services')));
            
            const isAskingInterest = (msg.includes('what are you interested') ||
                                     msg.includes('what would you like') ||
                                     msg.includes('what can i help') ||
                                     msg.includes('specific goal') ||
                                     msg.includes('interested in any specific')) &&
                                    hasServicesContext;
            
            const isInvitingChoice = (msg.includes('if you have a specific goal') ||
                                     msg.includes('if you\'re interested') ||
                                     msg.includes('feel free to ask') ||
                                     msg.includes('let me know') ||
                                     msg.includes('what are you')) &&
                                    hasMultipleServices;
            
            return (hasServicesContext && hasMultipleServices) || isAskingInterest || isInvitingChoice;
        },
        priority: 5  // Higher priority than package-type (10) and check-in-frequency (20)
    },
    {
        id: 'one-to-one-addon',
        label: 'Would you like to add 1-to-1 coaching?',
        options: [
            { value: 'Yes, add 1-to-1 coaching', text: 'Yes, add 1-to-1 coaching' },
            { value: 'No, just Club Coaching', text: 'No, just Club Coaching' }
        ],
        match: (msg) => {
            return (msg.includes('1-to-1') || msg.includes('one-to-one')) &&
                   (msg.includes('add-on') || msg.includes('adding') || msg.includes('interested in adding') || msg.includes('add')) &&
                   (msg.includes('?') || msg.includes('would you'));
        },
        priority: 95
    },
    {
        id: 'one-to-one-addon-online',
        label: 'Would you like to add 1-to-1 coaching?',
        options: [
            { value: 'Yes, add 1-to-1 coaching', text: 'Yes, add 1-to-1 coaching' },
            { value: 'No, just Weekly Online Coaching', text: 'No, just Weekly Online Coaching' }
        ],
        match: (msg) => {
            return (msg.includes('1-to-1') || msg.includes('one-to-one')) &&
                   (msg.includes('add-on') || msg.includes('adding') || msg.includes('interested in adding') || msg.includes('add')) &&
                   (msg.includes('online coaching') || msg.includes('Online Coaching')) &&
                   (msg.includes('?') || msg.includes('would you'));
        },
        priority: 96
    },
    {
        id: 'nutrition-goal',
        label: 'What is your nutrition goal?',
        options: [
            { value: 'Build muscle', text: 'Build muscle' },
            { value: 'Fat loss / body recomposition', text: 'Fat loss / body recomposition' },
            { value: 'Maintain weight / healthier lifestyle', text: 'Maintain weight / healthier lifestyle' },
        ],
        match: (msg) => {
            // Don't match on goal classification or services explanation
            const isGoalClassification = msg.includes('point you in the right direction') ||
                                        (msg.includes('mainly looking for') && msg.includes('right now')) ||
                                        msg.includes('five coaching options');
            
            // Don't match on recommendation messages
            const isRecommendation = msg.includes('would suit you best') ||
                                    msg.includes('Based on what you\'ve shared') ||
                                    msg.includes('I recommend') ||
                                    msg.includes('I\'d recommend');
            
            if (isGoalClassification || isRecommendation) { 
                return false;
            }
            
            // Match various forms of nutrition goal questions
            return msg.includes('nutrition goal') ||
                   msg.includes('what is your nutrition goal') ||
                   (msg.includes('nutrition') && msg.includes('goal') && !msg.includes('coaching options'));
        },
        priority: 80
    },
    {
        id: 'competed-before',
        label: 'Have you competed before?',
        options: [
            { value: 'Yes, I\'ve competed before', text: 'Yes, I\'ve competed before' },
            { value: 'No, I\'m a first time competitor', text: 'No, I\'m a first time competitor' }
        ],
        match: (msg) => {
            return msg.includes('competed before') ||
                   msg.includes('have you competed') ||
                   msg.includes('have you ever competed') ||
                   msg.includes('competed in a powerlifting') ||
                   msg.includes('competed in powerlifting') ||
                   (msg.includes('competition') && msg.includes('before') &&
                    (msg.includes('have') || msg.includes('ever') || msg.includes('you')));
        },
        priority: 90
    },
    {
        id: 'nutrition-struggles-direct',
        label: 'What do you struggle with most when it comes to nutrition?',
        options: [
            { value: 'Knowing how much to eat', text: 'Knowing how much to eat' },
            { value: 'Meal planning & food choices', text: 'Meal planning & food choices' },
            { value: 'Staying consistent', text: 'Staying consistent' },
            { value: 'Mostly want structure & check-ins', text: 'Mostly want structure & check-ins' },
            { value: 'Something else', text: 'Something else' }
        ],
        match: (msg) => {
            // Match when bot asks about nutrition struggles AFTER user selects "Not sure" for check-in frequency
            // This should only appear after check-in frequency question, not immediately after goal selection
            // Don't match if it's part of check-in frequency question
            if (msg.includes('how often')) {
                return false;
            }
            
            return msg.includes('what do you struggle with most when it comes to nutrition') ||
                   (msg.includes('what do you struggle with most') && msg.includes('nutrition')) ||
                   (msg.includes('what do you struggle') && msg.includes('nutrition'));
        },
        priority: 25  // High priority - this is the main nutrition struggle question
    },
    {
        id: 'nutrition-structure-checkins',
        label: 'What level of hands-on support would work best for you?',
        options: [
            { value: 'More hands-on support', text: 'More hands-on support' },
            { value: 'Balanced guidance', text: 'Balanced guidance' },
            { value: 'Light-touch support', text: 'Light-touch support' }
        ],
        match: (msg) => {
            return (msg.includes('structure and accountability') && msg.includes('what level of hands-on support')) ||
                   (msg.includes('got it') && msg.includes('structure') && msg.includes('what level')) ||
                   (msg.includes('mostly want structure') && msg.includes('what level')) ||
                   (msg.includes('structure and accountability make a big difference') && msg.includes('what level'));
        },
        priority: 22
    },
    {
        id: 'nutrition-guidance-preference',
        label: 'How would you like to get started?',
        options: [
            { value: 'Plan my meals', text: 'Plan my meals' },
            { value: 'Give me some direction', text: 'Give me some direction' },
            { value: 'Not sure yet', text: 'Not sure yet' }
        ],
        match: (msg) => {
            return (msg.includes('very common') && msg.includes('especially at the start') && msg.includes('how would you like to get started')) ||
                   (msg.includes('knowing how much to eat') && msg.includes('how would you like to get started'));
        },
        priority: 22
    },
    {
        id: 'nutrition-consistency-checkins',
        label: 'What level of accountability would help you stay on track?',
        options: [
            { value: 'Regular accountability', text: 'Regular accountability' },
            { value: 'Some guidance', text: 'Some guidance' },
            { value: 'Not sure yet', text: 'Not sure yet' }
        ],
        match: (msg) => {
            return msg.includes('what level of accountability would help you stay on track') ||
                   msg.includes('what level of accountability') ||
                   (msg.includes('consistency usually improves') && msg.includes('what level of accountability')) ||
                   (msg.includes('regular accountability') && msg.includes('what level')) ||
                   (msg.includes('staying consistent') && msg.includes('what level of accountability'));
        },
        priority: 22
    },
    {
        id: 'nutrition-meal-planning-preference',
        label: 'What would be most helpful for your meal planning?',
        options: [
            { value: 'Help me meal plan', text: 'Help me meal plan' },
            { value: 'Help me fine-tune choices', text: 'Help me fine-tune choices' },
            { value: 'I want flexibility', text: 'I want flexibility' }
        ],
        match: (msg) => {
            return (msg.includes('meal planning') && msg.includes('food choices') && msg.includes('what would be most helpful')) ||
                   (msg.includes('meal planning') && msg.includes('what would be most helpful')) ||
                   (msg.includes('food choices') && msg.includes('what would be most helpful'));
        },
        priority: 22
    },
    {
        id: 'nutrition-results-followup',
        label: 'What feels stalled?',
        options: [
            { value: 'Fat loss', text: 'Fat loss' },
            { value: 'Body recomposition', text: 'Body recomposition' },
            { value: 'Energy levels', text: 'Energy levels' },
            { value: 'Strength / performance', text: 'Strength / performance' },
            { value: 'Something else', text: 'Something else' }
        ],
        match: (msg) => {
            return msg.includes('what feels stalled') ||
                   (msg.includes('not seeing results') && msg.includes('what feels')) ||
                   (msg.includes('stalled') && msg.includes('what feels'));
        },
        priority: 23
    },
    {
        id: 'nutrition-balancing-followup',
        label: 'What makes it challenging?',
        options: [
            { value: 'Eating out / social events', text: 'Eating out / social events' },
            { value: 'Work or shift hours', text: 'Work or shift hours' },
            { value: 'Family or household meals', text: 'Family or household meals' },
            { value: 'Stress & fatigue', text: 'Stress & fatigue' },
            { value: 'Something else', text: 'Something else' }
        ],
        match: (msg) => {
            return (msg.includes('what makes it challenging') && (msg.includes('balancing') || msg.includes('food') || msg.includes('daily life'))) ||
                   (msg.includes('balancing food with daily life') && msg.includes('what'));
        },
        priority: 23
    },
    {
        id: 'struggles',
        label: 'What do you struggle with?',
        options: [
            { value: 'Program structure', text: 'Program structure' },
            { value: 'Slow progress', text: 'Slow progress' },
            { value: 'Technique & form', text: 'Technique & form' },
            { value: 'Staying consistent', text: 'Staying consistent' },
            { value: 'Something else', text: 'Something else' }
        ],
        match: (msg) => {
            // Don't match if this is a nutrition-specific struggle question
            const isNutritionStruggle = (msg.includes('nutrition') || msg.includes('food')) &&
                                      (msg.includes('what feels hardest') || msg.includes('what feels most challenging'));
            
            if (isNutritionStruggle) {
                return false;
            }
            
            // Match the new strength flow struggle question
            return msg.includes('what do you struggle with most') ||
                   (msg.includes('what do you struggle') && !msg.includes('nutrition'));
        },
        priority: 25  // After check-in frequency (20) but before other questions
    },
    {
        id: 'program-structure-followup',
        label: 'What feels unclear about your program right now?',
        options: [
            { value: 'I\'m not sure how to progress', text: 'I\'m not sure how to progress' },
            { value: 'I need a structured program', text: 'I need a structured program' },
            { value: 'Not sure yet', text: 'Not sure yet' }
        ],
        match: (msg) => {
            return msg.includes('what feels unclear about your program') ||
                   (msg.includes('unclear') && msg.includes('program') && msg.includes('right now'));
        },
        priority: 22
    },
    {
        id: 'slow-progress-followup',
        label: 'What do you feel is holding your progress back most?',
        options: [
            { value: 'Strength isn\'t increasing / stuck', text: 'Strength isn\'t increasing / stuck' },
            { value: 'I\'m inconsistent', text: 'I\'m inconsistent' },
            { value: 'Not sure yet', text: 'Not sure yet' }
        ],
        match: (msg) => {
            return msg.includes('what do you feel is holding your progress back') ||
                   (msg.includes('holding') && msg.includes('progress back') && msg.includes('most'));
        },
        priority: 22
    },
    {
        id: 'technique-form-followup',
        label: 'What would you like help with most?',
        options: [
            { value: 'Not confident with my form', text: 'Not confident with my form' },
            { value: 'Feedback on lifts', text: 'Feedback on lifts' },
            { value: 'Not sure yet', text: 'Not sure yet' }
        ],
        match: (msg) => {
            // Match when asking about help with technique/form
            // Check for the question AND context indicating technique/form
            return msg.includes('what would you like help with most') &&
                   (msg.includes('technique') || msg.includes('form') || 
                    msg.includes('lift') || msg.includes('feedback'));
        },
        priority: 22
    },
    {
        id: 'staying-consistent-followup-strength',
        label: 'What kind of support would help you most right now?',
        options: [
            { value: 'Regular accountability', text: 'Regular accountability' },
            { value: 'Some guidance', text: 'Some guidance' },
            { value: 'Not sure yet', text: 'Not sure yet' }
        ],
        match: (msg) => {
            // Match when asking about support for staying consistent
            // Exclude nutrition context (nutrition has its own accountability question)
            const isNutritionContext = msg.includes('nutrition') && 
                                      (msg.includes('struggle') || msg.includes('accountability'));
            
            return (msg.includes('what kind of support would help you most right now') ||
                   msg.includes('what kind of support would help you stay on track') ||
                   (msg.includes('what kind of support') && msg.includes('help you'))) &&
                   !isNutritionContext;
        },
        priority: 22
    },
    {
        id: 'strength-purpose',
        label: 'Are you getting stronger for general health or to prepare for a competition?',
        options: [
            { value: 'General health', text: 'General health' },
            { value: 'Prepare for a competition', text: 'Prepare for a competition' }
        ],
        match: (msg) => {
            return msg.includes('general health or to prepare for a competition') ||
                   msg.includes('general health or competition') ||
                   msg.includes('for general health or to prepare') ||
                   (msg.includes('general health') && msg.includes('competition')) ||
                   (msg.includes('getting stronger') && (msg.includes('general health') || msg.includes('competition')));
        },
        priority: 85
    },
    {
        id: 'does-this-suit-you',
        label: 'Does this suit you?',
        options: [
            { value: 'Yes, this suits me', text: 'Yes, this suits me' },
            { value: 'No, I\'d prefer something else', text: 'No, I\'d prefer something else' }
        ],
        match: (msg) => {
            // Don't match if this is asking about adding 1-to-1 coaching (handled by one-to-one-addon pattern)
            const isOneToOneAddonQuestion = (msg.includes('1-to-1') || msg.includes('one-to-one')) &&
                                           (msg.includes('add') || msg.includes('add-on') || msg.includes('adding'));
            
            if (isOneToOneAddonQuestion) {
                return false;
            }
            
            return msg.includes('does this suit you') ||
                   (msg.includes('suit you') && msg.includes('?'));
        },
        priority: 92
    },
    {
        id: 'beginner-coaching-choice',
        label: 'Would you prefer in-person or online?',
        options: [
            { value: 'In-person club coaching', text: 'In-person club coaching' },
            { value: 'Online coaching', text: 'Online coaching' }
        ],
        match: (msg) => {
            // Match when asking beginners to choose between in-person and online
            // after explaining both options
            return (msg.includes('would you prefer in-person or online') ||
                   (msg.includes('in-person') && msg.includes('online') && 
                    msg.includes('prefer') && msg.includes('?'))) &&
                   (msg.includes('beginner') || msg.includes('club coaching') || 
                    msg.includes('technique') || msg.includes('confidence'));
        },
        priority: 88
    },
    {
        id: 'one-to-one-addon-simple',
        label: 'Would you like to add 1-to-1 coaching?',
        options: [
            { value: 'Yes, I\'d like to add on', text: 'Yes, I\'d like to add on' },
            { value: 'No', text: 'No' }
        ],
        match: (msg) => {
            // Match simpler 1-to-1 add-on questions (without mentioning specific coaching type)
            return (msg.includes('add 1-to-1') || msg.includes('add on') || msg.includes('add-on')) &&
                   (msg.includes('would you like') || msg.includes('interested')) &&
                   msg.includes('?') &&
                   !msg.includes('club coaching would suit') &&
                   !msg.includes('online coaching would suit');
        },
        priority: 93
    }
];

// Pre-sort patterns by priority once (performance optimization)
// This avoids sorting on every message check
const SORTED_DISCOVERY_PATTERNS = [...DISCOVERY_PATTERNS].sort((a, b) => a.priority - b.priority);

// Optimization #5: Group patterns by flow context for potential future optimization
// This allows checking only relevant patterns based on conversation context
const PATTERN_GROUPS = {
    general: ['services-interest', 'strength-purpose', 'training-experience', 'coaching-preference'],
    strength: ['program-structure-followup', 'slow-progress-followup', 'technique-form-followup', 
               'staying-consistent-followup-strength', 'struggles', 'beginner-coaching-choice'],
    competition: ['competed-before', 'package-type', 'does-this-suit-you'],
    nutrition: ['nutrition-goal', 'nutrition-struggles-direct', 'nutrition-structure-checkins',
                'nutrition-guidance-preference', 'nutrition-consistency-checkins', 
                'nutrition-meal-planning-preference'],
    common: ['check-in-frequency', 'one-to-one-addon', 'one-to-one-addon-online', 'one-to-one-addon-simple']
};

// Create lookup map for quick pattern access by ID (future optimization)
const PATTERN_BY_ID = {};
DISCOVERY_PATTERNS.forEach(pattern => {
    PATTERN_BY_ID[pattern.id] = pattern;
});

