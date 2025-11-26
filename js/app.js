// Main Application Controller for LTA Questionnaire PWA
class LTAQuestionnaireApp {
    constructor() {
        this.currentSessionId = null;
        this.isInitialized = false;
        this.currentQuestion = null;
        this.router = LTA_ROUTER;
        this.renderer = LTA_RENDERER;
        this.analytics = LTA_ANALYTICS;
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            // Initialize database
            await LTA_DB.initialize();
            
            // Check for existing sessions
            await this.checkExistingSessions();
            
            // Register service worker
            await this.registerServiceWorker();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Show welcome screen
            this.showScreen('welcomeScreen');
            
            this.isInitialized = true;
            console.log('LTA Questionnaire PWA initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    async checkExistingSessions() {
        const incompleteSessions = await LTA_DB.getIncompleteSessions();
        if (incompleteSessions.length > 0) {
            const resumeBtn = document.getElementById('resumeSession');
            resumeBtn.style.display = 'block';
            resumeBtn.onclick = () => this.resumeSession(incompleteSessions[0].id);
        }
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registered successfully');
            } catch (error) {
                console.log('ServiceWorker registration failed:', error);
            }
        }
    }

    setupEventListeners() {
        // Start questionnaire
        document.getElementById('startQuestionnaire').addEventListener('click', () => {
            this.startNewSession();
        });

        // Navigation controls
        document.getElementById('nextBtn').addEventListener('click', () => {
            this.navigateToNextQuestion();
        });

        document.getElementById('prevBtn').addEventListener('click', () => {
            this.navigateToPreviousQuestion();
        });

        // Submission
        document.getElementById('submitFinal').addEventListener('click', () => {
            this.submitQuestionnaire();
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.navigateToNextQuestion();
            }
        });

        // Before unload - save progress
        window.addEventListener('beforeunload', () => {
            this.saveCurrentResponse();
        });
    }

    async startNewSession() {
        try {
            this.currentSessionId = await LTA_DB.createSession();
            await this.router.initialize(this.currentSessionId);
            await this.analytics.initialize(this.currentSessionId);
            
            this.showQuestionnaire();
            await this.loadCurrentQuestion();
            
        } catch (error) {
            console.error('Failed to start new session:', error);
            this.showError('Failed to start questionnaire. Please try again.');
        }
    }

    async resumeSession(sessionId) {
        try {
            this.currentSessionId = sessionId;
            await this.router.initialize(sessionId);
            await this.analytics.initialize(sessionId);
            
            this.showQuestionnaire();
            await this.loadCurrentQuestion();
            
        } catch (error) {
            console.error('Failed to resume session:', error);
            this.showError('Failed to resume session. Starting new questionnaire.');
            this.startNewSession();
        }
    }

    showQuestionnaire() {
        this.showScreen('questionnaireScreen');
        this.updateProgressDisplay();
    }

    async loadCurrentQuestion() {
        try {
            this.currentQuestion = this.router.getCurrentQuestion();
            
            // Get existing response if any
            const existingResponse = await LTA_DB.getResponse(this.currentSessionId, this.currentQuestion.id);
            
            // Render question
            const questionElement = this.renderer.renderQuestion(this.currentQuestion, existingResponse);
            document.getElementById('currentQuestion').innerHTML = '';
            document.getElementById('currentQuestion').appendChild(questionElement);
            
            // Update UI
            this.updateQuestionCounter();
            this.updateSectionInfo();
            this.updateNavigationButtons();
            
        } catch (error) {
            console.error('Failed to load question:', error);
            this.showError('Failed to load question. Please try again.');
        }
    }

    async navigateToNextQuestion() {
        // Save current response
        await this.saveCurrentResponse();
        
        // Get next question
        const currentResponse = this.renderer.getResponse(this.currentQuestion);
        const nextQuestion = this.router.getNextQuestion(currentResponse);
        
        if (nextQuestion) {
            await this.router.navigateToQuestion(nextQuestion.id);
            await this.loadCurrentQuestion();
            this.updateProgressDisplay();
        } else {
            // Reached the end
            await this.completeQuestionnaire();
        }
    }

    async navigateToPreviousQuestion() {
        const previousQuestion = this.router.getPreviousQuestion();
        if (previousQuestion) {
            await this.router.navigateToQuestion(previousQuestion.id);
            await this.loadCurrentQuestion();
            this.updateProgressDisplay();
        }
    }

    async saveCurrentResponse() {
        try {
            const response = this.renderer.getResponse(this.currentQuestion);
            if (response) {
                await this.router.saveResponse(response);
                await this.analytics.processResponse(response);
            }
        } catch (error) {
            console.error('Failed to save response:', error);
        }
    }

    updateProgressDisplay() {
        const progress = this.router.getProgress();
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) {
            progressFill.style.width = `${progress.percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = `Progress: ${progress.percentage}%`;
        }
    }

    updateQuestionCounter() {
        const questions = LTA_QUESTIONNAIRE.questions;
        const currentIndex = questions.findIndex(q => q.id === this.currentQuestion.id) + 1;
        document.getElementById('questionCounter').textContent = `Q${currentIndex} of ${questions.length}`;
    }

    updateSectionInfo() {
        const section = LTA_QUESTIONNAIRE.sections[this.currentQuestion.section];
        document.getElementById('sectionTitle').textContent = section.title;
        document.getElementById('sectionDescription').textContent = section.description;
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const questions = LTA_QUESTIONNAIRE.questions;
        const currentIndex = questions.findIndex(q => q.id === this.currentQuestion.id);
        
        prevBtn.disabled = currentIndex === 0;
    }

    async completeQuestionnaire() {
        try {
            await this.saveCurrentResponse();
            await this.router.completeSession();
            
            // Generate final report
            const finalReport = await this.analytics.generateFinalReport();
            
            // Show completion screen
            this.showCompletionScreen(finalReport);
            
        } catch (error) {
            console.error('Failed to complete questionnaire:', error);
            this.showError('Failed to complete questionnaire. Please try again.');
        }
    }

    showCompletionScreen(finalReport) {
        this.showScreen('completionScreen');
        
        // Store report for download
        this.finalReport = finalReport;
        
        // Set up download button
        document.getElementById('downloadReport').addEventListener('click', () => {
            this.downloadReport();
        });
    }

    async submitQuestionnaire() {
        try {
            // Validate completion
            if (!this.router.canSubmit()) {
                this.showError('Please complete all required questions before submitting.');
                return;
            }

            // Show loading state
            const submitBtn = document.getElementById('submitFinal');
            submitBtn.textContent = 'Submitting...';
            submitBtn.disabled = true;

            // Export data for submission
            const submissionData = await LTA_DB.exportSessionData(this.currentSessionId);
            
            // Submit to Supabase (implementation depends on Supabase setup)
            await this.submitToSupabase(submissionData);
            
            // Show success message
            this.showSuccess('Thank you! Your responses have been submitted successfully.');
            
            // Update UI
            submitBtn.textContent = 'Submitted ✓';
            
        } catch (error) {
            console.error('Failed to submit questionnaire:', error);
            this.showError('Failed to submit responses. Please try again.');
            
            // Reset button
            const submitBtn = document.getElementById('submitFinal');
            submitBtn.textContent = 'Submit Responses';
            submitBtn.disabled = false;
        }
    }

    async submitToSupabase(data) {
        // This would be implemented based on your Supabase configuration
        // Example implementation:
        /*
        const { data: submission, error } = await supabase
            .from('questionnaire_submissions')
            .insert([data]);
            
        if (error) throw error;
        return submission;
        */
        
        // For now, we'll simulate successful submission
        console.log('Submitting to Supabase:', data);
        return new Promise(resolve => setTimeout(resolve, 1000));
    }

    downloadReport() {
        if (!this.finalReport) {
            this.showError('No report available for download.');
            return;
        }

        const reportBlob = new Blob([JSON.stringify(this.finalReport, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(reportBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lta-assessment-report-${this.currentSessionId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        document.getElementById(screenId).classList.add('active');
    }

    showError(message) {
        // Simple error display - could be enhanced with a proper notification system
        alert(`Error: ${message}`);
    }

    showSuccess(message) {
        // Simple success display
        alert(`Success: ${message}`);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LTAQuestionnaireApp();
});

// Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('SW registered'))
        .catch(error => console.log('SW registration failed'));
}
