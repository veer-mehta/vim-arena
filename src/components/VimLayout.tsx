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
    gutterLineHeight = 24,
    bodyAlignItems = 'center'
}: VimLayoutProps) {
    return (
        <div className="page">
            <div className="vim-editor">
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
                <div className="vim-statusline" style={{ borderTop: '1px solid var(--border)', background: 'transparent', height: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <span style={{ 
                            color: 'var(--accent)', 
                            fontWeight: 'bold',
                            fontSize: '11px',
                            letterSpacing: '1.5px'
                        }}>
                            {vimMode}
                        </span>
                        <span style={{ color: 'var(--text-dim)', fontSize: '11px', fontWeight: '300' }}>{filename}</span>
                    </div>
                    <div>
                        <span style={{ color: 'var(--text-dim)' }}>{statusShortcuts}</span>
                    </div>
                </div>

                {/* ── Command line ── */}
                <div className="vim-commandline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', height: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text)', fontSize: '13px' }}>{commandBuffer || ''}</span>
                        {!commandBuffer && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>system command...</span>}
                        {commandBuffer && <div className="vim-cursor" style={{ background: 'var(--text)', width: '8px' }} />}
                    </div>
                    {cmdHint && (
                        <span style={{ color: 'var(--accent)', fontSize: '11px', opacity: 0.7, letterSpacing: '1px' }}>
                            {cmdHint}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
