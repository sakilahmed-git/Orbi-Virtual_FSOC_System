# ORBI Cinematic Experience — Full Redesign & Delivery Plan

**Status:** Implementation contract  
**Target branch:** `cinematic-fsoc-intro`  
**Primary files:** `web/src/components/SpaceEntryTransition.tsx`, `web/src/app/premium.css`, landing-page CTA, Mission Control route/scene.

## 1. Objective

Replace the current broken intro with a coherent, premium, technically credible FSOC story that flows into the real Mission Control dashboard. This is a composition and transition redesign, not another layer of animation CSS.

The current failure modes to solve are poor visual hierarchy, low-visibility elements, overlapping text/scene, conflicting CSS/keyframes, unrelated camera movements, abrupt or unblended theme changes, and unreliable timing/route handoff.

**Order of work:** meaning → static composition → visibility → timeline → scene continuity → polish → verification.

## 2. Product story

Orbi is a virtual free-space optical communication (FSOC) tracking/reliability system. A narrow optical beam must stay aligned between moving platforms. Relative motion, vibration, turbulence, and pointing error can degrade alignment. The operational workflow is to acquire the target, track continuously, observe degradation, and support reacquisition/recovery.

**Core promise:** “Orbi helps acquire, track, and recover a fragile optical link under disturbance.”

Never fabricate live telemetry, AI confidence, link-loss percentages, success rates, or autonomous recovery claims. If an action is illustrative or planned rather than implemented, label it accordingly.

## 3. Art direction — Lunar Precision

- **Landing:** bright editorial neutrals, dark readable typography, restrained teal accent, generous spacing.
- **Transition:** a continuous shift from the landing’s light atmosphere through blue-grey horizon into deep space. No black flash, unrelated opaque overlay, or abrupt palette swap.
- **Mission Control:** deep graphite, restrained cyan/teal for optical signal, amber for degradation/caution, red only for real critical states.
- **Typography:** existing Manrope/DM Sans for headlines and DM Mono for small technical metadata. Avoid all-caps everywhere and excessive tracking.
- **Depth:** scale, perspective, parallax, occlusion, and a low orbital horizon—not stacks of neon glow.
- **Motion:** deliberate camera paths, smooth easing, no jitter, no competing zooms, no constant decorative motion.
- **Glass:** subtle on panels only. Keep the optical scene clear.

### Hierarchy contract

At every moment, visual priority is: **(1) one main message, (2) satellite-to-satellite beam, (3) one supporting sentence, (4) small stage metadata, (5) decoration.** Important text must never overlap a satellite, beam, horizon highlight, or busy background. Use a controlled gradient/text-safe zone when necessary.

## 4. Target storyboard (8–10 seconds maximum)

### Shot 0 — Landing (before click)
- Clear value proposition and one dominant “Open workspace” CTA.
- Simple optical-scene preview.
- No visible transition overlay before activation.

### Shot 1 — Commit (0.0–0.6 s)
- CTA presses subtly; viewport begins a continuous push and color/exposure shift.
- Small kicker: `ORBI / FREE-SPACE OPTICAL COMMUNICATION`.
- Lock repeated clicks. Do not hide the page with a sudden opaque black layer.

### Shot 2 — Orbital reveal (0.6–2.2 s)
- Low horizon resolves into deep space.
- Transmitter satellite occupies the left third; receiver is smaller/farther in the right third.
- A clean optical path visibly connects their apertures.
- Headline: **“A beam. Two moving satellites.”**
- Support: “The receiver must stay aligned as the platforms move.”
- Reveal with opacity and restrained movement. Do not make the user wait through a long character-by-character sentence.

### Shot 3 — Failure mode (2.2–4.3 s)
- One deliberate camera push toward the optical path, followed by a controlled drift toward the receiver.
- Introduce a small, legible pointing offset; make the beam/receiver misalignment understandable.
- Headline: **“Motion can break the link.”**
- Support: “Vibration, turbulence and pointing error challenge continuous alignment.”
- If the simulation cannot represent the physics meaningfully, use an explanatory visual rather than fake physics or fake metrics.

