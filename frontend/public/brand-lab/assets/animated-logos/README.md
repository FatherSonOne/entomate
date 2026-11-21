# Entomate logo loading animations

17 self-contained animated SVGs. Each embeds its illustrated PNG and adds native SVG animation to ring textures, circuit signals, or ribbon highlights. The artwork is raster; motion overlays are vector. Default duration is six seconds. Reduced-motion users see the original still artwork.

Use inline SVG when you need pause/play control, and call pauseAnimations()/unpauseAnimations() on the root SVG. Pause offscreen with IntersectionObserver and when the document is hidden. The public comparison lab demonstrates this behavior. The application loading screen cycles through all 17 directions, choosing once per full app load.
