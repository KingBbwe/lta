// Real-time Analytics and Reporting Engine
class LTAAnalyticsEngine {
    constructor() {
        this.sessionId = null;
        this.realTimeMetrics = new Map();
    }

    async initialize(sessionId) {
        this.sessionId = sessionId;
        await this.loadExistingMetrics();
    }

    async loadExistingMetrics() {
        try {
            const analytics = await LTA_DB.getAnalytics(this.sessionId, 'real_time');
            if (analytics) {
                this.realTimeMetrics = new Map(Object.entries(analytics.data));
            }
        } catch (error) {
            console.log('No existing analytics found, starting fresh');
        }
    }

    async processResponse(response) {
        if (!response) return;

        // Update funnel metrics
        await this.updateFunnelMetrics(response);
        
        // Update section-specific metrics
        await this.updateSectionMetrics(response);
        
        // Update stakeholder-specific insights
        await this.updateStakeholderInsights(response);
        
        // Save updated metrics
        await this.saveMetrics();
    }

    async updateFunnelMetrics(response) {
        const funnelStage = this.determineFunnelStage(response);
        if (!funnelStage) return;

        const currentMetrics = this.realTimeMetrics.get('funnel') || {
            awareness: 0,
            interest: 0,
            consideration: 0,
            action: 0,
            advocacy: 0
        };

        currentMetrics[funnelStage] = Math.max(currentMetrics[funnelStage], this.calculateStageScore(response));
        this.realTimeMetrics.set('funnel', currentMetrics);
    }

    determineFunnelStage(response) {
        const section = response.section;
        const questionId = response.questionId;

        switch (section) {
            case 'awareness':
                return 'awareness';
            case 'interest':
                return 'interest';
            case 'consideration':
                return 'consideration';
            case 'action':
                return 'action';
            case 'advocacy':
                return 'advocacy';
            default:
                return null;
        }
    }

    calculateStageScore(response) {
        // Implementation for calculating stage-specific scores
        switch (response.questionId) {
            case 'q8': // Unaided recall
                return this.calculateRecallScore(response.value);
            case 'q20': // Interest generated
                return this.mapInterestToScore(response.value);
            case 'q31': // Consideration
                return response.values && response.values.length > 0 ? 10 : 0;
            case 'q43': // Actions taken
                return response.values && response.values.length > 0 ? 10 : 0;
            case 'q54': // NPS
                return (parseInt(response.value) / 10) * 10;
            default:
                return 5; // Default medium score
        }
    }

    calculateRecallScore(text) {
        if (!text) return 0;
        const wordCount = text.split(/\s+/).length;
        return Math.min(wordCount * 2, 10);
    }

    mapInterestToScore(value) {
        const mapping = {
            'Not at all': 0,
            'Slightly': 2.5,
            'Moderately': 5,
            'Significantly': 7.5,
            'Extremely': 10
        };
        return mapping[value] || 0;
    }

    async updateSectionMetrics(response) {
        const section = response.section;
        if (!section) return;

        const sectionMetrics = this.realTimeMetrics.get(`section_${section}`) || {
            responses: 0,
            averageScore: 0,
            completionRate: 0,
            keyInsights: []
        };

        sectionMetrics.responses++;
        sectionMetrics.completionRate = await this.calculateSectionCompletion(section);
        
        // Add insight if response is significant
        const insight = this.extractInsight(response);
        if (insight) {
            sectionMetrics.keyInsights.push(insight);
            // Keep only latest 5 insights
            sectionMetrics.keyInsights = sectionMetrics.keyInsights.slice(-5);
        }

        this.realTimeMetrics.set(`section_${section}`, sectionMetrics);
    }

    async calculateSectionCompletion(section) {
        const responses = await LTA_DB.getSessionResponses(this.sessionId);
        const sectionQuestions = LTA_QUESTIONNAIRE.questions.filter(q => q.section === section);
        const answeredInSection = sectionQuestions.filter(q => 
            responses.some(r => r.questionId === q.id)
        ).length;

        return (answeredInSection / sectionQuestions.length) * 100;
    }

