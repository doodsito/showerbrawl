# Super Mustache — Maduro

Generated with the built-in imagegen tool, using the existing Maduro sprite as an identity and style reference. The generated transparent atlas is used unchanged; the renderer selects four measured source regions.

- Runtime atlas: `client/public/sprites/maduro_mustache_v1.png`
- UI icon: `client/public/sprites/maduro_mustache.svg`
- Wind-up: 0.55 s. Flight: fixed heading, 380 units maximum, 700 units/s.
- First enemy only: 34 damage and a super impulse that can cause a ring-out.
- Miss or obstacle: 0.8 s vulnerable recovery. Hit: 0.35 s recovery.
- Shields, spawn protection and nap block the strike. Stuns and incoming impulses interrupt it.
- Host and phone use the same authoritative phase and generated poses.

## Exact generation prompt

Use case: stylized-concept. Asset type: transparent PNG sprite sheet for an existing pixel-art fighting game. Reference image: the attached Maduro sprite is the identity and style reference. Create exactly FOUR separate full-body poses of this same stocky moustached, gray-black-haired caricature, preserving his recognisable face and chunky 16-bit pixel art outlines. He is now Super Mustache: navy presidential suit and Venezuelan diagonal sash retained, bright blue superhero cape, comically oversized GOLDEN METAL RIGHT FIST. Layout: square sheet, exactly 2 columns by 2 rows of equal cells, one isolated pose centered in each cell, generous transparent gutters, nothing overlaps another cell. Top left: standing heroic puffed chest, feet planted, bent knees, gold fist drawn back, blue cape unfurling to his left. Top right: flying horizontally to the RIGHT, enormous gold fist extended ahead to the right, head clearly visible behind fist, legs and blue cape trail to the left. Bottom left: successful upward UPPERCUT facing right, gold fist above and to right of head, one knee lifted, curved blue cape left, dynamic but complete body. Bottom right: comic FAILED landing, sprawled FACE DOWN horizontally facing right, gold fist stretched out ahead, moustached face turned partly toward camera, rumpled cape and legs behind on left. All four are the exact same character and outfit, full silhouettes uncut, hard crisp pixel edges and limited palette. Genuine transparent background with alpha; no checkerboard drawing, no floor, no shadow, no text, no labels, no grid lines, no scenery, no other characters, no glows outside silhouettes. Output a game-ready sprite sheet.
