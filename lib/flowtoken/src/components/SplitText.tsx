import React, { useRef, useEffect, ReactElement } from 'react';

interface TokenWithSource {
  text: string;
  source: number;
  /** Per-chunk animation duration captured when the diff chunk arrived. */
  durationMs?: number;
}

type TokenType = string | TokenWithSource | ReactElement;

const TokenizedText = ({
  input,
  sep,
  animation,
  animationDuration,
  animationTimingFunction,
  animationIterationCount,
  chunkDurationMs,
}: {
  input: unknown;
  sep?: string;
  animation?: string | null;
  animationDuration?: string;
  animationTimingFunction?: string;
  animationIterationCount?: number;
  /** Rate-adaptive duration (ms) for the most recent diff chunk only. */
  chunkDurationMs?: number;
}) => {
    const prevInputRef = useRef<string>('');
    const tokensWithSources = useRef<TokenWithSource[]>([]);
    const fullTextRef = useRef<string>('');

    const tokens = React.useMemo(() => {
        if (React.isValidElement(input)) return [input];

        if (typeof input !== 'string') return null;

        if (!animation) {
          return [input];
        }

        if (sep === 'diff') {
            if (!prevInputRef.current || input.length < prevInputRef.current.length) {
                tokensWithSources.current = [];
                fullTextRef.current = '';
            }
            
            if (input !== prevInputRef.current) {
                if (input.startsWith(fullTextRef.current)) {
                    const uniqueNewContent = input.slice(fullTextRef.current.length);
                    
                    if (uniqueNewContent.length > 0) {
                        tokensWithSources.current.push({
                            text: uniqueNewContent,
                            source: tokensWithSources.current.length,
                            durationMs: chunkDurationMs,
                        });
                        
                        fullTextRef.current = input;
                    }
                } else if (fullTextRef.current.startsWith(input)) {
                    // Duplicate/out-of-order chunk already represented.
                } else {
                    tokensWithSources.current = [{
                        text: input,
                        source: 0,
                        durationMs: chunkDurationMs,
                    }];
                    fullTextRef.current = input;
                }
            }
            
            return tokensWithSources.current;
        }

        let splitRegex;
        if (sep === 'word') {
            splitRegex = /(\s+)/;
        } else if (sep === 'char') {
            splitRegex = /(.)/;
        } else {
            throw new Error('Invalid separator: must be "word", "char", or "diff"');
        }

        return input.split(splitRegex).filter(token => token.length > 0);
    }, [input, sep, animation, chunkDurationMs]);

    useEffect(() => {
        if (typeof input === 'string') {
            prevInputRef.current = input;
        }
    }, [input]);

    const isTokenWithSource = (token: TokenType): token is TokenWithSource => {
        return token !== null && typeof token === 'object' && 'text' in token && 'source' in token;
    };

    const resolvedList = tokens ?? [];

    return (
        <>
            {resolvedList.map((token, index) => {
                let key = index;
                let text = '';
                let duration = animationDuration;

                if (isTokenWithSource(token)) {
                    key = token.source;
                    text = token.text;
                    if (token.durationMs != null) {
                      duration = `${token.durationMs}ms`;
                    }
                } else if (typeof token === 'string') {
                    key = index;
                    text = token;
                } else if (React.isValidElement(token)) {
                    key = index;
                    return React.cloneElement(token, { key });
                }

                // ponytail: in diff mode only the latest chunk animates; settled
                // chunks stay static so re-renders never re-trigger fade-in.
                const isSettledDiff =
                  sep === 'diff' && index < resolvedList.length - 1;

                if (isSettledDiff || !animation) {
                  return (
                    <span
                      key={key}
                      style={{
                        whiteSpace: 'pre-wrap',
                        display: 'inline',
                      }}
                    >
                      {text}
                    </span>
                  );
                }
                
                return (
                    <span key={key} style={{
                        animationName: animation,
                        animationDuration: duration,
                        animationTimingFunction, 
                        animationIterationCount,
                        animationFillMode: 'both',
                        whiteSpace: 'pre-wrap',
                        display: 'inline',
                    }}>
                        {text}
                    </span>
                );
            })}
        </>
    );
};

export default TokenizedText;
