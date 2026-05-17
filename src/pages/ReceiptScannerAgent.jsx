import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScanLine, Send, Paperclip, Bot, User, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

export default function ReceiptScannerAgent() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: 'receipt_scanner',
        metadata: { name: 'Receipt Scanning Session' }
      });
      setConversation(conv);

      const unsubscribe = base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages || []);
        setLoading(false);
      });

      // Send initial greeting trigger
      await base44.agents.addMessage(conv, {
        role: 'user',
        content: 'Hello, I want to scan a receipt.'
      });
      setLoading(true);

      return () => unsubscribe();
    } catch (e) {
      console.error(e);
    } finally {
      setInitializing(false);
    }
  };

  const sendMessage = async (text, fileUrls) => {
    if (!conversation || (!text.trim() && !fileUrls?.length)) return;
    setLoading(true);
    const msg = { role: 'user', content: text };
    if (fileUrls?.length) msg.file_urls = fileUrls;
    await base44.agents.addMessage(conversation, msg);
    setInput('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await sendMessage('Here is my receipt photo:', [file_url]);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
    e.target.value = '';
  };

  const handleSend = () => {
    sendMessage(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground">Starting receipt scanner...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shadow-sm">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <ScanLine className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm">Receipt Scanner</p>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <p className="text-xs text-muted-foreground">AI Assistant</p>
            </div>
          </div>
        </div>
        <Badge variant="secondary" className="ml-auto text-xs">
          Powered by AI
        </Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={idx} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={cn('max-w-[80%] space-y-2', isUser && 'flex flex-col items-end')}>
                {msg.file_urls?.map((url, i) => (
                  <img key={i} src={url} alt="Receipt" className="rounded-xl max-w-[200px] border shadow" />
                ))}
                {msg.content && (
                  <div className={cn(
                    'rounded-2xl px-4 py-2.5 text-sm',
                    isUser
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border'
                  )}>
                    {isUser ? (
                      <p>{msg.content}</p>
                    ) : (
                      <ReactMarkdown
                        className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                        components={{
                          p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                          ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                          li: ({ children }) => <li className="my-0.5">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                )}
              </div>
              {isUser && (
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-secondary-foreground" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 pb-4 pt-2 border-t bg-card">
        <div className="flex gap-2 items-end">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            size="icon"
            className="flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="Upload receipt photo"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or upload a receipt photo..."
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          📎 Click the paperclip to upload a receipt photo directly
        </p>
      </div>
    </div>
  );
}