### Shot 4 — Orbi response (4.3–6.3 s)
- Show a concise sequence: `ACQUIRE → TRACK → DETECT DEGRADATION → REACQUIRE`.
- One state active at a time; no spinning rings or HUD clutter.
- Headline: **“Acquire. Track. Recover.”**
- Support: “Observe degradation. Test recovery. Measure reliability.”
- Treat this as illustrative unless the running system truly performs each step. Do not imply a live AI recovery occurred if it did not.

### Shot 5 — Handoff (6.3–7.8 s)
- Pull back from the optical scene into the dashboard’s real central visualization.
- Preserve horizon, satellite direction, beam angle, scale, and light source where possible.
- Mount/prepare Mission Control early enough to avoid a blank interval.
- Fade only the intro-specific overlay; match the dashboard background before removing it.
- If exact scene continuity is impossible, use a controlled 250–450 ms cross-dissolve with matched framing/color—not a hard cut between unrelated compositions.

### Shot 6 — Mission Control ready (7.8–10.0 s)
- Real dashboard navigation, scene, panels, and controls are visible and interactive.
- Stagger panel groups by roughly 60–100 ms; no bouncing and no simultaneous animation of every card/number/icon.
- Do not hold a cinematic overlay over working controls.
- If the dashboard is ready sooner, shorten the handoff; never delay the product just to fill time.

## 5. Composition rules

### Desktop
- Headline uses about 35–42% of viewport width, placed in a low-detail region.
- Satellites occupy opposite thirds; beam is the clearest connection.
- Horizon sits in the lower quarter/third, not behind the headline.
- Labels sit near their spacecraft but outside the text block.
- Minimum safe margin around critical elements: 24 px.

### Tablet
- Keep satellite relationship legible; reduce labels before shrinking the headline.
- Prevent the receiver and headline from competing for the same space.

### Mobile
- Re-compose instead of scaling desktop down.
- Satellites and beam remain visible in the upper half.
- Headline sits in a lower text-safe zone with a dark gradient/backing.
- Hide secondary labels if needed, never the key satellites/beam.
- Test 320, 375, and 430 px widths plus landscape. No horizontal overflow.

## 6. Motion and state architecture

Use **one timeline owner** in `SpaceEntryTransition.tsx`. React owns phase/stage; CSS styles those stages but must not invent a second independent timeline.

- Define named stages with explicit transitions.
- Clear timers on route change, cancellation, and unmount.
- Stage changes must not restart long-running background animations.
- Do not use CSS animation completion as the route-navigation mechanism.
- Avoid duplicated state that can disagree about the current shot.
- Animate primarily `transform` and `opacity`; do not use margins to simulate camera motion.
- No opposing transforms on the same element in the same shot.
- Use `will-change` only while actively animating.
- Respect `prefers-reduced-motion`: navigate directly or use a very short fade.
- Make complete accessible copy available immediately; mark decorative visuals `aria-hidden` and avoid repetitive screen-reader typewriter announcements.
- Restore focus/interaction after the overlay exits.

### Target timing

| Time | Stage | Primary action |
|---|---|---|
| 0.0–0.6 s | Commit | CTA response, scene begins shifting |
| 0.6–2.2 s | Reveal | Horizon, satellite pair, beam resolve |
| 2.2–4.3 s | Failure | Visible illustrative misalignment |
| 4.3–6.3 s | Response | Acquire/track/reacquire narrative |
| 6.3–7.8 s | Handoff | Camera/scene aligns with Mission Control |
| 7.8–10.0 s | Ready | Dashboard panels enter; controls work |

These are targets, not mandatory waits. Never keep users staring at a blank or frozen screen.

## 7. Engineering audit before implementation

