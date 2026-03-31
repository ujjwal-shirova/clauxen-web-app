'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { MarkdownRenderer } from './markdown-renderer';
import { ThinkingBlock } from './thinking-block';
import { OrbCursor } from './ui/orb-cursor';
import type { Message } from '@/frontend/lib/types';
import { cn } from '@/frontend/lib/utils';

interface ConversationThreadProps {
  messages: Message[];
  editingMessageId: string | null;
  editValue: string;
  copiedId: string | null;
  onEditValueChange: (value: string) => void;
  onStartEdit: (message: Message) => void;
  onCancelEdit: () => void;
  onSaveEdit: (messageId: string) => void;
  onCopy: (id: string, text: string) => void;
  className?: string;
}

const RetryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.3857 2.50977C14.3486 2.71054 17.5 5.98724 17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 7.54619 3.67878 5.3677 5.49902 4H3C2.72386 4 2.5 3.77614 2.5 3.5C2.5 3.22386 2.72386 3 3 3H6.5C6.63261 3 6.75975 3.05272 6.85352 3.14648C6.92392 3.21689 6.97106 3.30611 6.99023 3.40234L7 3.5V7C7 7.27614 6.77614 7.5 6.5 7.5C6.22386 7.5 6 7.27614 6 7V4.87891C4.4782 6.06926 3.5 7.91979 3.5 10C3.5 13.5899 6.41015 16.5 10 16.5C13.5899 16.5 16.5 13.5899 16.5 10C16.5 6.5225 13.7691 3.68312 10.335 3.50879L10 3.5L9.89941 3.49023C9.67145 3.44371 9.5 3.24171 9.5 3C9.5 2.72386 9.72386 2.5 10 2.5L10.3857 2.50977Z" />
  </svg>
);

const EditPenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.72821 2.87934C10.0318 2.10869 10.9028 1.72933 11.6735 2.03266L14.4655 3.13226C15.236 3.43593 15.6145 4.30697 15.3112 5.07758L11.3903 15.0307C11.2954 15.2717 11.1394 15.4835 10.9391 15.6459L10.8513 15.7123L7.7077 17.8979C7.29581 18.1843 6.73463 17.9917 6.57294 17.5356L6.54657 17.4409L5.737 13.6987C5.67447 13.4092 5.69977 13.107 5.80829 12.8315L9.72821 2.87934ZM6.73798 13.1987C6.70201 13.2903 6.69385 13.3906 6.71454 13.4868L7.44501 16.8627L10.28 14.892L10.3376 14.8452C10.3909 14.7949 10.4325 14.7332 10.4597 14.6645L13.0974 7.96723L9.37567 6.50141L6.73798 13.1987ZM11.3073 2.96332C11.0504 2.86217 10.7601 2.98864 10.6589 3.24555L9.74188 5.57074L13.4636 7.03754L14.3806 4.71137C14.4817 4.45445 14.3552 4.16413 14.0983 4.06293L11.3073 2.96332Z" />
  </svg>
);

const CustomCopyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 3C13.3284 3 14 3.67157 14 4.5V6H15.5C16.3284 6 17 6.67157 17 7.5V15.5C17 16.3284 16.3284 17 15.5 17H7.5C6.67157 17 6 16.3284 6 15.5V14H4.5C3.67157 14 3 13.3284 3 12.5V4.5C3 3.67157 3.67157 3 4.5 3H12.5ZM14 12.5C14 13.3284 13.3284 14 12.5 14H7V15.5C7 15.7761 7.22386 16 7.5 16H15.5C15.7761 16 16 15.7761 16 15.5V7.5C16 7.22386 15.7761 7 15.5 7H14V12.5ZM4.5 4C4.22386 4 4 4.22386 4 4.5V12.5C4 12.7761 4.22386 13 4.5 13H12.5C12.7761 13 13 12.7761 13 12.5V4.5C13 4.22386 12.7761 4 12.5 4H4.5Z" />
  </svg>
);

const ThumbsUpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.56055 2C11.1381 2.00009 12.3211 3.44332 12.0117 4.99023L11.6094 7H13.8438C15.5431 7 16.836 8.52594 16.5566 10.2021L15.876 14.2842C15.6148 15.8513 14.2586 17 12.6699 17H4.5C3.67157 17 3 16.3284 3 15.5V9.23828C3.00013 8.57996 3.4294 7.99838 4.05859 7.80469L5.19824 7.4541L5.33789 7.40723C6.02983 7.15302 6.59327 6.63008 6.89746 5.9541L8.41113 2.58984L8.48047 2.46094C8.66235 2.17643 8.97898 2.00002 9.32324 2H9.56055ZM7.80957 6.36523C7.39486 7.2867 6.62674 7.99897 5.68359 8.3457L5.49219 8.41016L4.35254 8.76074C4.14305 8.82539 4.00013 9.01904 4 9.23828V15.5C4 15.7761 4.22386 16 4.5 16H12.6699C13.7697 16 14.7087 15.2049 14.8896 14.1201L15.5703 10.0381C15.7481 8.97141 14.9251 8 13.8438 8H11C10.8503 8 10.7083 7.9331 10.6133 7.81738C10.5184 7.70164 10.4805 7.54912 10.5098 7.40234L11.0312 4.79395C11.2167 3.86589 10.507 3.00009 9.56055 3H9.32324L7.80957 6.36523Z" />
  </svg>
);

const ThumbsDownIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.6699 3C14.2586 3 15.6148 4.14871 15.876 5.71582L16.5566 9.79785C16.836 11.4741 15.5431 13 13.8438 13H11.6094L12.0117 15.0098C12.3211 16.5567 11.1381 17.9999 9.56055 18H9.32324C8.97898 18 8.66235 17.8236 8.48047 17.5391L8.41113 17.4102L6.89746 14.0459C6.59327 13.3699 6.02983 12.847 5.33789 12.5928L5.19824 12.5459L4.05859 12.1953C3.4294 12.0016 3.00013 11.42 3 10.7617V4.5C3 3.67157 3.67157 3 4.5 3H12.6699ZM4.5 4C4.22386 4 4 4.22386 4 4.5V10.7617C4.00013 10.981 4.14305 11.1746 4.35254 11.2393L5.49219 11.5898L5.68359 11.6543C6.62674 12.001 7.39486 12.7133 7.80957 13.6348L9.32324 17H9.56055C10.507 16.9999 11.2167 16.1341 11.0312 15.2061L10.5098 12.5977C10.4805 12.4509 10.5184 12.2984 10.6133 12.1826C10.7083 12.0669 10.8503 12 11 12H13.8438C14.9251 12 15.7481 11.0286 15.5703 9.96191L14.8896 5.87988C14.7087 4.79508 13.7697 4 12.6699 4H4.5Z" />
  </svg>
);

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true" className="shrink-0 mt-0.5">
    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
  </svg>
);

interface MessageRowProps {
  message: Message;
  editingMessageId: string | null;
  editValue: string;
  copiedId: string | null;
  onEditValueChange: (value: string) => void;
  onStartEdit: (message: Message) => void;
  onCancelEdit: () => void;
  onSaveEdit: (messageId: string) => void;
  onCopy: (id: string, text: string) => void;
}

const MessageRow = React.memo(
  function MessageRow({
    message,
    editingMessageId,
    editValue,
    copiedId,
    onEditValueChange,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onCopy,
  }: MessageRowProps) {
    return (
      <div
        className={cn(
          'flex flex-col animate-in fade-in duration-500 group',
          message.role === 'user' ? 'items-end' : 'items-start w-full'
        )}
        style={{ contentVisibility: 'auto', containIntrinsicSize: '240px' }}
      >
        {message.role === 'user' ? (
          editingMessageId === message.id ? (
            <div className="bg-[#f0eee6] rounded-[12px] p-[10px] flex flex-col gap-2 w-full max-w-[724.8px] animate-in fade-in duration-300">
              <textarea
                className="w-full bg-white border border-[#1f1e1d]/15 rounded-[9.6px] p-3 text-[15px] resize-none outline-none focus:ring-2 focus:ring-[#1b67b2]/20 font-sans min-h-[100px]"
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                autoFocus
              />
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2 text-[12px] text-[#3d3d3a] max-w-[70%] leading-relaxed">
                  <InfoIcon />
                  <span>Editing this message will create a new conversation branch.</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={onCancelEdit} className="h-9 px-4 border border-[#1f1e1d]/30 rounded-lg text-[14px] font-medium hover:bg-black/5 transition-colors">Cancel</button>
                  <button onClick={() => onSaveEdit(message.id)} className="h-9 px-4 bg-black text-white rounded-lg text-[14px] font-medium hover:bg-black/90 transition-colors">Save</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1 w-full font-sans">
              <div className="px-4 py-2.5 rounded-[12px] max-w-[85%] bg-[#f0eee6] text-[#3d3d3a] shadow-sm relative transition-all">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</p>
              </div>
              <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8">
                <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#73726c] transition-all" title="Retry"><RetryIcon /></button>
                <button onClick={() => onStartEdit(message)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#73726c] transition-all" title="Edit"><EditPenIcon /></button>
                <button onClick={() => onCopy(message.id, message.content)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 text-[#73726c] transition-all" title="Copy">
                  {copiedId === message.id ? <Check className="w-4 h-4 text-green-600" /> : <CustomCopyIcon />}
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="w-full assistant-message text-gray-800 leading-relaxed group">
            {(message.hasThinking || (message.thinkingContent?.trim().length ?? 0) > 0) && (
              <ThinkingBlock
                content={message.thinkingContent}
                isStreaming={!!message.isThinkingStreaming}
                thinkingDurationSeconds={message.thinkingDurationSeconds}
                className="mb-4"
              />
            )}
            {message.isStreaming && message.content.trim().length === 0 && (
              <div className="flex items-center py-1">
                <OrbCursor />
              </div>
            )}
            {message.content.trim().length > 0 ? (
              <>
                <MarkdownRenderer content={message.content} isStreaming={message.isStreaming} />
                {!message.isStreaming && (
                  <div className="flex justify-start items-center gap-1 mt-3 text-[#73726c] font-sans">
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-all" title="Copy"><CustomCopyIcon /></button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-all" title="Positive feedback"><ThumbsUpIcon /></button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-all" title="Negative feedback"><ThumbsDownIcon /></button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-all" title="Retry"><RetryIcon /></button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.editingMessageId === next.editingMessageId &&
    prev.editValue === next.editValue &&
    prev.copiedId === next.copiedId &&
    prev.onEditValueChange === next.onEditValueChange &&
    prev.onStartEdit === next.onStartEdit &&
    prev.onCancelEdit === next.onCancelEdit &&
    prev.onSaveEdit === next.onSaveEdit &&
    prev.onCopy === next.onCopy
);

export function ConversationThread({
  messages,
  editingMessageId,
  editValue,
  copiedId,
  onEditValueChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onCopy,
  className,
}: ConversationThreadProps) {

  return (
    <div className={cn('flex flex-col gap-10 py-8 w-full max-w-[768px] mx-auto px-4', className)}>
      {messages.map((message) => (
        <MessageRow
          key={message.id}
          message={message}
          editingMessageId={editingMessageId}
          editValue={editValue}
          copiedId={copiedId}
          onEditValueChange={onEditValueChange}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          onSaveEdit={onSaveEdit}
          onCopy={onCopy}
        />
      ))}
    </div>
  );
}