    extractInsight(response) {
        // Simple insight extraction based on response patterns
        if (response.questionId === 'q8' && response.value && response.value.length > 50) {
            return {
                type: 'strong_recall',
                message: 'Strong unaided recall demonstrated',
                questionId: response.questionId,
                timestamp: new Date()
            };
        }

        if (response.questionId === 'q20' && response.value === 'Extremely') {
            return {
                type: 'high_interest',
                message: 'Extremely high interest generated',
                questionId: response.questionId,
                timestamp: new Date()
            };
        }

        return null;
    }

    async updateStakeholderInsights(response) {
        const session = await LTA_DB.getSession(this.sessionId);
        const stakeholderType = session.stakeholderType;
        
        if (!stakeholderType) return;

        const stakeholderMetrics = this.realTimeMetrics.get(`stakeholder_${stakeholderType}`) || {
            responsePatterns: [],
            specificConcerns: [],
            recommendations: []
        };

        // Analyze response for stakeholder-specific patterns
        const pattern = this.analyzeStakeholderPattern(response, stakeholderType);
        if (pattern) {
            stakeholderMetrics.responsePatterns.push(pattern);
        }

        this.realTimeMetrics.set(`stakeholder_${stakeholderType}`, stakeholderMetrics);
    }

    analyzeStakeholderPattern(response, stakeholderType) {
        // Implementation for stakeholder-specific pattern analysis
        return {
            questionId: response.questionId,
            stakeholderType: stakeholderType,
            responseValue: response.value,
            analysis: 'Pattern detected',
            timestamp: new Date()
        };
    }

    async saveMetrics() {
        const metricsData = Object.fromEntries(this.realTimeMetrics);
        await LTA_DB.saveAnalytics(this.sessionId, 'real_time', metricsData);
    }

    getCurrentMetrics() {
        return Object.fromEntries(this.realTimeMetrics);
    }

    generateProgressReport() {
        const metrics = this.getCurrentMetrics();
        const funnel = metrics.funnel || {};
        
        return {
            overallProgress: this.calculateOverallProgress(),
            funnelHealth: this.assessFunnelHealth(funnel),
            keyStrengths: this.identifyStrengths(metrics),
            improvementAreas: this.identifyImprovementAreas(metrics),
            stakeholderInsights: this.compileStakeholderInsights(metrics)
        };
    }

    calculateOverallProgress() {
        const metrics = this.getCurrentMetrics();
        const sectionKeys = Object.keys(metrics).filter(key => key.startsWith('section_'));
        
        if (sectionKeys.length === 0) return 0;

        const totalCompletion = sectionKeys.reduce((sum, key) => {
            return sum + (metrics[key]?.completionRate || 0);
        }, 0);

        return totalCompletion / sectionKeys.length;
    }

    assessFunnelHealth(funnel) {
        if (!funnel) return 'unknown';

        const scores = Object.values(funnel);
        const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

        if (averageScore >= 7.5) return 'excellent';
        if (averageScore >= 5) return 'good';
        if (averageScore >= 2.5) return 'fair';
        return 'poor';
    }

    identifyStrengths(metrics) {
        const strengths = [];
        const funnel = metrics.funnel || {};

        if (funnel.awareness >= 7) {
            strengths.push('Strong brand awareness and recall');
        }

        if (funnel.interest >= 7) {
            strengths.push('High engagement and interest generation');
        }

        if (funnel.advocacy >= 7) {
            strengths.push('Excellent advocacy potential');
        }

        return strengths.length > 0 ? strengths : ['Solid foundation across all metrics'];
    }

    identifyImprovementAreas(metrics) {
        const improvements = [];
        const funnel = metrics.funnel || {};

        if (funnel.consideration < 5) {
            improvements.push('Need to improve consideration conversion');
        }

        if (funnel.action < 5) {
            improvements.push('Action conversion requires optimization');
        }

        return improvements.length > 0 ? improvements : ['Continue current optimization efforts'];
    }

    compileStakeholderInsights(metrics) {
        const insights = [];
        const stakeholderKeys = Object.keys(metrics).filter(key => key.startsWith('stakeholder_'));

        stakeholderKeys.forEach(key => {
            const stakeholderData = metrics[key];
            if (stakeholderData && stakeholderData.responsePatterns.length > 0) {
                insights.push({
                    stakeholderType: key.replace('stakeholder_', ''),
                    patternCount: stakeholderData.responsePatterns.length,
                    latestPattern: stakeholderData.responsePatterns[stakeholderData.responsePatterns.length - 1]
                });
            }
        });

        return insights;
    }

