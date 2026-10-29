# Compact sender form

Request: preserve all fields, make entering a wish require less manual scrolling, remove heavy form decoration and keep the navy/gold design light and fast.

## Behaviour

Only candidate details start expanded. Opening another section or choosing Next closes the previous section; summaries preserve values and completion checks. Every section remains accessible by its summary. Optional school has Skip and never blocks progress. Selecting a school advances to receiver phone. Next focuses the next input and scrolls it into view only as needed. Enter advances from candidate name to exam year, then to the next section; textareas retain multiline Enter and school suggestions keep their own keyboard behaviour. Invalid required values cannot advance through Next. Merely typing or tapping the sound control does not collapse the active editor.

All existing inputs, limits, school search, draft recovery, progress, editable wish starters, card designs, sound preference, preview and checkout are preserved. No database, provider, payment activation or package changes.

## Flat styling

Remove nested panels, section shadows, height animation, focus glow, sticky form action blur and floating preview shadows. Use a solid navy surface, thin separators, a focus outline and at least 44px targets. Compact summaries and headings replace repeated spacious blocks. The stylesheet is smaller overall.

## Verification

Synthetic checkout browser tests cover 320/360/390/412/768/1280 widths, including a 320×640 viewport, one expanded section, Next focus/visibility, keyboard Enter, optional-school skip, valid progress, flat computed styles and compact form height. Existing retry, refresh recovery, paid-ready/sent distinctions, WhatsApp/native sharing, copy and opt-in sound checks remain exercised. The full 135 Success Wishes contract tests pass.

Broader sender tests exercise directory search, all four designs, long text, field reopening, invalid values, draft restoration and clearing, private invitations and receiver return. Required exact-head CI and build checks must pass before merge. These synthetic checks do not charge M-Pesa or send SMS.

## Findings and recovery

The old form started with five expanded sections and several nested padded surfaces. Native section transitions and blur-collapse timing enlarged the editor and could conflict with rapid reopening. Exclusive explicit section navigation replaces that timing, preserving the active input until the user moves to another section. Layout assertions exposed a higher-specificity mobile padding rule; the final summary selector removes that excess padding.

Local build/browser processes initially shared generated Next output, producing missing build files. That environment evidence was rejected; subsequent browser work uses an isolated checkout and the production build uses a fresh generated directory. No gate was disabled.

Rollback: revert this UI-only change. No schema or provider rollback is required.
