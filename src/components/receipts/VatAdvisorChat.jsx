import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, User, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

export default function VatAdvisorChat({ receiptId, receipt }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (expanded && !initialized && receiptId) {
      initConversation();
    }
  }, [expanded]);

  useEffect(() => {
    if (expanded) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, expanded]);

  const initConversation = async () => {
    setLoading(true);
    try {
      const conv = await base44.agents.createConversation({
        agent_name: 'fiji_vat_advisor',
        metadata: { name: `VAT Check – ${receiptId}` }
      });
      setConversation(conv);
      setInitialized(true);

      base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages(data.messages || []);
        setLoading(false);
      });

      // Build a proactive context message from the receipt fields
      const lines = [
        `Please proactively advise on the VAT treatment for this receipt (ID: ${receiptId}):`,
        receipt.supplier_name ? `- Supplier: ${receipt.supplier_name}` : '',
        receipt.supplier_tin ? `- Supplier TIN: ${receipt.supplier_tin}` : '- Supplier TIN: not provided',
        receipt.category ? `- Category: ${receipt.category.replace(/_/g, ' ')}` : '',
        receipt.vat_type ? `- VAT Type set to: ${receipt.vat_type}` : '',
        receipt.vat_rate != null ? `- VAT Rate: ${receipt.vat_rate}%` : '',
        receipt.vat_amount != null ? `- VAT Amount: ${receipt.vat_amount}` : '',
        receipt.total_amount != null ? `- Total Amount: ${receipt.total_amount}` : '',
        receipt.currency ? `- Currency: ${receipt.currency}` : '',
      ].filter(Boolean).join('\n');

      await base44.agents.addMessage(conv, { role: 'user', content: lines });
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const sendMessage = async (text) => {
    if (!conversation || !text.trim() || loading) return;
    setLoading(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: text });
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Only show user-visible messages (skip the init context message)
  const visibleMessages = messages.filter((m, i) => !(i === 0 && m.role === 'user'));

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-background overflow-hidden">
      {/* Header */}
      <button
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-primary/5 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Fiji VAT Advisor</p>
            <p className="text-xs text-muted-foreground">AI-powered VAT compliance check</p>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-primary/10">
          {/* Messages */}
          <div className="mt-3 max-h-72 overflow-y-auto space-y-3 pr-1">
            {visibleMessages.length === 0 && loading && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-card border rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {visibleMessages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div key={idx} className={cn('flex gap-2 items-start', isUser && 'justify-end')}>
                  {!isUser && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div className={cn(
                    'rounded-xl px-3 py-2 text-sm max-w-[85%]',
                    isUser ? 'bg-primary text-primary-foreground' : 'bg-card border'
                  )}>
                    {isUser ? (
                      <p>{msg.content}</p>
                    ) : (
                      <ReactMarkdown
                        className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                        components={{
                          p: ({ children }) => <p className="my-0.5 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                          li: ({ children }) => <li className="my-0">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  {isUser && (
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && visibleMessages.length > 0 && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-card border rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about Fiji VAT rules…"
              disabled={loading}
              className="text-sm h-8"
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}