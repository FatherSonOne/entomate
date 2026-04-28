# Graph Report - .  (2026-04-27)

## Corpus Check
- Large corpus: 734 files · ~1,265,787 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 2556 nodes · 2976 edges · 127 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 734 · Candidates: 861
- Excluded: 60 untracked · 58063 ignored · 10 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.
## God Nodes (most connected - your core abstractions)
1. `svgProps()` - 39 edges
2. `ExplainabilityService` - 31 edges
3. `AutomationEngine` - 28 edges
4. `EcosystemBridge` - 25 edges
5. `VectorStore` - 25 edges
6. `CalendarService` - 21 edges
7. `DealRiskService` - 21 edges
8. `RelationshipIntelligenceService` - 21 edges
9. `NaturalLanguageGenerator` - 19 edges
10. `SlackNotifier` - 19 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (39): IconBarChart(), IconBook(), IconBot(), IconBrain(), IconCalendar(), IconChat(), IconCheckCircle(), IconDocument() (+31 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (18): ActivityLoggedTrigger, AssignOwnerNode, CalculateLeadScoreNode, ContactCreatedTrigger, CreateContactNode, CreateCRMTaskNode, CreateDealNode, DealClosedTrigger (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (1): ExplainabilityService

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (2): AIAgent, AIAgentService

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (1): AutomationEngine

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (7): ChunkTextNode, DocumentLoaderNode, EmbeddingNode, RAGQueryNode, SemanticCompareNode, VectorSearchNode, VectorStoreNode

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (18): acceptInvite(), checkAiQuota(), createOrgViaRpc(), getAiUsage(), getCurrentMonth(), getCurrentOrg(), getDeletedOrg(), getPendingInviteForUser() (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (10): CodeNode, CreateTaskNode, ExecuteWorkflowNode, HttpRequestNode, RespondWebhookNode, SendEmailNode, SendPulseNode, SendSlackNode (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (19): completeSync(), connectIntegration(), createCalendarEvent(), createFieldMapping(), createVideoMeeting(), getDisplayName(), getIntegration(), getVideoMeetings() (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (2): EcosystemBridge, getEcosystemBridge()

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (1): VectorStore

### Community 12 - "Community 12"
Cohesion: 0.1
Nodes (10): calculateEventScore(), extractEventTitle(), getHubClient(), getRecentSearches(), groupResultsByType(), search(), searchActionItems(), searchContacts() (+2 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (14): evaluateExpression(), evaluateParsed(), findExpressions(), getAutocompleteSuggestions(), parseArguments(), parseArgumentValue(), parseExpression(), parseFunctionCall() (+6 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (15): assignRole(), assignRoleByName(), checkPermissions(), createRole(), getRole(), getRoleByName(), getUserPermissions(), getUserRoles() (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.21
Nodes (20): authHeaders(), db(), getRecallBotState(), handleRecallWebhook(), hashOptOutToken(), latestRecallStatusCode(), launchBotSession(), listActiveSessions() (+12 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (1): CalendarService

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (1): DealRiskService

### Community 19 - "Community 19"
Cohesion: 0.16
Nodes (1): RelationshipIntelligenceService

### Community 20 - "Community 20"
Cohesion: 0.1
Nodes (9): AggregateNode, FilterNode, IfNode, LoopNode, MergeNode, SplitBatchesNode, StopErrorNode, SwitchNode (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.16
Nodes (18): addKeyword(), checkTalkTimeBalance(), createPrompt(), detectKeywords(), dismissPrompt(), endCoachingSession(), generateCoachingSuggestion(), generateObjectionResponse() (+10 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (16): createSignature(), createWebhook(), deliverWebhook(), generateSecret(), getWebhook(), getWebhooksForEvent(), mapDeliveryFromDb(), mapWebhookFromDb() (+8 more)

### Community 24 - "Community 24"
Cohesion: 0.1
Nodes (1): NaturalLanguageGenerator

### Community 25 - "Community 25"
Cohesion: 0.19
Nodes (1): SlackNotifier

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (17): assembleContext(), emptyContext(), enrichParticipantsWithNotes(), estimateTokens(), extractParticipantNames(), gatherContacts(), gatherContextViaBridge(), gatherDeals() (+9 more)

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (12): exportAuditLogs(), logAccess(), logAudit(), logCreate(), logDelete(), logLogin(), logLogout(), logPermissionChange() (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.11
Nodes (6): ActionItemCreatedTrigger, ErrorTrigger, ManualTrigger, MeetingProcessedTrigger, ScheduleTrigger, WebhookTrigger

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (1): RAGHandler

### Community 32 - "Community 32"
Cohesion: 0.21
Nodes (1): MeetingPrepService

### Community 33 - "Community 33"
Cohesion: 0.21
Nodes (1): WorkflowExecutor

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (1): WorkflowScheduler

### Community 35 - "Community 35"
Cohesion: 0.14
Nodes (6): CryptoNode, DateTimeNode, JsonNode, SetNode, SplitNode, TransformNode

### Community 36 - "Community 36"
Cohesion: 0.21
Nodes (1): FollowupAgent

### Community 37 - "Community 37"
Cohesion: 0.19
Nodes (1): ChatService

### Community 38 - "Community 38"
Cohesion: 0.2
Nodes (1): ActionItemTrackerService

### Community 39 - "Community 39"
Cohesion: 0.19
Nodes (1): IntelligenceService

### Community 40 - "Community 40"
Cohesion: 0.18
Nodes (9): createActivityFromMeeting(), createCrmTask(), findTeamMemberByName(), retryFailedSyncs(), syncActionItemToCrm(), syncAllPendingActionItems(), syncMeetingActionItemsToCrm(), syncMeetingToCrm() (+1 more)

### Community 41 - "Community 41"
Cohesion: 0.13
Nodes (2): getProjectStats(), getTasksByProject()

### Community 42 - "Community 42"
Cohesion: 0.24
Nodes (1): CRMService

### Community 43 - "Community 43"
Cohesion: 0.18
Nodes (1): SchedulerService

### Community 44 - "Community 44"
Cohesion: 0.15
Nodes (1): BaseNode

### Community 45 - "Community 45"
Cohesion: 0.18
Nodes (8): acknowledgeAlert(), checkHealthAlerts(), checkRepeatedNegativeSentiment(), createAlert(), dismissAlert(), getAlert(), mapAlertFromDb(), resolveAlert()

### Community 46 - "Community 46"
Cohesion: 0.2
Nodes (10): calculateDealProgressScore(), calculateEngagementScore(), calculateHealthScore(), calculateResponsivenessScore(), calculateTaskCompletionScore(), getCustomerHealth(), mapHealthFromDb(), recalculateAllHealth() (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.2
Nodes (1): AgentOrchestrator

### Community 48 - "Community 48"
Cohesion: 0.22
Nodes (1): AutomationScheduler

### Community 49 - "Community 49"
Cohesion: 0.17
Nodes (5): AdvancedBlock(), highlightText(), SectionDetail(), SubSectionBlock(), UseCaseBlock()

### Community 50 - "Community 50"
Cohesion: 0.21
Nodes (11): linkActionItemToTask(), linkMeetingToActionItem(), linkMeetingToDeal(), linkProjectToDeal(), linkTaskToMeeting(), linkTaskToProject(), processActionItemRelationships(), processMeetingRelationships() (+3 more)

### Community 51 - "Community 51"
Cohesion: 0.23
Nodes (12): analyzeAndStoreSentiment(), analyzeMeetingSentiment(), analyzePulseMessageSentiment(), analyzeSentiment(), batchAnalyzeSentiment(), getAI(), getAverageSentiment(), getSentimentBySource() (+4 more)

### Community 52 - "Community 52"
Cohesion: 0.2
Nodes (1): AIService

### Community 53 - "Community 53"
Cohesion: 0.29
Nodes (12): attendeeOptOutHtml(), attendeeOptOutText(), buildOptOutUrl(), deletionRequestNotificationHtml(), deletionRequestNotificationText(), escapeHtml(), organizerOptOutNotificationHtml(), organizerOptOutNotificationText() (+4 more)

### Community 54 - "Community 54"
Cohesion: 0.18
Nodes (1): ExplanationAnalytics

### Community 55 - "Community 55"
Cohesion: 0.2
Nodes (1): ExplanationService

### Community 56 - "Community 56"
Cohesion: 0.25
Nodes (1): PatternDetectionService

### Community 57 - "Community 57"
Cohesion: 0.19
Nodes (6): base64ToArrayBuffer(), blobToBase64(), executeAction(), getAudioContext(), handleLiveConnect(), handleTTS()

### Community 59 - "Community 59"
Cohesion: 0.26
Nodes (11): fetchFromPulseApi(), formatMeetingNotification(), formatMeetingSummaryForPulse(), getOrCreateEntomateChannel(), getPulseChannels(), notifyAssigneesAboutActionItems(), notifyUsersAboutMeeting(), postMeetingSummaryToPulse() (+3 more)

### Community 60 - "Community 60"
Cohesion: 0.32
Nodes (11): generateFinalReport(), generatePerformanceReport(), main(), runTest(), testAgentsAPI(), testAutomationsAPI(), testIntelligenceAPI(), testMeetingsAPI() (+3 more)

### Community 61 - "Community 61"
Cohesion: 0.23
Nodes (1): EmbeddingService

### Community 62 - "Community 62"
Cohesion: 0.17
Nodes (2): clearUser(), setUser()

### Community 63 - "Community 63"
Cohesion: 0.26
Nodes (1): OutcomeTracker

### Community 64 - "Community 64"
Cohesion: 0.24
Nodes (2): MemoryCache, withCache()

### Community 66 - "Community 66"
Cohesion: 0.19
Nodes (4): trackFeedback(), trackMeetingCompleted(), updateAllProfileEffectiveness(), updateProfileEffectiveness()

### Community 67 - "Community 67"
Cohesion: 0.17
Nodes (1): LogosVisionService

### Community 69 - "Community 69"
Cohesion: 0.18
Nodes (2): DashboardHero(), useTypewriter()

### Community 70 - "Community 70"
Cohesion: 0.26
Nodes (8): createProfile(), getMeetingIntelligenceConfig(), getProfileById(), getProfileBySlug(), rowToConfig(), rowToProfile(), saveMeetingIntelligenceConfig(), updateProfile()

### Community 72 - "Community 72"
Cohesion: 0.33
Nodes (10): getAIConfig(), handleContactUpdated(), handleMeetingExport(), handleMeetingFeedback(), handleNotification(), handleTaskCompleted(), processAudioExport(), processTranscriptExport() (+2 more)

### Community 73 - "Community 73"
Cohesion: 0.25
Nodes (1): DeadlineAgent

### Community 74 - "Community 74"
Cohesion: 0.25
Nodes (1): AskService

### Community 75 - "Community 75"
Cohesion: 0.29
Nodes (1): LearningEngine

### Community 76 - "Community 76"
Cohesion: 0.27
Nodes (1): ErrorMonitoringService

### Community 77 - "Community 77"
Cohesion: 0.18
Nodes (5): AIAgentNode, AIClassifyNode, AIExtractNode, AIPromptNode, DetectFollowupsNode

### Community 78 - "Community 78"
Cohesion: 0.33
Nodes (8): isValidDate(), isValidUUID(), sanitizeString(), validateAutomation(), validateMeeting(), validateProject(), validateSearchQuery(), validateTask()

### Community 79 - "Community 79"
Cohesion: 0.25
Nodes (1): ApiCache

### Community 80 - "Community 80"
Cohesion: 0.22
Nodes (3): getSectionLabel(), streamQuery(), streamQueryFallback()

### Community 82 - "Community 82"
Cohesion: 0.24
Nodes (4): blobToBase64(), handleStopAndProcess(), loadPastMeetings(), stopRecording()

### Community 83 - "Community 83"
Cohesion: 0.42
Nodes (9): indexActionItems(), indexDeals(), indexDocument(), indexMeeting(), indexMeetings(), indexProjects(), indexPulseMessages(), indexTasks() (+1 more)

### Community 84 - "Community 84"
Cohesion: 0.33
Nodes (1): GeminiService

### Community 85 - "Community 85"
Cohesion: 0.33
Nodes (1): OpenAIService

### Community 86 - "Community 86"
Cohesion: 0.2
Nodes (1): PerformanceMonitor

### Community 87 - "Community 87"
Cohesion: 0.2
Nodes (1): AppError

### Community 88 - "Community 88"
Cohesion: 0.2
Nodes (1): ReportService

### Community 89 - "Community 89"
Cohesion: 0.27
Nodes (1): NodeRegistry

### Community 90 - "Community 90"
Cohesion: 0.33
Nodes (1): AIUsageLogger

### Community 91 - "Community 91"
Cohesion: 0.22
Nodes (2): EventRow(), getTimeAgo()

### Community 92 - "Community 92"
Cohesion: 0.44
Nodes (9): Build-Images(), Deploy-Compose(), Invoke-Rollback(), Push-Images(), Test-Health(), Test-Prerequisites(), Write-Error(), Write-Info() (+1 more)

### Community 93 - "Community 93"
Cohesion: 0.27
Nodes (4): generateId(), handleKeyDown(), handleSelectMeeting(), handleSendMessage()

### Community 94 - "Community 94"
Cohesion: 0.24
Nodes (3): generateSlug(), updateCustomField(), updateFocusArea()

### Community 95 - "Community 95"
Cohesion: 0.22
Nodes (2): getGraphBundle(), getLinksForEntity()

### Community 96 - "Community 96"
Cohesion: 0.25
Nodes (1): BaseAgent

### Community 97 - "Community 97"
Cohesion: 0.28
Nodes (1): PriorityAgent

### Community 98 - "Community 98"
Cohesion: 0.33
Nodes (1): EmailService

### Community 99 - "Community 99"
Cohesion: 0.25
Nodes (1): FeedbackService

### Community 100 - "Community 100"
Cohesion: 0.25
Nodes (2): initialize(), initializeLocalFallback()

### Community 101 - "Community 101"
Cohesion: 0.53
Nodes (8): apiRequest(), generateRecommendations(), generateReport(), recordTest(), runAudit(), testAIAgents(), testAutomationEngine(), testMeetingIntelligence()

### Community 102 - "Community 102"
Cohesion: 0.39
Nodes (5): CreateGoalModal(), getCurrentQuarter(), getQuarterOptions(), GoalDetailPanel(), Goals()

### Community 104 - "Community 104"
Cohesion: 0.29
Nodes (1): EcosystemScheduler

### Community 105 - "Community 105"
Cohesion: 0.43
Nodes (1): HubEventPublisher

### Community 107 - "Community 107"
Cohesion: 0.43
Nodes (6): clamp(), computeDealProbability(), daysSince(), getDealData(), getDealStats(), storePrediction()

### Community 108 - "Community 108"
Cohesion: 0.39
Nodes (5): addDays(), computeTaskEta(), getTaskData(), getTaskHistoryStats(), storePrediction()

### Community 109 - "Community 109"
Cohesion: 0.43
Nodes (6): buildMeetingPrompt(), formatOutputStyle(), formatParticipants(), formatPastMeetings(), processConditionals(), replaceAll()

### Community 111 - "Community 111"
Cohesion: 0.29
Nodes (2): buildCitations(), sanitizeSnippet()

### Community 112 - "Community 112"
Cohesion: 0.43
Nodes (6): checkAgents(), checkDatabase(), checkKnowledgeGraph(), checkPredictions(), checkProjectTasks(), runAllHealthChecks()

### Community 114 - "Community 114"
Cohesion: 0.38
Nodes (4): createSchedulesForWorkflow(), createWebhooksForWorkflow(), updateSchedulesForWorkflow(), updateWebhooksForWorkflow()

### Community 115 - "Community 115"
Cohesion: 0.33
Nodes (1): AssignmentAgent

### Community 116 - "Community 116"
Cohesion: 0.71
Nodes (6): fail(), info(), log(), runTests(), success(), warn()

### Community 118 - "Community 118"
Cohesion: 0.38
Nodes (4): DiffViewer(), formatRelativeTime(), generateDiff(), VersionItem()

### Community 119 - "Community 119"
Cohesion: 0.33
Nodes (2): handleReindex(), loadIndexingStats()

### Community 122 - "Community 122"
Cohesion: 0.38
Nodes (4): deduplicateItems(), retrieveContext(), searchBySourceType(), searchDocuments()

### Community 123 - "Community 123"
Cohesion: 0.53
Nodes (4): getAllTemplates(), getCategories(), getTemplateById(), getTemplatesByCategory()

### Community 124 - "Community 124"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 125 - "Community 125"
Cohesion: 0.53
Nodes (4): ExecutionStep(), ExecutionTraceViewer(), formatDuration(), formatTime()

### Community 128 - "Community 128"
Cohesion: 0.47
Nodes (3): getSystemTheme(), ThemeProvider(), useTheme()

### Community 131 - "Community 131"
Cohesion: 0.6
Nodes (5): getEnvConfig(), getEnvVar(), isDevelopment(), isProduction(), validateEnv()

### Community 135 - "Community 135"
Cohesion: 0.4
Nodes (2): generateEmbedding(), getGenAI()

### Community 136 - "Community 136"
Cohesion: 0.53
Nodes (4): extractActionItems(), processMeetingAudio(), summarizeMeeting(), transcribeAudio()

### Community 140 - "Community 140"
Cohesion: 0.7
Nodes (4): getAllTemplates(), getCategories(), getTemplateById(), getTemplatesByCategory()

### Community 143 - "Community 143"
Cohesion: 0.5
Nodes (2): evaluateKeywordRule(), suggestProfilesForMeeting()

### Community 145 - "Community 145"
Cohesion: 0.7
Nodes (3): formatShortcut(), getModKey(), useKeyboardShortcuts()

### Community 148 - "Community 148"
Cohesion: 0.6
Nodes (4): downloadProfile(), exportProfile(), importProfile(), validateImport()

### Community 151 - "Community 151"
Cohesion: 0.6
Nodes (3): ask(), generateAnswer(), getGenAI()

### Community 154 - "Community 154"
Cohesion: 0.83
Nodes (3): getTokens(), requireCalendar(), saveTokensToDB()

### Community 167 - "Community 167"
Cohesion: 0.67
Nodes (2): SettingsProvider(), useDebouncedSave()

### Community 172 - "Community 172"
Cohesion: 0.83
Nodes (3): handleDelete(), handleImport(), loadData()

### Community 175 - "Community 175"
Cohesion: 0.67
Nodes (2): applyThemeToDom(), getSystemTheme()

### Community 177 - "Community 177"
Cohesion: 1
Nodes (2): probeTable(), verifyBotSchema()

### Community 186 - "Community 186"
Cohesion: 1
Nodes (2): getBreadcrumb(), Layout()

### Community 190 - "Community 190"
Cohesion: 1
Nodes (2): formatFeedbackReason(), PatternCard()

### Community 206 - "Community 206"
Cohesion: 1
Nodes (2): loadInitialData(), runSuggestions()

### Community 211 - "Community 211"
Cohesion: 1
Nodes (2): evaluateRule(), suggestProfiles()

## Knowledge Gaps
- **Thin community `Community 3`** (1 nodes): `ExplainabilityService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 4`** (2 nodes): `AIAgent`, `AIAgentService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 5`** (1 nodes): `AutomationEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (2 nodes): `EcosystemBridge`, `getEcosystemBridge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (1 nodes): `VectorStore`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `CalendarService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `DealRiskService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `RelationshipIntelligenceService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `NaturalLanguageGenerator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `SlackNotifier`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `RAGHandler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `MeetingPrepService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `WorkflowExecutor`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `WorkflowScheduler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `FollowupAgent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `ChatService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `ActionItemTrackerService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `IntelligenceService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `getProjectStats()`, `getTasksByProject()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `CRMService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `SchedulerService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `BaseNode`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `AgentOrchestrator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `AutomationScheduler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `AIService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `ExplanationAnalytics`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `ExplanationService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `PatternDetectionService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `EmbeddingService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (2 nodes): `clearUser()`, `setUser()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `OutcomeTracker`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (2 nodes): `MemoryCache`, `withCache()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `LogosVisionService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (2 nodes): `DashboardHero()`, `useTypewriter()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `DeadlineAgent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `AskService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `LearningEngine`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `ErrorMonitoringService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `ApiCache`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (1 nodes): `GeminiService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `OpenAIService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `PerformanceMonitor`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `AppError`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `ReportService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `NodeRegistry`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `AIUsageLogger`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (2 nodes): `EventRow()`, `getTimeAgo()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (2 nodes): `getGraphBundle()`, `getLinksForEntity()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 96`** (1 nodes): `BaseAgent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 97`** (1 nodes): `PriorityAgent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 98`** (1 nodes): `EmailService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 99`** (1 nodes): `FeedbackService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 100`** (2 nodes): `initialize()`, `initializeLocalFallback()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 104`** (1 nodes): `EcosystemScheduler`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 105`** (1 nodes): `HubEventPublisher`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 111`** (2 nodes): `buildCitations()`, `sanitizeSnippet()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 115`** (1 nodes): `AssignmentAgent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 119`** (2 nodes): `handleReindex()`, `loadIndexingStats()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 124`** (1 nodes): `ErrorBoundary`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 135`** (2 nodes): `generateEmbedding()`, `getGenAI()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 143`** (2 nodes): `evaluateKeywordRule()`, `suggestProfilesForMeeting()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 167`** (2 nodes): `SettingsProvider()`, `useDebouncedSave()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 175`** (2 nodes): `applyThemeToDom()`, `getSystemTheme()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 177`** (2 nodes): `probeTable()`, `verifyBotSchema()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 186`** (2 nodes): `getBreadcrumb()`, `Layout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 190`** (2 nodes): `formatFeedbackReason()`, `PatternCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 206`** (2 nodes): `loadInitialData()`, `runSuggestions()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 211`** (2 nodes): `evaluateRule()`, `suggestProfiles()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._