// IndexedDB Manager for LTA Questionnaire
class LTAIndexedDB {
    constructor() {
        this.dbName = 'LTAQuestionnaire';
        this.version = 1;
        this.db = null;
        this.initialize();
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
                    sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
                    sessionStore.createIndex('lastModified', 'lastModified', { unique: false });
                    sessionStore.createIndex('completionStatus', 'completionStatus', { unique: false });
                }

                if (!db.objectStoreNames.contains('responses')) {
                    const responseStore = db.createObjectStore('responses', { keyPath: ['sessionId', 'questionId'] });
                    responseStore.createIndex('sessionId', 'sessionId', { unique: false });
                    responseStore.createIndex('questionId', 'questionId', { unique: false });
                    responseStore.createIndex('section', 'section', { unique: false });
                }

                if (!db.objectStoreNames.contains('analytics')) {
                    const analyticsStore = db.createObjectStore('analytics', { keyPath: ['sessionId', 'metricType'] });
                    analyticsStore.createIndex('sessionId', 'sessionId', { unique: false });
                    analyticsStore.createIndex('calculatedAt', 'calculatedAt', { unique: false });
                }
            };
        });
    }

    // Session Management
    async createSession() {
        const session = {
            createdAt: new Date(),
            lastModified: new Date(),
            completionStatus: 'in_progress',
            currentSection: 'screening',
            currentQuestion: 'q1',
            stakeholderType: null,
            progress: 0
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            const request = store.add(session);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getSession(sessionId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const request = store.get(sessionId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateSession(sessionId, updates) {
        return new Promise(async (resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            
            // Get current session
            const getRequest = store.get(sessionId);
            getRequest.onsuccess = () => {
                const session = getRequest.result;
                if (!session) {
                    reject(new Error('Session not found'));
                    return;
                }

                // Update session
                const updatedSession = {
                    ...session,
                    ...updates,
                    lastModified: new Date()
                };

                const putRequest = store.put(updatedSession);
                putRequest.onsuccess = () => resolve(updatedSession);
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    // Response Management
    async saveResponse(sessionId, questionId, responseData) {
        const response = {
            sessionId,
            questionId,
            ...responseData,
            timestamp: new Date()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['responses'], 'readwrite');
            const store = transaction.objectStore('responses');
            const request = store.put(response);

            request.onsuccess = () => resolve(response);
            request.onerror = () => reject(request.error);
        });
    }

    async getResponse(sessionId, questionId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['responses'], 'readonly');
            const store = transaction.objectStore('responses');
            const request = store.get([sessionId, questionId]);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getSessionResponses(sessionId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['responses'], 'readonly');
            const store = transaction.objectStore('responses');
            const index = store.index('sessionId');
            const request = index.getAll(sessionId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Analytics Management
    async saveAnalytics(sessionId, metricType, data) {
        const analytics = {
            sessionId,
            metricType,
            data,
            calculatedAt: new Date()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['analytics'], 'readwrite');
            const store = transaction.objectStore('analytics');
            const request = store.put(analytics);

            request.onsuccess = () => resolve(analytics);
            request.onerror = () => reject(request.error);
        });
    }

    async getAnalytics(sessionId, metricType) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['analytics'], 'readonly');
            const store = transaction.objectStore('analytics');
            const request = store.get([sessionId, metricType]);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Progress Calculation
    async calculateProgress(sessionId) {
        const responses = await this.getSessionResponses(sessionId);
        const totalQuestions = LTA_QUESTIONNAIRE.questions.length;
        const answeredQuestions = new Set(responses.map(r => r.questionId)).size;
        
        const progress = Math.round((answeredQuestions / totalQuestions) * 100);
        await this.updateSession(sessionId, { progress });
        
        return progress;
    }

    // Export data for submission
    async exportSessionData(sessionId) {
        const [session, responses, analytics] = await Promise.all([
            this.getSession(sessionId),
            this.getSessionResponses(sessionId),
            this.getAllAnalytics(sessionId)
        ]);

        return {
            metadata: {
                sessionId,
                exportedAt: new Date(),
                questionnaireVersion: LTA_QUESTIONNAIRE.version
            },
            session,
            responses,
            analytics
        };
    }

    async getAllAnalytics(sessionId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['analytics'], 'readonly');
            const store = transaction.objectStore('analytics');
            const index = store.index('sessionId');
            const request = index.getAll(sessionId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Check for existing sessions
    async getIncompleteSessions() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const index = store.index('completionStatus');
            const request = index.getAll('in_progress');

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Clear session data (for testing/reset)
    async clearSession(sessionId) {
        const transaction = this.db.transaction(['sessions', 'responses', 'analytics'], 'readwrite');
        
        // Delete responses
        const responseStore = transaction.objectStore('responses');
        const responseIndex = responseStore.index('sessionId');
        const responseRequest = responseIndex.openCursor(sessionId);
        
        responseRequest.onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };

        // Delete analytics
        const analyticsStore = transaction.objectStore('analytics');
        const analyticsIndex = analyticsStore.index('sessionId');
        const analyticsRequest = analyticsIndex.openCursor(sessionId);
        
        analyticsRequest.onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };

        // Delete session
        const sessionStore = transaction.objectStore('sessions');
        sessionStore.delete(sessionId);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

// Create global instance
const LTA_DB = new LTAIndexedDB();
