'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Loader2, TrendingUp, Target, DollarSign, Minimize2, Copy, Check, RefreshCw, X, Clock, Edit2, Trash2, Sparkles, Search, Download, ThumbsUp, ThumbsDown, Share2 } from 'lucide-react';
import { API_ENDPOINTS } from '@/config/api';
import { ErrorBoundary } from './ErrorBoundary';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  id?: string;
  error?: boolean;
  retryCount?: number;
  isEditing?: boolean;
}

interface AIChatSidebarProps {
  vaultBalance: string;
  currentAPY: string;
  currentStrategy: string;
  earnings: string;
  minDeposit?: string;
  maxDeposit?: string;
  onDeposit?: (amount: string) => void;
  onWithdraw?: (amount: string) => void;
  onStrategyChange?: (strategy: number) => void;
}

export default function AIChatSidebar({ 
  vaultBalance: _vaultBalance, 
  currentAPY: _currentAPY,
  currentStrategy: _currentStrategy,
  earnings: _earnings,
  minDeposit: _minDeposit,
  maxDeposit: _maxDeposit,
  onDeposit: _onDeposit,
  onWithdraw: _onWithdraw,
  onStrategyChange: _onStrategyChange
}: AIChatSidebarProps) {
  // Props are kept for future use but currently unused
  void _vaultBalance;
  void _currentAPY;
  void _currentStrategy;
  void _earnings;
  void _minDeposit;
  void _maxDeposit;
  void _onDeposit;
  void _onWithdraw;
  void _onStrategyChange;
  const [messages, setMessages] = useState<Message[]>(() => {
    // Load messages from localStorage on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ai_chat_messages');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.map((msg: Message) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
        } catch {
          // If parsing fails, use default
        }
      }
    }
    return [{
      role: 'assistant' as const,
      content: `Hi! I'm your AI DeFi assistant powered by Attestify. 🤖\n\nI can help you:\n• Manage your vault\n• Analyze your strategy\n• Answer DeFi questions\n• Explain how Attestify works\n\nWhat would you like to know?`,
      timestamp: new Date(),
      id: `msg-${Date.now()}`,
    }];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai_chat_session_id');
    }
    return null;
  });
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('connected');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ remaining: number; resetAt: number } | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem('ai_chat_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Save session ID to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionId) {
      localStorage.setItem('ai_chat_session_id', sessionId);
    }
  }, [sessionId]);

  // Auto-scroll to bottom (only when new messages are added)
  const prevMessagesLength = useRef(messages.length);
  
  useEffect(() => {
    // Only scroll if a new message was added (not just any change)
    const hasNewMessage = messages.length > prevMessagesLength.current;
    prevMessagesLength.current = messages.length;
    
    if (hasNewMessage && !isMinimized && messagesEndRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [messages.length, isMinimized]);

  // Focus input when component mounts or when sidebar expands
  useEffect(() => {
    if (!isMinimized && !showSearch && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMinimized, showSearch]);

  // Focus search input when search is opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to clear input
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setInput('');
      }
      // Focus input with Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !isMinimized) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMinimized]);


  // Call backend API with retry logic
  const callBackendAPI = async (
    message: string, 
    retryCount = 0,
    maxRetries = 2
  ): Promise<{ message: string; session_id?: string }> => {
    try {
      setConnectionStatus('checking');
      const response = await fetch(API_ENDPOINTS.ai.chat, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          session_id: sessionId || undefined,
        }),
      });

      setConnectionStatus(response.ok ? 'connected' : 'disconnected');

      if (!response.ok) {
        const errorText = await response.text();
        let errorJson;
        try {
          errorJson = JSON.parse(errorText);
        } catch {
          // Not JSON, use raw text
        }
        
        const errorMessage = errorJson?.error || errorJson?.detail || errorText || 'Unknown error';
        
        // Retry on 5xx errors
        if (response.status >= 500 && retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return callBackendAPI(message, retryCount + 1, maxRetries);
        }
        
        throw new Error(`Backend API error (${response.status}): ${errorMessage}`);
      }

      const result = await response.json();
      setConnectionStatus('connected');
      
      // Handle rate limiting headers
      handleRateLimitHeaders(response.headers);
      
      return {
        message: result.message || 'I received your message.',
        session_id: result.session_id,
      };
    } catch (error) {
      console.error('Backend API error:', error);
      setConnectionStatus('disconnected');
      
      // Handle network/CORS errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Retry on network errors
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return callBackendAPI(message, retryCount + 1, maxRetries);
        }
        throw new Error(`Network Error: Unable to reach the backend server. Please check your connection.`);
      }
      
      // Re-throw the error so it can be handled properly
      throw error;
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const messageId = `msg-${Date.now()}`;
    const currentInput = input.trim();
    
    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: currentInput,
      timestamp: new Date(),
      id: messageId,
    };
    setMessages(prev => [...prev, userMessage]);
    
    setInput('');
    setIsLoading(true);

    // Add placeholder for AI response
    const aiMessageId = `msg-${Date.now() + 1}`;
    const placeholderMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      id: aiMessageId,
    };
    setMessages(prev => [...prev, placeholderMessage]);

    try {
      // Call backend API (Attestify Django backend with Gemini)
      const backendResponse = await callBackendAPI(currentInput);
      
      const response = backendResponse.message;
      
      // Update session ID if provided
      if (backendResponse.session_id && !sessionId) {
        setSessionId(backendResponse.session_id);
      }

      // Update the placeholder message with actual response
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: response, error: false }
          : msg
      ));
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Show user-friendly error message
      let errorMessage = 'Sorry, I encountered an error. ';
      
      if (error instanceof Error) {
        if (error.message.includes('Network Error')) {
          errorMessage = '🌐 Connection Error: Unable to reach the server. Please check your internet connection and try again.';
        } else if (error.message.includes('500')) {
          errorMessage = '⚠️ Server Error: The backend is experiencing issues. Please try again in a moment.';
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'Please try again later.';
      }
      
      // Update placeholder with error
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: errorMessage, error: true, retryCount: 0 }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    // Find the user message that preceded this error
    let originalUserMessage = '';
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        originalUserMessage = messages[i].content;
        break;
      }
    }
    
    if (!originalUserMessage) return;

    const message = messages[messageIndex];
    const retryCount = (message.retryCount || 0) + 1;
    
    // Update message to show retrying
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: 'Retrying...', error: false, retryCount }
        : msg
    ));

    setIsLoading(true);

    try {
      const backendResponse = await callBackendAPI(originalUserMessage, 0, 1);
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: backendResponse.message, error: false }
          : msg
      ));
    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: error instanceof Error ? error.message : 'Retry failed. Please try again.', error: true, retryCount }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleClearConversation = () => {
    if (confirm('Are you sure you want to clear all messages?')) {
      const welcomeMessage: Message = {
        role: 'assistant',
        content: `Hi! I'm your AI DeFi assistant powered by Attestify. 🤖\n\nI can help you:\n• Manage your vault\n• Analyze your strategy\n• Answer DeFi questions\n• Explain how Attestify works\n\nWhat would you like to know?`,
        timestamp: new Date(),
        id: `msg-${Date.now()}`,
      };
      setMessages([welcomeMessage]);
      setSessionId(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ai_chat_messages');
        localStorage.removeItem('ai_chat_session_id');
      }
    }
  };

  const handleEditMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || message.role !== 'user') return;
    
    setEditingMessageId(messageId);
    setEditContent(message.content);
    
    // Focus the textarea after state update
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.setSelectionRange(
        editInputRef.current.value.length,
        editInputRef.current.value.length
      );
    }, 0);
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) {
      setEditingMessageId(null);
      return;
    }

    // Update the message
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: editContent.trim(), isEditing: false }
        : msg
    ));

    setEditingMessageId(null);
    setEditContent('');

    // Regenerate AI response if this was the last user message
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      // Find the next assistant message and regenerate it
      const nextAssistantIndex = messageIndex + 1;
      if (nextAssistantIndex < messages.length && messages[nextAssistantIndex].role === 'assistant') {
        const assistantMessageId = messages[nextAssistantIndex].id;
        if (assistantMessageId) {
          // Delete the old assistant response and regenerate
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
          setIsLoading(true);
          
          try {
            const backendResponse = await callBackendAPI(editContent.trim());
            const newAssistantMessage: Message = {
              role: 'assistant',
              content: backendResponse.message,
              timestamp: new Date(),
              id: `msg-${Date.now()}`,
            };
            setMessages(prev => {
              const index = prev.findIndex(m => m.id === messageId);
              return [...prev.slice(0, index + 1), newAssistantMessage, ...prev.slice(index + 1)];
            });
          } catch (error) {
            console.error('Error regenerating response:', error);
          } finally {
            setIsLoading(false);
          }
        }
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleDeleteMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    if (confirm(`Are you sure you want to delete this ${message.role} message?`)) {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    }
  };

  // Highlight search terms in text (returns JSX)
  const highlightSearch = (text: string, query: string): React.ReactElement => {
    if (!query.trim()) {
      return <span>{text}</span>;
    }
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <span>
        {parts.map((part, index) => {
          if (regex.test(part)) {
            return <mark key={index} className="bg-yellow-200 rounded px-0.5">{part}</mark>;
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  // Simple markdown renderer
  const renderMarkdown = (text: string) => {
    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/);
    
    return parts.map((part, index) => {
      // Code blocks
      if (part.startsWith('```')) {
        const code = part.replace(/```[\w]*\n?/, '').replace(/```$/, '');
        const language = part.match(/```(\w+)/)?.[1] || '';
        return (
          <pre key={index} className="bg-gray-800 text-gray-100 p-3 rounded-lg overflow-x-auto my-2 text-xs">
            <code className={`language-${language}`}>{code}</code>
          </pre>
        );
      }
      
      // Inline code
      if (part.startsWith('`') && part.endsWith('`')) {
        const code = part.slice(1, -1);
        return (
          <code key={index} className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">
            {code}
          </code>
        );
      }
      
      // Regular text with markdown formatting
      let processed = part;
      
      // Bold **text**
      processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      
      // Italic *text*
      processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');
      
      // Links [text](url)
      processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>');
      
      // Headers
      processed = processed.replace(/^### (.+)$/gm, '<h3 class="font-bold text-base mt-4 mb-2">$1</h3>');
      processed = processed.replace(/^## (.+)$/gm, '<h2 class="font-bold text-lg mt-4 mb-2">$1</h2>');
      processed = processed.replace(/^# (.+)$/gm, '<h1 class="font-bold text-xl mt-4 mb-2">$1</h1>');
      
      // Lists
      processed = processed.replace(/^\- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
      processed = processed.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
      
      // Line breaks
      processed = processed.replace(/\n\n/g, '</p><p class="my-2">');
      processed = processed.replace(/\n/g, '<br />');
      
      return (
        <p 
          key={index} 
          className="whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: processed }}
        />
      );
    });
  };

  // Filter messages by search query
  const filteredMessages = searchQuery.trim()
    ? messages.filter(msg => 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  // Handle message reaction
  const handleReaction = (messageId: string, reaction: 'like' | 'dislike') => {
    setMessageReactions(prev => {
      const current = prev[messageId];
      if (current === reaction) {
        // Toggle off if clicking same reaction
        const updated = { ...prev };
        delete updated[messageId];
        return updated;
      }
      return { ...prev, [messageId]: reaction };
    });
  };

  // Export conversation
  const handleExportConversation = () => {
    const conversationText = messages
      .map(msg => {
        const time = msg.timestamp.toLocaleString();
        const role = msg.role === 'user' ? 'You' : 'AI Assistant';
        return `[${time}] ${role}:\n${msg.content}\n`;
      })
      .join('\n---\n\n');

    const blob = new Blob([conversationText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attestify-chat-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Share conversation
  const handleShareConversation = async () => {
    const conversationText = messages
      .map(msg => {
        const role = msg.role === 'user' ? 'You' : 'AI Assistant';
        return `${role}: ${msg.content}`;
      })
      .join('\n\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Attestify AI Chat Conversation',
          text: conversationText,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(conversationText);
      alert('Conversation copied to clipboard!');
    }
  };

  // Handle rate limiting from response headers
  const handleRateLimitHeaders = (headers: Headers) => {
    const remaining = headers.get('X-RateLimit-Remaining');
    const resetAt = headers.get('X-RateLimit-Reset');
    
    if (remaining && resetAt) {
      setRateLimitInfo({
        remaining: parseInt(remaining, 10),
        resetAt: parseInt(resetAt, 10) * 1000, // Convert to milliseconds
      });
    }
  };

  const handleRegenerate = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    // Find the user message that preceded this assistant message
    let originalUserMessage = '';
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        originalUserMessage = messages[i].content;
        break;
      }
    }
    
    if (!originalUserMessage) return;

    // Update message to show regenerating
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: 'Regenerating...', error: false }
        : msg
    ));

    setIsLoading(true);

    try {
      const backendResponse = await callBackendAPI(originalUserMessage, 0, 1);
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: backendResponse.message, error: false }
          : msg
      ));
    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: error instanceof Error ? error.message : 'Regeneration failed. Please try again.', error: true }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (question: string) => {
    setInput(question);
    // Trigger submit after a brief delay
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 100);
  };

  if (isMinimized) {
    return (
      <div className="w-16 bg-white border-l border-gray-200 flex flex-col items-center justify-center">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all flex flex-col items-center gap-1 touch-manipulation"
          title="Expand AI Assistant"
          aria-label="Expand AI Assistant"
        >
          <Bot className="h-5 w-5" />
          <span className="text-xs font-medium">AI</span>
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="w-full md:w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="h-8 w-8 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">AI Assistant</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-gray-600">Ask me anything</p>
              <div className="flex items-center gap-1">
                <div className={`h-1.5 w-1.5 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' :
                  connectionStatus === 'disconnected' ? 'bg-red-500' :
                  'bg-yellow-500 animate-pulse'
                }`} />
                <span className="text-xs text-gray-500">
                  {connectionStatus === 'connected' ? 'Online' :
                   connectionStatus === 'disconnected' ? 'Offline' :
                   'Checking...'}
                </span>
              </div>
              {rateLimitInfo && rateLimitInfo.remaining < 10 && (
                <span className="text-xs text-yellow-600">
                  {rateLimitInfo.remaining} requests left
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors touch-manipulation"
            title="Search messages"
            aria-label="Search messages"
          >
            <Search className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={handleExportConversation}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors touch-manipulation"
            title="Export conversation"
            aria-label="Export conversation"
          >
            <Download className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={handleShareConversation}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors touch-manipulation"
            title="Share conversation"
            aria-label="Share conversation"
          >
            <Share2 className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={handleClearConversation}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors touch-manipulation"
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors touch-manipulation"
            title="Minimize"
            aria-label="Minimize chat"
          >
            <Minimize2 className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="p-3 border-b border-gray-200 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-gray-500 mt-2">
              Found {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
        {filteredMessages.length === 0 && searchQuery ? (
          <div className="text-center py-8 text-gray-500">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No messages found matching &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          filteredMessages.map((message, index) => {
          const isUser = message.role === 'user';
          const isError = message.error;
          const isCopied = copiedMessageId === message.id;
          const isEditing = editingMessageId === message.id;
          const timeStr = message.timestamp.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });

          return (
            <div
              key={message.id || index}
              className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'} group`}
            >
              {!isUser && (
                <div className="h-6 w-6 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div className={`flex flex-col max-w-[85%] md:max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-lg p-3 relative ${
                    isUser
                      ? 'bg-green-600 text-white'
                      : isError
                      ? 'bg-red-50 border border-red-200 text-red-900'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {isEditing && isUser ? (
                    <div className="space-y-2">
                      <textarea
                        ref={editInputRef}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                        rows={3}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            handleSaveEdit(message.id || '');
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleCancelEdit}
                          className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(message.id || '')}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : message.content ? (
                    <div className="text-sm leading-relaxed break-words">
                      {searchQuery ? (
                        <p className="whitespace-pre-wrap">{highlightSearch(message.content, searchQuery)}</p>
                      ) : (
                        renderMarkdown(message.content)
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm">Thinking...</span>
                    </div>
                  )}
                  
                  {/* Message actions - visible on hover or touch */}
                  <div className={`absolute -right-9 md:-right-8 top-2 flex gap-1 opacity-0 md:group-hover:opacity-100 transition-opacity touch-manipulation ${isUser ? 'flex-row-reverse' : ''} md:block`}>
                    {message.content && !isLoading && !isEditing && (
                      <div className="flex flex-col gap-1 bg-white rounded-lg shadow-lg p-1 border border-gray-200">
                        <button
                          onClick={() => handleCopyMessage(message.content, message.id || '')}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors touch-manipulation"
                          title="Copy message"
                          aria-label="Copy message"
                        >
                          {isCopied ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-gray-600" />
                          )}
                        </button>
                        {isUser && (
                          <>
                            <button
                              onClick={() => handleEditMessage(message.id || '')}
                              className="p-1.5 hover:bg-gray-100 rounded transition-colors touch-manipulation"
                              title="Edit message"
                              aria-label="Edit message"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-gray-600" />
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(message.id || '')}
                              className="p-1.5 hover:bg-red-50 rounded transition-colors touch-manipulation"
                              title="Delete message"
                              aria-label="Delete message"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            </button>
                          </>
                        )}
                        {!isUser && !isError && (
                          <button
                            onClick={() => handleRegenerate(message.id || '')}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors touch-manipulation"
                            title="Regenerate response"
                            aria-label="Regenerate response"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-gray-600" />
                          </button>
                        )}
                        {isError && (
                          <button
                            onClick={() => handleRetry(message.id || '')}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors touch-manipulation"
                            title="Retry"
                            aria-label="Retry message"
                          >
                            <RefreshCw className="h-3.5 w-3.5 text-gray-600" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeStr}
                  </span>
                  {!isUser && message.content && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleReaction(message.id || '', 'like')}
                        className={`p-1 rounded transition-colors touch-manipulation ${
                          messageReactions[message.id || ''] === 'like'
                            ? 'bg-green-100 text-green-600'
                            : 'hover:bg-gray-100 text-gray-400'
                        }`}
                        title="Like this response"
                        aria-label="Like this response"
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleReaction(message.id || '', 'dislike')}
                        className={`p-1 rounded transition-colors touch-manipulation ${
                          messageReactions[message.id || ''] === 'dislike'
                            ? 'bg-red-100 text-red-600'
                            : 'hover:bg-gray-100 text-gray-400'
                        }`}
                        title="Dislike this response"
                        aria-label="Dislike this response"
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }))}
        
        {isLoading && messages[messages.length - 1]?.content && (
          <div className="flex justify-start gap-2">
            <div className="h-6 w-6 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-gray-600">AI is typing...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSubmit} className="flex gap-2 mb-2 md:mb-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 md:py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm text-gray-900 placeholder-gray-500 disabled:bg-gray-100 disabled:cursor-not-allowed touch-manipulation"
            aria-label="Chat input"
            aria-describedby="input-help"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3 md:px-4 py-2 md:py-2.5 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center touch-manipulation min-w-[44px] min-h-[44px] justify-center"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
        <p id="input-help" className="text-xs text-gray-500 mb-2 hidden md:block">
          Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Enter</kbd> to send, 
          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs ml-1">Esc</kbd> to clear
        </p>
        
        {/* Quick Actions */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600 hidden md:block">Quick actions:</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleQuickAction('What\'s my balance?')}
              className="px-2 md:px-2.5 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100 active:bg-gray-200 transition-all touch-manipulation min-h-[36px]"
              aria-label="Ask about balance"
            >
              <DollarSign className="h-3 w-3 inline mr-1" />
              <span className="hidden sm:inline">Balance</span>
            </button>
            <button
              onClick={() => handleQuickAction('How is my performance?')}
              className="px-2 md:px-2.5 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100 active:bg-gray-200 transition-all touch-manipulation min-h-[36px]"
              aria-label="Ask about performance"
            >
              <TrendingUp className="h-3 w-3 inline mr-1" />
              <span className="hidden sm:inline">Performance</span>
            </button>
            <button
              onClick={() => handleQuickAction('Should I change strategy?')}
              className="px-2 md:px-2.5 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100 active:bg-gray-200 transition-all touch-manipulation min-h-[36px]"
              aria-label="Ask about strategy"
            >
              <Target className="h-3 w-3 inline mr-1" />
              <span className="hidden sm:inline">Strategy</span>
            </button>
          </div>
        </div>

      </div>
    </div>
    </ErrorBoundary>
  );
}

