'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Hash, Loader2, Send } from 'lucide-react';
import type { BrainMessage } from '@app-starter/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ChannelPanelProps {
  messages: BrainMessage[];
  /** Employees the presenter can post as (from the IT inventory). */
  authorNames: string[];
  /** Highlights the input while the simulation waits for the live message. */
  isWaitingForLiveMessage: boolean;
  onSend: (authorName: string, text: string) => Promise<void>;
}

const DEFAULT_AUTHOR = 'Jane Doe';

/** How each message kind is labelled, so the audience can see the brain classifying. */
const KIND_LABELS: Record<BrainMessage['kind'], string | null> = {
  problem: 'problem',
  success: 'works',
  neither: null,
};

/**
 * A Slack-style #it-help channel: the messages so far, and a box to type a
 * new one as any employee (Jane Doe by default, for the live moment).
 */
export const ChannelPanel = ({
  messages,
  authorNames,
  isWaitingForLiveMessage,
  onSend,
}: ChannelPanelProps) => {
  const [authorName, setAuthorName] = useState(DEFAULT_AUTHOR);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the channel fills up, like Slack.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      await onSend(authorName, trimmed);
      setText('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section
      aria-label="#it-help channel"
      className="flex h-[70vh] min-h-[480px] flex-col rounded-lg border bg-card"
    >
      <header className="flex items-center gap-2 border-b px-4 py-3 font-medium">
        <Hash className="h-4 w-4 text-muted-foreground" aria-hidden />
        it-help
        <span className="text-sm font-normal text-muted-foreground">
          {messages.length} messages
        </span>
      </header>

      {/* role="log" tells screen readers new messages are appended here. */}
      <div role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No messages yet. Press Simulate a workday to start.
          </p>
        )}
        {messages.map((message) => (
          <ChannelMessage key={message.id} message={message} />
        ))}
        <div ref={listEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 border-t p-3">
        <Select value={authorName} onValueChange={setAuthorName}>
          <SelectTrigger className="w-40" aria-label="Post as">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {authorNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            isWaitingForLiveMessage ? 'Your turn: type the live message…' : 'Message #it-help'
          }
          aria-label="Message"
          className={cn('min-w-0 flex-1', isWaitingForLiveMessage && 'ring-2 ring-primary')}
        />
        <Button type="submit" disabled={isSending || !text.trim()} aria-label="Send message">
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </section>
  );
};

const ChannelMessage = ({ message }: { message: BrainMessage }) => {
  const kindLabel = KIND_LABELS[message.kind];

  return (
    <article className="text-sm">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold">{message.authorName}</span>
        <time dateTime={message.createdAt} className="text-xs text-muted-foreground">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
        {kindLabel && (
          <Badge
            variant={message.kind === 'problem' ? 'destructive' : 'teal'}
            className="px-1.5 py-0 text-[10px]"
          >
            {kindLabel}
          </Badge>
        )}
      </div>
      <p className="whitespace-pre-wrap">{message.text}</p>
    </article>
  );
};
