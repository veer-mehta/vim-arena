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
                <div className="vim-statusline">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ color: vimMode === 'NORMAL' ? '#88c0d0' : '#ebcb8b' }}>
                            -- {vimMode} --
                        </span>
                        <span style={{ color: '#d8dee9' }}>{filename}</span>
                    </div>
                    <div>
                        <span style={{ color: '#4c566a' }}>{statusShortcuts}</span>
                    </div>
                </div>

                {/* ── Command line ── */}
                <div className="vim-commandline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ color: '#d8dee9' }}>{commandBuffer || ':'}</span>
                        {commandBuffer && <div className="vim-cursor" />}
                    </div>
                    {cmdHint && (
                        <span style={{ color: '#4c566a', fontSize: '13px', fontFamily: 'monospace' }}>
                            {cmdHint}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
