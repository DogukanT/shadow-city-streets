# Shadow City Streets

Build a REAL playable mobile web game prototype called "UNDERWORLD: CITY OF SHADOWS". This is not a static mockup. It must run in the Lovable preview and on mobile Safari.

Core loop for V0.1:
- Full-screen responsive 2D dark comic/noir gangster city.
- Start screen with PLAY.
- After PLAY, a player character is visible and can move with a large mobile virtual joystick/D-pad.
- A FIRE button lets the player shoot the nearest enemy.
- 5 enemy gangsters spawn and chase the player; bullets damage them; enemies damage the player.
- HUD: money, HP, XP, level, weapon, mission progress.
- Mission: eliminate 5 enemies. On completion give $3000 and XP.
- Weapon shop accessible from the city: Pistol free, SMG $2500, AK-47 $7500. Buying/equipping must actually change damage.
- Use Canvas or a robust DOM/game loop. Avoid dependencies that can break preview.
- Add restart after death.
- Make it optimized for iPhone portrait, touch controls large and responsive.
- No backend or fake multiplayer yet. This is a local playable prototype.
- Make sure there are no blank-screen errors and the PLAY button actually starts the game.
- Use a polished dark comic visual style, but prioritize reliable gameplay and input over decoration.
- After implementation, test the main loop in the preview and fix runtime errors.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d32ac58e-b5da-4db5-9bee-c64a458b474d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