Inspect:
- `web/src/components/SpaceEntryTransition.tsx`
- `web/src/app/premium.css`
- Landing component and primary CTA
- Layout/provider where `SpaceEntryTransition` is mounted
- Mission Control route, scene component, and scene initialization
- Existing `orbi:cinematic-entry` event and session-storage flag

Trace CTA → transition → router → dashboard mount → 3D scene initialization. Document all existing timers, listeners, stage classes, keyframes, and storage flags.

### CSS cleanup is mandatory
Do not append another override block. Consolidate the transition rules into one clearly labeled section, remove obsolete/contradictory selectors and unused keyframes, and ensure each animation has one source of truth. Existing experimental overrides must be audited rather than blindly preserved.

### Route and event reliability
- Handle same-route clicks and repeated CTA activation.
- Guarantee one navigation per activation.
- Determine whether the session flag is still needed; document who sets, reads, and clears it.
- Avoid stale flags replaying the intro on unrelated visits.
- Ensure the 3D scene handles events regardless of whether it mounts before or after dispatch.
- Remove event listeners and timers reliably.
- Keep the actual dashboard and controls intact; do not substitute a screenshot or mock interface.

## 8. Phased execution plan

### Phase A — Audit and baseline
- [ ] Read the complete transition component and all transition CSS.
- [ ] Trace route, event, session flag, and scene initialization.
- [ ] Identify duplicate selectors, competing keyframes, timer races, and stale state.
- [ ] Run the current build and record baseline errors.
- [ ] Capture current desktop and mobile behavior.
**Deliverable:** root-cause audit, not another patch.

### Phase B — Static composition first
- [ ] Establish transmitter, receiver, optical path, horizon, and a safe text zone.
- [ ] Turn motion off and validate all key frames.
- [ ] Confirm the full story reads in order and all essential elements remain visible.
- [ ] Compose mobile intentionally.
**Gate:** no animation polish until the still frames work.

### Phase C — Timeline and camera
- [ ] Implement the named shot sequence under one timeline owner.
- [ ] Build one continuous light-to-space exposure/color transition.
- [ ] Add one intentional camera move per shot.
- [ ] Add a legible, honest illustration of misalignment and recovery.
- [ ] Align final scene framing with the real dashboard.
**Gate:** story must make sense muted and without reading tiny labels.

### Phase D — Clean dashboard handoff
- [ ] Prepare/mount the destination scene early enough to avoid blank time.
- [ ] Match scene framing, horizon, background, and beam direction.
- [ ] Dissolve only intro elements while preserving scene continuity.
- [ ] Verify direct dashboard visits and repeated entries.
- [ ] Remove stale flags, timers, and listeners.
**Gate:** no black/white flash, layout jump, duplicated scene, or visible camera restart.

### Phase E — Polish and accessibility
- [ ] Tune type scale, contrast, line lengths, spacing, labels, and panel entrance.
- [ ] Test reduced-motion and keyboard activation.
- [ ] Check safe areas, text wrapping, and 320 px width.
- [ ] Check performance on a typical laptop/integrated GPU.

### Phase F — Verify and deliver
- [ ] Run `npm run build` from `web/`.
- [ ] Run lint/type-check scripts available in `web/package.json`.
- [ ] Start the app and record a complete CTA-to-dashboard run.
- [ ] Inspect the recording frame-by-frame for hierarchy, visibility, jumps, and timing.
- [ ] Fix observed issues and record again.
- [ ] Update PR notes with what was tested and what remains unverified.
- [ ] Do not merge until the acceptance criteria below pass.

## 9. Test matrix

| Test | Expected result |
|---|---|
| 1920×1080 desktop | Both satellites and beam visible; no text collision |
| 1366×768 desktop | Headline and scene fit without clipping |
| 768×1024 tablet | Intentional reflow, not squeezed desktop |
| 390×844 mobile | Satellite pair, beam, headline legible |
| 320 px mobile | No horizontal overflow; copy remains readable |
| Reduced motion | Direct navigation or short fade |
| Slow dashboard load | No blank/frozen handoff |
| Fast dashboard load | No unnecessary wait |
| Repeated CTA | One timeline and one navigation |
| Direct dashboard visit | No stale intro replay |
| Navigate away/back | Timers/listeners/session flags cleaned |
| Production build | No TypeScript, JSX, CSS/import or build errors |

