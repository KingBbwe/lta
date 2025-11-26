// Navigation and Skip Logic Router for LTA Questionnaire
class LTARouter {
    constructor(questionnaireConfig) {
        this.config = questionnaireConfig;
        this.currentSession = null;
        this.currentQuestionIndex = 0;
        this.responses = new Map();
        this.skipLogicProcessor = new LTASkipLogicProcessor(questionnaireConfig);
    }

    async initialize(sessionId) {
        this.currentSession = await LTA_DB.getSession(sessionId);
        if (!this.currentSession) {
            throw new Error('Session not found');
        }

        // Load existing responses
        const sessionResponses = await LTA_DB.getSessionResponses(sessionId);
        sessionResponses.forEach(response => {
            this.responses.set(response.questionId, response);
        });

        return this.currentSession;
    }

    getCurrentQuestion() {
        const questions = this.config.questions;
        return questions.find(q => q.id === this.currentSession.currentQuestion) || questions[0];
    }

    getNextQuestion(currentResponse = null) {
        if (currentResponse) {
            this.responses.set(currentResponse.questionId, currentResponse);
        }

        return this.skipLogicProcessor.getNextQuestion(
            this.currentSession.currentQuestion,
            this.responses,
            this.currentSession.stakeholderType
        );
    }

    getPreviousQuestion() {
        const questions = this.config.questions;
        const currentIndex = questions.findIndex(q => q.id === this.currentSession.currentQuestion);
        
        if (currentIndex <= 0) return null;

        // Find the previous non-skipped question
        for (let i = currentIndex - 1; i >= 0; i--) {
            const prevQuestion = questions[i];
            if (!this.skipLogicProcessor.shouldSkip(prevQuestion.id, this.responses, this.currentSession.stakeholderType)) {
                return prevQuestion;
            }
        }

        return null;
    }

    async navigateToQuestion(questionId) {
        const question = this.config.questions.find(q => q.id === questionId);
        if (!question) {
            throw new Error(`Question ${questionId} not found`);
        }

        this.currentSession.currentQuestion = questionId;
        this.currentSession.currentSection = question.section;
        
        await LTA_DB.updateSession(this.currentSession.id, {
            currentQuestion: questionId,
            currentSection: question.section
        });

        return question;
    }

    async saveResponse(response) {
        if (!response) return;

        await LTA_DB.saveResponse(this.currentSession.id, response.questionId, response);
        this.responses.set(response.questionId, response);

        // Update progress
        await LTA_DB.calculateProgress(this.currentSession.id);

        // Update stakeholder type if Q1 is answered
        if (response.questionId === 'q1' && response.value) {
            this.currentSession.stakeholderType = response.value;
            await LTA_DB.updateSession(this.currentSession.id, {
                stakeholderType: response.value
            });
        }
    }

    getProgress() {
        const totalQuestions = this.config.questions.length;
        const answeredQuestions = this.responses.size;
        return {
            percentage: Math.round((answeredQuestions / totalQuestions) * 100),
            answered: answeredQuestions,
            total: totalQuestions
        };
    }

    getSectionProgress() {
        const sections = {};
        Object.keys(this.config.sections).forEach(sectionId => {
            const sectionQuestions = this.config.questions.filter(q => q.section === sectionId);
            const answeredInSection = sectionQuestions.filter(q => this.responses.has(q.id)).length;
            
            sections[sectionId] = {
                title: this.config.sections[sectionId].title,
                total: sectionQuestions.length,
                answered: answeredInSection,
                percentage: Math.round((answeredInSection / sectionQuestions.length) * 100)
            };
        });

        return sections;
    }

    canSubmit() {
        // Check if all required questions are answered
        const requiredQuestions = this.config.questions.filter(q => q.required);
        const unansweredRequired = requiredQuestions.filter(q => !this.responses.has(q.id));
        
        return unansweredRequired.length === 0;
    }

    async completeSession() {
        this.currentSession.completionStatus = 'completed';
        this.currentSession.completedAt = new Date();
        
        await LTA_DB.updateSession(this.currentSession.id, {
            completionStatus: 'completed',
            completedAt: new Date()
        });

        // Generate final analytics
        await this.generateFinalAnalytics();
    }

    async generateFinalAnalytics() {
        const analytics = {
            awareness: await this.calculateAwarenessMetrics(),
            engagement: await this.calculateEngagementMetrics(),
            conversion: await this.calculateConversionMetrics(),
            strategic: await this.calculateStrategicMetrics()
        };

        await LTA_DB.saveAnalytics(this.currentSession.id, 'final_assessment', analytics);
        return analytics;
    }

    async calculateAwarenessMetrics() {
        // Implementation for awareness metrics calculation
        const metrics = {};
        
        // Calculate unaided recall score
        const q8Response = this.responses.get('q8');
        metrics.unaidedRecallScore = q8Response ? this.analyzeOpenEndedResponse(q8Response.value) : 0;

        // Calculate aided recall scores
        const q9Response = this.responses.get('q9');
        metrics.aidedRecallScore = q9Response ? this.calculateMatrixScore(q9Response.matrix) : 0;

        return metrics;
    }

    async calculateEngagementMetrics() {
        // Implementation for engagement metrics calculation
        const metrics = {};
        
        const q20Response = this.responses.get('q20');
        metrics.interestScore = q20Response ? this.mapLikertToScore(q20Response.value) : 0;

        return metrics;
    }

    async calculateConversionMetrics() {
        // Implementation for conversion metrics calculation
        const metrics = {};
        
        const q54Response = this.responses.get('q54');
        metrics.npsScore = q54Response ? parseInt(q54Response.value) : 0;
        metrics.npsCategory = this.calculateNPSCategory(metrics.npsScore);

        return metrics;
    }

