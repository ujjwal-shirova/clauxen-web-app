import React, { useRef, useEffect, ReactElement } from 'react';

interface TokenWithSource {
  text: string;
  source: number;
}

type TokenType = string | TokenWithSource | ReactElement;

const TokenizedText = ({ input, sep, animation, animationDuration, animationTimingFunction, animationIterationCount }: any) => {
    // Track previous input to detect changes
    const prevInputRef = useRef<string>('');
    // Track tokens with their source for proper keying in diff mode
    const tokensWithSources = useRef<TokenWithSource[]>([]);
    
    // For detecting and handling duplicated content
    const fullTextRef = useRef<string>('');

    const tokens = React.useMemo(() => {
        if (React.isValidElement(input)) return [input];

        if (typeof input !== 'string') return null;

        // For diff mode, keep previously rendered text stable and animate only
        // new appended chunks. If the stream rewrites/reorders content, reset
        // cleanly so repeated phrases do not duplicate or disappear.
        if (sep === 'diff') {
            // If this is the first render or we've gone backward, reset everything
            if (!prevInputRef.current || input.length < prevInputRef.current.length) {
                tokensWithSources.current = [];
                fullTextRef.current = '';
            }
            
            // Only process input if it's different from previous
            if (input !== prevInputRef.current) {
                if (input.startsWith(fullTextRef.current)) {
                    const uniqueNewContent = input.slice(fullTextRef.current.length);
                    
                    // Only add if there's actual new content
                    if (uniqueNewContent.length > 0) {
                        tokensWithSources.current.push({
                            text: uniqueNewContent,
                            source: tokensWithSources.current.length
                        });
                        
                        // Update our full text tracking
                        fullTextRef.current = input;
                    }
                } else if (fullTextRef.current.startsWith(input)) {
                    // Duplicate/out-of-order chunk that is already represented.
                } else {
                    // Input changed in a non-append way. Reset the diff cache.
                    tokensWithSources.current = [{
                        text: input,
                        source: 0
                    }];
                    fullTextRef.current = input;
                }
            }
            
            // Return the tokensWithSources directly
            return tokensWithSources.current;
        }

        // Original word/char splitting logic
        let splitRegex;
        if (sep === 'word') {
            splitRegex = /(\s+)/;
        } else if (sep === 'char') {
            splitRegex = /(.)/;
        } else {
            throw new Error('Invalid separator: must be "word", "char", or "diff"');
        }

        return input.split(splitRegex).filter(token => token.length > 0);
    }, [input, sep]);

    // Update previous input after processing
    useEffect(() => {
        if (typeof input === 'string') {
            prevInputRef.current = input;
        }
    }, [input]);

    // Helper function to check if token is a TokenWithSource type
    const isTokenWithSource = (token: TokenType): token is TokenWithSource => {
        return token !== null && typeof token === 'object' && 'text' in token && 'source' in token;
    };

    return (
        <>
            {tokens?.map((token, index) => {
                // Determine the key and text based on token type
                let key = index;
                let text = '';

                if (isTokenWithSource(token)) {
                    key = token.source;
                    text = token.text;
                } else if (typeof token === 'string') {
                    key = index;
                    text = token;
                } else if (React.isValidElement(token)) {
                    key = index;
                    text = '';
                    return React.cloneElement(token, { key });
                }
                
                return (
                    <span key={key} style={{
                        animationName: animation,
                        animationDuration,
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