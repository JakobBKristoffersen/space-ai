### UI Guidelines — Chakra UI v3 (MANDATORY)

This project MUST use Chakra UI v3 for all UI components and layout. Do not introduce other UI kits or CSS frameworks.

#### Why Chakra UI v3
- Mature, accessible component primitives
- Composable styling via props (no bespoke CSS needed)
- Dark-mode first; theming fits the project’s dark canvas aesthetic

#### Version policy
- Required major version: 3.x
- Package: `@chakra-ui/react@^3`
- Motion provider: `framer-motion`
- Style engine: `@emotion/react`, `@emotion/styled`

If you need a component not in Chakra, build it with Chakra primitives (`Box`, `Flex`, `Grid`, etc.). Avoid hand-written CSS where Chakra props suffice.

#### Project usage rules
- Wrap the app in `ChakraProvider` with a dark initial color mode.
- Prefer layout primitives: `Flex`, `Grid`, `HStack`, `VStack`, `Stack`.
- Use semantic Chakra components: `Heading`, `Text`, `Button`, `Card`, `Stat`, `Badge`, `Divider`.
- Keep DOM ids used by the scripting/rendering logic intact when migrating layouts: `#installed`, `#parts`, `#metrics`, `#game`, `#reset`, `#engineOn`, `#engineOff`, `#money`, `#massValue`, `#script`, `#compile`.
- Do not mix simulation or physics code inside React components. The React layer is a view shell only.

#### Styling conventions
- Prefer props (`bg`, `color`, `borderColor`, `rounded`, `shadow`) over CSS.
- Font sizing: `sm` for dense lists; `xs` for meta; `md` for section titles.
- Spacing: use Chakra space scale; avoid pixel literals unless necessary.
- Colors: use `gray.*` scale for panels and borders; `blue/green/red` for CTA accents.

#### Accessibility
- Use `aria-*` and `VisuallyHidden` where appropriate.
- Buttons must have discernible text or `aria-label` (e.g., icon buttons).

#### Performance
- Avoid high-frequency state updates; heavy updates (physics) remain outside React.
- Throttle metrics rendering in imperative code (already implemented ~5 Hz).

#### Testing notes
- UI should render with no rocket/simulation to allow isolated UI testing.
