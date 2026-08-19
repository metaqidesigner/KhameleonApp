---
name: Floating visual collision bounds
description: How to keep animated floating controls from visually obscuring protected UI.
---

When constraining a floating control around a protected card, calculate collisions from its complete rendered envelope, including glows, shadows, decorative layers, and maximum animation scale—not just the element's layout box.

**Why:** A high-z-index control can visually cover a card even while its nominal rectangle merely touches the card boundary.

**How to apply:** Define a conservative visual-overflow buffer in shared layout geometry, use that rectangle for safe-position decisions and tests, and preserve ordinary viewport-edge movement unless the product calls for clipping the effects there.