## 10. Acceptance checklist

The work is not done until all are true:

- [ ] I can identify transmitter and receiver within one second.
- [ ] The optical beam is visible and its purpose is clear.
- [ ] Headline is dominant; support copy is clearly secondary.
- [ ] No essential text disappears into bright/busy background.
- [ ] Failure mode is visually understandable without fake telemetry.
- [ ] The story explains FSOC/Orbi rather than generic rocket-launch drama.
- [ ] Camera movement feels spatially continuous, not like unrelated CSS zooms.
- [ ] Light-to-dark transition is gradual and controlled.
- [ ] Mission Control arrives in a matching visual space rather than restarting abruptly.
- [ ] The dashboard becomes interactive immediately.
- [ ] Mobile composition is deliberate.
- [ ] Reduced-motion behavior is respected.
- [ ] Production build/type checks pass.
- [ ] A fresh end-to-end recording has been inspected and passes.

## 11. Non-negotiable working rules

1. Fix hierarchy before effects.
2. Fix still frames before motion.
3. One timeline owner and one definition per animation.
4. Consolidate CSS; do not stack more overrides.
5. Never invent telemetry or overstate implemented AI capabilities.
6. Do not merge based on code review alone; inspect the real browser output.
7. The deliverable is a verified working experience, not a branch with new CSS.

## 12. Final deliverables

- A coherent FSOC narrative: satellite pair, beam, disturbance, and recovery intent.
- A clean light-to-space transition that blends into the actual Mission Control scene.
- Maintainable transition component and consolidated CSS.
- Responsive desktop/mobile layouts and reduced-motion support.
- Passing production build/type checks.
- Reviewed end-to-end recording.
- PR notes that accurately state what was changed and verified.


---

## 13. Creative direction upgrade — “Cross the Light”

This section supersedes any interpretation of the plan as merely a clean, restrained UI transition. The experience must be **boldly cinematic and memorable**, while remaining visually controlled and technically credible.

### Emotional target

The viewer should feel a shift from the familiar world into an extraordinary orbital mission. The sequence should feel like a premium science-fiction title sequence directed around a real engineering problem—not a dashboard loading animation.

Aim for:
- Monumental scale and a sense of distance.
- One unmistakable visual subject at a time.
- Camera motion with anticipation, acceleration, reveal, and a controlled landing.
- Optical light as a narrative device: a tiny, precise beam in an immense environment.
- A seamless reveal of Mission Control as the destination of the same journey.

### New cinematic beat sheet

**Beat 1 — The world falls away**
- The landing page does not simply fade to black.
- The camera pushes toward the optical scene; the landing’s bright surfaces stretch subtly with perspective and dissolve into an atmospheric horizon.
- Typography becomes a deliberate title card, not a slow paragraph typed over clutter.
- A single deep-space sound cue may be used only if the product has an intentional, user-initiated audio design. The experience must still work perfectly muted and must never autoplay unexpected audio.

**Beat 2 — Vastness reveal**
- The camera emerges above the planetary limb into a large, dark orbital field.
- The horizon curves across the lower frame; atmospheric light rolls gently along it.
- Stars have depth and restrained parallax rather than all streaking in the same way.
- Hold a brief, quiet reveal before showing the satellites. The contrast between vast space and tiny spacecraft creates scale.
- Use a controlled camera move, not a pile of overlays.

**Beat 3 — Satellite fly-by**
- Reveal the near satellite in silhouette, then let a narrow rim light pick out its structure and solar panels.
- The camera passes slightly to one side of it, establishing foreground depth.
- Reveal the distant receiver in the opposite side of the frame, with clear separation and a credible sense of distance.
- Do not use flat CSS rectangles as if they were photorealistic 3D models. If the actual 3D engine can render the spacecraft, use that scene; if not, use a deliberately stylized diagram rather than pretending it is a realistic render.

