import { FormEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import {
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  PlayCircle,
  Plus,
  SendHorizonal,
  Sparkles,
  Square,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { callAction, callActionWithFiles, errorMessage } from '../lib/backend';
import type {
  AiScenarioRow,
  ConversationCompleteResponse,
  ConversationFeedback,
  ConversationMessage,
  ConversationSendResponse,
  ConversationStartResponse,
  ScenarioListResponse,
} from '../types';

const DIFFICULTY_OPTIONS = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
];

const STYLE_OPTIONS = [
  { key: 'casual', label: 'Casual' },
  { key: 'polite', label: 'Polite' },
  { key: 'practical', label: 'Practical' },
  { key: 'interview', label: 'Interview' },
];

const VOICE_OPTIONS = [
  { key: 'alloy', label: 'Alloy' },
  { key: 'verse', label: 'Verse' },
  { key: 'coral', label: 'Coral' },
  { key: 'sage', label: 'Sage' },
];

function scenarioCardTone(active: boolean): string {
  if (active) {
    return 'app-select-card app-select-card-active';
  }
  return 'app-select-card';
}

function optionButtonClass(active: boolean): string {
  return active ? 'app-option app-option-active' : 'app-option';
}

function audioDataUrl(message: ConversationMessage): string {
  if (!message.audio_base64) {
    return '';
  }
  return `data:${message.audio_mime_type || 'audio/mpeg'};base64,${message.audio_base64}`;
}

export function Conversation() {
  const { deckId = '' } = useParams<{ deckId: string }>();
  const { decks, setCurrentDeck, setStatus } = useApp();

  const [scenarios, setScenarios] = useState<AiScenarioRow[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [isGeneratingScenarios, setIsGeneratingScenarios] = useState(false);
  const [isCreatingScenario, setIsCreatingScenario] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isCompletingSession, setIsCompletingSession] = useState(false);
  const [shouldGenerateMore, setShouldGenerateMore] = useState(false);
  const [recommendedReason, setRecommendedReason] = useState('');

  const [customTitle, setCustomTitle] = useState('');
  const [customSummary, setCustomSummary] = useState('');
  const [topicHint, setTopicHint] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [style, setStyle] = useState('casual');

  const [sessionId, setSessionId] = useState('');
  const [partnerName, setPartnerName] = useState('AI Partner');
  const [activeScenario, setActiveScenario] = useState<AiScenarioRow | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversationMode, setConversationMode] = useState<'text' | 'voice'>('text');
  const [voice, setVoice] = useState('alloy');
  const [messageInput, setMessageInput] = useState('');
  const [shouldWrapUp, setShouldWrapUp] = useState(false);
  const [feedback, setFeedback] = useState<ConversationFeedback | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const deck = decks.find((item) => item.id === deckId) ?? null;
  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null;

  const playAudioBase64 = (audioBase64 = '', mimeType = 'audio/mpeg') => {
    if (!audioBase64) {
      return;
    }
    const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
    void audio.play().catch(() => {
      setStatus({
        type: 'warning',
        message: 'Audio playback was blocked by the browser. Use the replay button on the message.',
      });
    });
  };

  const loadScenarios = async () => {
    if (!deckId) {
      setScenarios([]);
      setSelectedScenarioId('');
      return;
    }

    try {
      setIsLoadingScenarios(true);
      const response = await callAction<ScenarioListResponse>(
        'list_conversation_scenarios',
        { deck_id: deckId },
      );
      setScenarios(response.scenarios ?? []);
      setShouldGenerateMore(Boolean(response.should_generate_more));
      setRecommendedReason(response.recommended_reason ?? '');
      setSelectedScenarioId((previous) => {
        if (previous && response.scenarios.some((item) => item.id === previous)) {
          return previous;
        }
        return response.scenarios[0]?.id ?? '';
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsLoadingScenarios(false);
    }
  };

  useEffect(() => {
    if (!deckId) {
      return;
    }
    setCurrentDeck(deckId);
    void loadScenarios();
  }, [deckId, setCurrentDeck]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const generateSuggestedScenarios = async () => {
    if (!deckId) {
      return;
    }

    try {
      setIsGeneratingScenarios(true);
      const response = await callAction<ScenarioListResponse>(
        'generate_conversation_scenarios',
        {
          deck_id: deckId,
          count: 6,
        },
      );
      setScenarios(response.scenarios ?? []);
      setShouldGenerateMore(Boolean(response.should_generate_more));
      setRecommendedReason(response.recommended_reason ?? '');
      setSelectedScenarioId((response.scenarios ?? [])[0]?.id ?? '');
      setStatus({
        type: 'success',
        message: `Generated ${response.generated_count ?? 0} conversation scenario suggestion(s).`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsGeneratingScenarios(false);
    }
  };

  const createScenario = async () => {
    if (!deckId) {
      return;
    }

    try {
      setIsCreatingScenario(true);
      const response = await callAction<{ scenario: AiScenarioRow }>(
        'create_conversation_scenario',
        {
          deck_id: deckId,
          title: customTitle.trim(),
          summary: customSummary.trim(),
          topic_hint: topicHint.trim(),
          difficulty,
          style,
        },
      );
      setCustomTitle('');
      setCustomSummary('');
      setTopicHint('');
      await loadScenarios();
      setSelectedScenarioId(response.scenario.id);
      setStatus({
        type: 'success',
        message: `Added conversation scenario "${response.scenario.title}".`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsCreatingScenario(false);
    }
  };

  const startConversation = async () => {
    const scenarioId = selectedScenario?.id;
    if (!deckId || !scenarioId) {
      return;
    }

    try {
      setIsStartingSession(true);
      const response = await callAction<ConversationStartResponse>(
        'start_conversation_session',
        {
          deck_id: deckId,
          scenario_id: scenarioId,
          spoken: conversationMode === 'voice',
          voice,
        },
      );
      setSessionId(response.session_id);
      setPartnerName(response.partner_name);
      setActiveScenario(response.scenario);
      setMessages(response.messages ?? []);
      setMessageInput('');
      setRecordedAudio(null);
      setShouldWrapUp(false);
      setFeedback(null);
      setSelectedScenarioId(response.scenario.id);
      if (conversationMode === 'voice') {
        playAudioBase64(response.audio_base64, response.audio_mime_type);
      }
      await loadScenarios();
      setStatus({
        type: 'success',
        message: `Started conversation for "${response.scenario.title}".`,
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsStartingSession(false);
    }
  };

  const sendMessage = async () => {
    if (!sessionId || !messageInput.trim()) {
      return;
    }

    try {
      setIsSendingMessage(true);
      const response = await callAction<ConversationSendResponse>(
        'send_conversation_message',
        {
          session_id: sessionId,
          message: messageInput.trim(),
        },
      );
      setMessages(response.messages ?? []);
      setShouldWrapUp(Boolean(response.should_wrap_up));
      setMessageInput('');
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus({
        type: 'error',
        message: 'Audio recording is not available in this browser.',
      });
      return;
    }

    try {
      setRecordedAudio(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        setRecordedAudio(blob);
        setIsRecording(false);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      setIsRecording(false);
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      return;
    }
    setIsRecording(false);
  };

  const sendRecordedAudio = async () => {
    if (!sessionId || !recordedAudio) {
      return;
    }

    try {
      setIsSendingAudio(true);
      const file = new File(
        [recordedAudio],
        recordedAudio.type.includes('mp4') ? 'conversation.m4a' : 'conversation.webm',
        { type: recordedAudio.type || 'audio/webm' },
      );
      const response = await callActionWithFiles<ConversationSendResponse>(
        'send_spoken_conversation_audio',
        {
          session_id: sessionId,
          voice,
        },
        'audio_path',
        [file],
        'single',
      );
      setMessages(response.messages ?? []);
      setShouldWrapUp(Boolean(response.should_wrap_up));
      setRecordedAudio(null);
      playAudioBase64(response.audio_base64, response.audio_mime_type);
      setStatus({
        type: 'success',
        message: response.transcript
          ? `Transcribed: ${response.transcript}`
          : 'Audio message sent.',
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsSendingAudio(false);
    }
  };

  const completeConversation = async () => {
    if (!sessionId) {
      return;
    }

    try {
      setIsCompletingSession(true);
      const response = await callAction<ConversationCompleteResponse>(
        'complete_conversation_session',
        {
          session_id: sessionId,
        },
      );
      setMessages(response.messages ?? []);
      setFeedback(response.feedback);
      setShouldWrapUp(false);
      await loadScenarios();
      setStatus({
        type: 'success',
        message: 'Conversation review is ready.',
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: errorMessage(error),
      });
    } finally {
      setIsCompletingSession(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  if (!deck) {
    return (
      <div className="app-page max-w-4xl">
        <div className="app-empty">
          Deck not found.
        </div>
      </div>
    );
  }

  return (
    <div className="app-page max-w-7xl">
      <div className="app-page-header">
        <div>
          <h2 className="app-page-title">Conversation: {deck.name}</h2>
          <p className="app-page-description">
            Cached conversation situations tied to this deck, with a Japanese chat
            partner and a post-conversation review.
          </p>
        </div>
      </div>

      <div className="grid xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <div className="space-y-6">
          <div className="app-panel p-6">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">Scenario Pool</h3>
                <p className="text-sm text-gray-600">
                  Suggestions stay cached until you explicitly ask for more.
                </p>
              </div>
              <button
                onClick={() => void generateSuggestedScenarios()}
                disabled={isGeneratingScenarios}
                className="app-btn-primary"
              >
                {isGeneratingScenarios ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate Suggestions
              </button>
            </div>
            {recommendedReason && (
              <div className="app-banner">
                {shouldGenerateMore ? 'Suggestion:' : 'Cache status:'} {recommendedReason}
              </div>
            )}
          </div>

          <div className="app-panel p-6">
            <h3 className="font-semibold mb-4">Add Custom Situation / Topic</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(event) => setCustomTitle(event.target.value)}
                  placeholder="Ordering coffee, asking for directions, job interview..."
                  className="app-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Summary
                </label>
                <textarea
                  value={customSummary}
                  onChange={(event) => setCustomSummary(event.target.value)}
                  rows={3}
                  placeholder="Optional note for the conversation goal."
                  className="app-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topic Hint
                </label>
                <input
                  type="text"
                  value={topicHint}
                  onChange={(event) => setTopicHint(event.target.value)}
                  placeholder="shopping, school, train station, part-time job..."
                  className="app-input"
                />
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Difficulty
                </div>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setDifficulty(option.key)}
                      className={optionButtonClass(difficulty === option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Style
                </div>
                <div className="flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setStyle(option.key)}
                      className={optionButtonClass(style === option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => void createScenario()}
                disabled={isCreatingScenario}
                className="app-btn-secondary w-full"
              >
                {isCreatingScenario ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add Custom Conversation
              </button>
            </div>
          </div>

          <div className="app-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Cached Scenarios</h3>
              {isLoadingScenarios && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {scenarios.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                  No conversation scenarios are cached yet. Generate suggestions or add a custom topic.
                </div>
              ) : (
                scenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => setSelectedScenarioId(scenario.id)}
                    className={`w-full ${scenarioCardTone(scenario.id === selectedScenarioId)}`}
                  >
                    <div className="font-semibold text-gray-900 mb-1">
                      {scenario.title}
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      {scenario.summary}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="app-badge-muted">
                        {scenario.difficulty}
                      </span>
                      <span className="app-badge-muted">
                        {scenario.style || 'casual'}
                      </span>
                      {scenario.is_custom && (
                        <span className="app-badge-accent">
                          Custom
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {selectedScenario && (
            <div className="app-panel p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-2">
                    Selected Scenario
                  </div>
                  <h3 className="text-2xl font-semibold text-slate-900 mb-2">
                    {selectedScenario.title}
                  </h3>
                  <p className="text-gray-600">{selectedScenario.summary}</p>
                </div>

                <button
                  onClick={() => void startConversation()}
                  disabled={isStartingSession}
                  className="app-btn-primary"
                >
                  {isStartingSession ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageSquareText className="w-4 h-4" />
                  )}
                  Start Conversation
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <span className="app-badge-muted">
                  {selectedScenario.difficulty}
                </span>
                <span className="app-badge-muted">
                  {selectedScenario.style || 'casual'}
                </span>
                <span className="app-badge-muted">
                  Used {selectedScenario.times_used}
                </span>
                <span className="app-badge-muted">
                  Completed {selectedScenario.times_completed}
                </span>
              </div>

              {selectedScenario.topic_hint && (
                <div className="mt-4 text-sm text-gray-600">
                  Topic focus: {selectedScenario.topic_hint}
                </div>
              )}

              <div className="mt-5 grid gap-4 border-t border-gray-200 pt-5 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700">
                    Conversation Mode
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setConversationMode('text')}
                      className={optionButtonClass(conversationMode === 'text')}
                    >
                      Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setConversationMode('voice')}
                      className={optionButtonClass(conversationMode === 'voice')}
                    >
                      Spoken
                    </button>
                  </div>
                </div>

                {conversationMode === 'voice' && (
                  <div>
                    <div className="mb-2 text-sm font-medium text-gray-700">
                      AI Voice
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {VOICE_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setVoice(option.key)}
                          className={optionButtonClass(voice === option.key)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Spoken replies use an AI-generated voice.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {sessionId ? (
            <>
              <div className="app-panel overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm uppercase tracking-[0.2em] text-slate-500 mb-1">
                        Live Conversation
                      </div>
                      <h3 className="text-xl font-semibold text-slate-900">
                        {activeScenario?.title ?? selectedScenario?.title}
                      </h3>
                      <div className="text-sm text-gray-600 mt-1">
                        Partner: {partnerName}
                      </div>
                    </div>

                    <button
                      onClick={() => void completeConversation()}
                      disabled={isCompletingSession || Boolean(feedback)}
                      className="app-btn-secondary"
                    >
                      {isCompletingSession ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      Finish and Review
                    </button>
                  </div>

                  {shouldWrapUp && !feedback && (
                    <div className="app-banner-warning mt-4">
                      The AI thinks this is a good point to wrap up and get feedback.
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 px-4 py-5">
                  <div className="space-y-4 max-h-[420px] overflow-y-auto px-2">
                    {messages.map((message, index) => {
                      const isAssistant = message.role === 'assistant';
                      return (
                        <div
                          key={`${message.role}-${index}`}
                          className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
                              isAssistant
                                ? 'border border-slate-200 bg-white text-slate-900'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">
                              {isAssistant ? partnerName : 'You'}
                              {message.input_mode === 'voice' ? ' · voice' : ''}
                            </div>
                            <div className="whitespace-pre-wrap">{message.content}</div>
                            {isAssistant && message.audio_base64 && (
                              <button
                                type="button"
                                onClick={() =>
                                  playAudioBase64(
                                    message.audio_base64,
                                    message.audio_mime_type,
                                  )
                                }
                                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white"
                              >
                                <PlayCircle className="h-4 w-4" />
                                Replay audio
                              </button>
                            )}
                            {isAssistant && message.audio_base64 && (
                              <audio
                                controls
                                src={audioDataUrl(message)}
                                className="mt-3 h-9 w-full max-w-xs"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {conversationMode === 'voice' ? (
                  <div className="border-t border-gray-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-gray-600">
                        {isRecording
                          ? 'Recording... speak your Japanese reply, then stop.'
                          : recordedAudio
                            ? 'Recording ready to send.'
                            : 'Record a spoken reply, then send it for transcription.'}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!isRecording ? (
                          <button
                            type="button"
                            onClick={() => void startRecording()}
                            disabled={Boolean(feedback) || isSendingAudio}
                            className="app-btn-secondary"
                          >
                            <Mic className="h-4 w-4" />
                            Record
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="app-btn-secondary"
                          >
                            <MicOff className="h-4 w-4" />
                            Stop
                          </button>
                        )}
                        {recordedAudio && (
                          <>
                            <button
                              type="button"
                              onClick={() => setRecordedAudio(null)}
                              disabled={isSendingAudio}
                              className="app-btn-secondary"
                            >
                              Discard
                            </button>
                            <button
                              type="button"
                              onClick={() => void sendRecordedAudio()}
                              disabled={isSendingAudio || Boolean(feedback)}
                              className="app-btn-primary"
                            >
                              {isSendingAudio ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <SendHorizonal className="h-4 w-4" />
                              )}
                              Send Audio
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <textarea
                        value={messageInput}
                        onChange={(event) => setMessageInput(event.target.value)}
                        disabled={Boolean(feedback)}
                        rows={3}
                        placeholder="Type your reply in Japanese..."
                        className="app-input min-h-[84px] flex-1 disabled:bg-gray-100"
                      />
                      <button
                        type="submit"
                        disabled={isSendingMessage || !messageInput.trim() || Boolean(feedback)}
                        className="app-btn-primary self-end"
                      >
                        {isSendingMessage ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <SendHorizonal className="w-4 h-4" />
                        )}
                        Send
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {feedback && (
                <div className="app-panel p-6">
                  <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold">Conversation Review</h3>
                      <p className="text-sm text-gray-600">
                        Review what went well and what to fix next round.
                      </p>
                    </div>
                    <span className="app-badge-muted px-4 py-2 text-sm font-semibold text-slate-800">
                      Score {feedback.score_percent}%
                    </span>
                  </div>

                  {feedback.summary && (
                    <div className="app-banner mb-6">
                      {feedback.summary}
                    </div>
                  )}

                  <div className="grid xl:grid-cols-2 gap-4">
                    <div className="app-panel-muted p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Correct</h4>
                      <div className="space-y-2 text-sm text-gray-700">
                        {feedback.correct_points.length === 0 ? (
                          <div>No specific correct points were called out.</div>
                        ) : (
                          feedback.correct_points.map((item, index) => (
                            <div key={`correct-${index}`}>{item}</div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="app-panel-muted p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Incorrect</h4>
                      <div className="space-y-2 text-sm text-gray-700">
                        {feedback.incorrect_points.length === 0 ? (
                          <div>No incorrect points were called out.</div>
                        ) : (
                          feedback.incorrect_points.map((item, index) => (
                            <div key={`incorrect-${index}`}>{item}</div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="app-panel-muted p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Done Well</h4>
                      <div className="space-y-2 text-sm text-gray-700">
                        {feedback.strengths.length === 0 ? (
                          <div>No specific strengths were listed.</div>
                        ) : (
                          feedback.strengths.map((item, index) => (
                            <div key={`strength-${index}`}>{item}</div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="app-panel-muted p-4">
                      <h4 className="font-medium text-gray-900 mb-3">
                        Needs Improvement
                      </h4>
                      <div className="space-y-2 text-sm text-gray-700">
                        {[...feedback.weaknesses, ...feedback.improvements].length ===
                        0 ? (
                          <div>No improvement items were listed.</div>
                        ) : (
                          [...feedback.weaknesses, ...feedback.improvements].map(
                            (item, index) => (
                              <div key={`improve-${index}`}>{item}</div>
                            ),
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="app-empty">
              {selectedScenario
                ? 'Select "Start Conversation" to begin a Japanese back-and-forth for this scenario.'
                : 'Generate or add a conversation scenario to get started.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
