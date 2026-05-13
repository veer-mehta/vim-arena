import React, { ReactNode } from 'react';

interface VimLayoutProps {
    children: ReactNode;
    gutterLines: number;
    vimMode: string;
    commandBuffer: string;
    cmdHint?: string;
    filename: string;
    statusShortcuts: string;
    bodyRef?: React.Ref<HTMLDivElement>;
    gutterLineHeight?: number;
    bodyAlignItems?: string;
    transparentBg?: boolean;
}

export function VimLayout({
    children,
    gutterLines,
    vimMode,
    commandBuffer,
    cmdHint,
    filename,
    statusShortcuts,
    bodyRef,
    gutterLineHeight = 28,
    bodyAlignItems = 'center',
    transparentBg = false
}: VimLayoutProps) {
    const isCommand = vimMode === 'COMMAND' || vimMode === 'SEARCH';
    const modeColor = isCommand ? 'var(--yellow)' : 'var(--accent)';

    return (
        <div className="page" style={transparentBg ? { background: 'transparent' } : {}}>
            <div className="vim-editor" style={transparentBg ? { background: 'transparent' } : {}}>
                {/* ── Gutter ── */}
                <div className="vim-main">
                    <div className="vim-gutter">
                        {Array.from({ length: gutterLines }).map((_, i) => (
                            <div key={i} style={{ height: `${gutterLineHeight}px`, lineHeight: `${gutterLineHeight}px` }}>{i + 1}</div>
                        ))}
                    </div>

                    {/* ── Body ── */}
                    <div ref={bodyRef} className="vim-body" style={{ padding: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: bodyAlignItems }}>
                        {children}
                    </div>
                </div>

                {/* ── Status bar ── */}
                <div className="vim-statusline" style={{ 
                    height: '32px', 
                    padding: 0, 
                    display: 'flex', 
                    alignItems: 'stretch', 
                    borderTop: '1px solid var(--border)',
                    boxShadow: 'none'
                }}>
                    <div style={{ 
                        background: modeColor, 
                        color: 'var(--bg)', 
                        padding: '0 16px', 
                        display: 'flex', 
                        alignItems: 'center',
                        fontFamily: '"Press Start 2P", monospace',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        letterSpacing: '1px'
                    }}>
                        {vimMode}
                    </div>
                    <div style={{ 
                        background: 'var(--bg-alt)', 
                        padding: '0 16px', 
                        display: 'flex', 
                        alignItems: 'center',
                        fontSize: '11px',
                        color: 'var(--text)',
                        borderRight: '1px solid var(--border)'
                    }}>
                        {filename}
                    </div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px' }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '10px', letterSpacing: '1px' }}>{statusShortcuts}</span>
                    </div>
                </div>

                {/* ── Command line ── */}
                <div className="vim-commandline" style={{ 
                    height: '36px', 
                    background: 'var(--bg-panel)',
                    padding: '0 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                            color: 'var(--text)', 
                            fontSize: '14px', 
                            fontFamily: 'monospace',
                            fontWeight: '500'
                        }}>
                            {commandBuffer || ''}
                        </span>
                        {!commandBuffer && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', opacity: 0.5 }}>
                                enter command...
                            </span>
                        )}
                        {commandBuffer && <div className="vim-cursor" style={{ background: 'var(--text)', width: '8px', height: '18px' }} />}
                    </div>
                    {cmdHint && (
                        <div style={{ 
                            background: 'rgba(255,255,255,0.05)', 
                            padding: '4px 10px', 
                            borderRadius: '2px',
                            border: '1px solid var(--border)'
                        }}>
                            <span style={{ color: modeColor, fontSize: '10px', fontFamily: '"Press Start 2P", monospace' }}>
                                {cmdHint}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