    async generateFinalReport() {
        const sessionData = await LTA_DB.exportSessionData(this.sessionId);
        const finalAnalytics = await LTA_DB.getAnalytics(this.sessionId, 'final_assessment');
        
        return {
            executiveSummary: this.generateExecutiveSummary(sessionData, finalAnalytics),
            detailedAnalysis: this.generateDetailedAnalysis(sessionData, finalAnalytics),
            recommendations: this.generateRecommendations(sessionData, finalAnalytics),
            visualizations: this.prepareVisualizationData(sessionData, finalAnalytics)
        };
    }

    generateExecutiveSummary(sessionData, finalAnalytics) {
        const awareness = finalAnalytics?.data?.awareness?.unaidedRecallScore || 0;
        const nps = finalAnalytics?.data?.conversion?.npsScore || 0;
        
        return {
            overallScore: Math.round((awareness + nps) / 2),
            keyStrength: this.identifyPrimaryStrength(finalAnalytics),
            primaryOpportunity: this.identifyPrimaryOpportunity(finalAnalytics),
            stakeholderAlignment: this.assessStakeholderAlignment(sessionData)
        };
    }

    identifyPrimaryStrength(finalAnalytics) {
        if (!finalAnalytics) return 'Strong engagement across metrics';
        
        const { awareness, engagement, conversion } = finalAnalytics.data;
        const scores = {
            awareness: awareness?.unaidedRecallScore || 0,
            engagement: engagement?.interestScore || 0,
            conversion: conversion?.npsScore || 0
        };

        return Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
    }

    identifyPrimaryOpportunity(finalAnalytics) {
        if (!finalAnalytics) return 'Continue optimization efforts';
        
        const { awareness, engagement, conversion } = finalAnalytics.data;
        const scores = {
            awareness: awareness?.unaidedRecallScore || 0,
            engagement: engagement?.interestScore || 0,
            conversion: conversion?.npsScore || 0
        };

        return Object.keys(scores).reduce((a, b) => scores[a] < scores[b] ? a : b);
    }

    assessStakeholderAlignment(sessionData) {
        const stakeholderType = sessionData.session.stakeholderType;
        return stakeholderType ? `Aligned with ${stakeholderType} perspective` : 'General perspective';
    }

    generateDetailedAnalysis(sessionData, finalAnalytics) {
        // Implementation for detailed analysis generation
        return {
            funnelAnalysis: this.analyzeFunnelPerformance(finalAnalytics),
            segmentAnalysis: this.analyzeSegmentPerformance(sessionData),
            comparativeAnalysis: this.performComparativeAnalysis(finalAnalytics)
        };
    }

    generateRecommendations(sessionData, finalAnalytics) {
        const recommendations = [];
        const { awareness, engagement, conversion } = finalAnalytics?.data || {};

        if (awareness?.unaidedRecallScore < 5) {
            recommendations.push({
                area: 'Awareness',
                recommendation: 'Increase campaign frequency and diversify media channels',
                priority: 'High',
                impact: 'Direct impact on brand recognition'
            });
        }

        if (engagement?.interestScore < 5) {
            recommendations.push({
                area: 'Engagement',
                recommendation: 'Enhance content creativity and emotional appeal',
                priority: 'Medium',
                impact: 'Improved audience connection'
            });
        }

        if (conversion?.npsScore < 7) {
            recommendations.push({
                area: 'Advocacy',
                recommendation: 'Implement referral programs and ambassador initiatives',
                priority: 'High',
                impact: 'Increased word-of-mouth marketing'
            });
        }

        return recommendations.length > 0 ? recommendations : [{
            area: 'General',
            recommendation: 'Continue current optimization strategy with regular assessment',
            priority: 'Medium',
            impact: 'Sustained performance improvement'
        }];
    }

    prepareVisualizationData(sessionData, finalAnalytics) {
        // Implementation for visualization data preparation
        return {
            funnelData: this.prepareFunnelData(finalAnalytics),
            sentimentData: this.prepareSentimentData(sessionData),
            comparativeData: this.prepareComparativeData(finalAnalytics)
        };
    }

    // Additional helper methods for specific analyses...
}

// Create global instance
const LTA_ANALYTICS = new LTAAnalyticsEngine();