**Beat 4 — The beam**
- The optical beam should not be a permanent glowing line. First show the transmitter aperture aligning; then a small, precise pulse travels through space and the beam resolves toward the receiver.
- Keep the beam narrow and crisp with a restrained atmospheric halo. The surrounding scene remains dark enough for the beam to read instantly.
- The beam is the hero visual. Labels and HUD decorations fade back while it locks.
- The pulse must visually travel along the actual beam direction, not move independently at an unrelated angle.

**Beat 5 — The danger**
- A disturbance introduces a subtle change in the pointing direction; the beam slips away from the receiver aperture.
- The environment briefly becomes quieter and more still. The viewer sees the failure before reading the copy.
- A short headline appears: **“A fraction of a degree can mean silence.”**
- Supporting line: “Motion and pointing error can break a free-space optical link.”
- Use this as a conceptual statement, not as a quantified claim about every FSOC system.

**Beat 6 — Orbi responds**
- A controlled tracking reticle or guidance path indicates the receiver’s position.
- Show the workflow in three clear states: **ACQUIRE → TRACK → RECOVER**. Use restrained sequential emphasis; do not cover the spacecraft with spinning rings or fake analytics.
- The beam returns to alignment as an illustrative recovery sequence. Never present this animation as live autonomous behavior unless that functionality is genuinely running.
- Headline: **“Find the signal. Hold the link.”**
- Supporting line: “Orbi makes acquisition, disturbance and recovery observable and testable.”

**Beat 7 — Fly through the beam**
- The camera follows the light path toward the receiver. The beam expands in perspective as the camera approaches, becoming a clean luminous plane/portal-like transition—not a random lens flare.
- For a brief instant, the frame is filled by the optical light. This is the transition bridge.
- The light resolves into the real central scene in Mission Control, matching direction, color, horizon, and camera framing.
- The dashboard should feel revealed from inside the same world, not pasted on after an animation.

**Beat 8 — Mission Control lands**
- Camera motion decelerates into a stable view of the actual dashboard scene.
- Navigation and data panels enter from purposeful directions, as if the interface is assembling around the scene. Keep the movement small and staggered.
- The primary 3D scene stays the hero; panels do not overwhelm it.
- All controls become usable as soon as the handoff completes.
- End on a clean, stable interface—not an endless animated title card.

### Cinematic craft rules

- Build the experience around **one continuous camera intention**: approach → reveal → inspect → follow the beam → pass through light → settle in Mission Control.
- Give every shot a clear focal point and visual rest. Spectacle needs contrast and quiet moments to feel spectacular.
- Use depth and lighting before adding text overlays. The scene should still be compelling with the text hidden.
- Keep headlines short, large, and placed in intentionally empty space. Never put a large title on top of a satellite or optical beam.
- Use lens bloom sparingly and only at the beam/aperture. Avoid a global glow filter over the whole viewport.
- Use cinematic easing: anticipation before acceleration, controlled momentum through the move, then a confident deceleration into the dashboard.
- Keep the optical beam geometrically connected to the two endpoints. A detached line or unrelated moving pulse breaks the illusion.
- Do not simulate a realistic 3D camera using conflicting transforms on many independent DOM elements. Prefer the actual scene camera where available; otherwise create a small number of coordinated compositing layers.
- The title sequence must be visually impressive without sound and understandable without reading every label.
- Do not trade readability, performance, accessibility, or working dashboard controls for spectacle.

### Visual quality bar

A shot fails review if it looks like a generic CSS animation, if the camera movement has no motivated subject, if text is unreadable, if the beam does not connect the satellites, or if the dashboard appears through an unrelated hard cut.

The desired result is not “more effects.” It is a designed sequence with **scale, anticipation, reveal, tension, light, resolution, and continuity**.