    async calculateStrategicMetrics() {
        // Implementation for strategic metrics calculation
        const metrics = {};
        
        const q87Response = this.responses.get('q87');
        metrics.overallImpression = q87Response ? parseInt(q87Response.value) : 0;

        return metrics;
    }

    // Helper methods for analytics
    analyzeOpenEndedResponse(text) {
        if (!text) return 0;
        
        const wordCount = text.trim().split(/\s+/).length;
        const uniqueConcepts = this.extractConcepts(text);
        
        return Math.min((wordCount * 0.1) + (uniqueConcepts.length * 2), 10);
    }

    extractConcepts(text) {
        const concepts = ['limpopo', 'tourism', 'campaign', 'event', 'marketing', 'destination', 'lta'];
        return concepts.filter(concept => text.toLowerCase().includes(concept));
    }

    calculateMatrixScore(matrixData) {
        if (!matrixData) return 0;
        
        const scores = {
            'Not aware at all': 0,
            'Vaguely aware': 1,
            'Somewhat aware': 2,
            'Very aware': 3,
            'Extensively aware': 4
        };

        const total = Object.values(matrixData).reduce((sum, value) => {
            return sum + (scores[value] || 0);
        }, 0);

        return (total / (Object.keys(matrixData).length * 4)) * 10;
    }

    mapLikertToScore(value) {
        const scores = {
            'Not at all': 0,
            'Slightly': 2.5,
            'Moderately': 5,
            'Significantly': 7.5,
            'Extremely': 10
        };
        return scores[value] || 0;
    }

    calculateNPSCategory(score) {
        if (score >= 9) return 'promoter';
        if (score >= 7) return 'passive';
        return 'detractor';
    }
}

// Skip Logic Processor
class LTASkipLogicProcessor {
    constructor(config) {
        this.config = config;
        this.skipLogic = config.skipLogic;
    }

    getNextQuestion(currentQuestionId, responses, stakeholderType) {
        const currentQuestion = this.config.questions.find(q => q.id === currentQuestionId);
        if (!currentQuestion) return this.config.questions[0];

        // Check if current question has custom logic
        const logicKey = `${currentQuestionId}_${responses.get(currentQuestionId)?.value}`;
        if (this.skipLogic[logicKey]) {
            return this.applySkipLogic(this.skipLogic[logicKey], responses, stakeholderType);
        }

        // Default: get next question in sequence
        const currentIndex = this.config.questions.findIndex(q => q.id === currentQuestionId);
        const nextQuestion = this.config.questions[currentIndex + 1];

        // Skip questions based on global skip rules
        if (nextQuestion && this.shouldSkip(nextQuestion.id, responses, stakeholderType)) {
            return this.getNextQuestion(nextQuestion.id, responses, stakeholderType);
        }

        return nextQuestion;
    }

    applySkipLogic(logicRule, responses, stakeholderType) {
        switch (logicRule.action) {
            case 'skipTo':
                return this.config.questions.find(q => q.id === logicRule.target.question);
            case 'show':
                // Continue to next question but ensure target is shown later
                return this.getNextQuestionAfter(logicRule.from, responses, stakeholderType);
            case 'showSection':
                // Complex logic for section-based routing
                return this.handleSectionRouting(logicRule, responses, stakeholderType);
            default:
                return this.getNextQuestionAfter(logicRule.from, responses, stakeholderType);
        }
    }

    getNextQuestionAfter(questionId, responses, stakeholderType) {
        const currentIndex = this.config.questions.findIndex(q => q.id === questionId);
        const nextQuestion = this.config.questions[currentIndex + 1];
        
        if (nextQuestion && this.shouldSkip(nextQuestion.id, responses, stakeholderType)) {
            return this.getNextQuestionAfter(nextQuestion.id, responses, stakeholderType);
        }
        
        return nextQuestion;
    }

    handleSectionRouting(logicRule, responses, stakeholderType) {
        // Implementation for complex section-based routing
        const targetRange = logicRule.target;
        const [startQ, endQ] = targetRange.split('-');
        
        // Find the first question in the target range that shouldn't be skipped
        for (let i = this.config.questions.findIndex(q => q.id === startQ); 
             i <= this.config.questions.findIndex(q => q.id === endQ); 
             i++) {
            const question = this.config.questions[i];
            if (!this.shouldSkip(question.id, responses, stakeholderType)) {
                return question;
            }
        }
        
        return this.getNextQuestionAfter(endQ, responses, stakeholderType);
    }

    shouldSkip(questionId, responses, stakeholderType) {
        const question = this.config.questions.find(q => q.id === questionId);
        if (!question) return false;

        // Check stakeholder-specific routing
        if (question.logic && question.logic.stakeholderTypes) {
            if (!stakeholderType || !question.logic.stakeholderTypes.includes(stakeholderType)) {
                return true;
            }
        }

        // Check conditional skip logic
        for (const [logicKey, rule] of Object.entries(this.skipLogic)) {
            const [sourceQ, condition] = logicKey.split('_');
            if (sourceQ === questionId) {
                if (this.evaluateCondition(rule.condition, responses)) {
                    return true;
                }
            }
        }

        return false;
    }

    evaluateCondition(condition, responses) {
        if (condition.value) {
            const response = responses.get(condition.from);
            return response && response.value === condition.value;
        }
        
        if (condition.includesNone) {
            const response = responses.get(condition.from);
            return !response || !response.values || response.values.length === 0;
        }
        
        if (condition.includesAny) {
            const response = responses.get(condition.from);
            return response && response.values && response.values.length > 0;
        }
        
        return false;
    }
}

// Create global instance
const LTA_ROUTER = new LTARouter(LTA_QUESTIONNAIRE);
