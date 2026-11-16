# PANDEMONKS · Go-Live!

A co-op game for the Interactive NL PM meeting. It's 09:00 at HPark and AMS, and the site goes live at 17:30, right before the borrel. Four teams put out fires across both offices and meet four deadlines before go-live.

## Install

1. Upload this folder to any PHP 8 server.
2. Make sure PHP can write to the `data/` folder (`chmod 775 data`). There is no database and no build step, and the fonts are bundled in `fonts/`.
3. To try it locally, run `php -S 0.0.0.0:8080` in this folder and open `http://localhost:8080`.

## Screens

| Who | Page |
|---|---|
| Big screen | `screen.html`: board, office clock (09:00 to 17:30), escalations, deadlines, breaking news, teams, handovers, a fake #nl-monk-news feed, full-screen reveals |
| Team laptop | `team.html?team=1` (to 4): a (?) next to every action, card, room and role explains it in detail; join (tick AMS to start in the AMS Living Room), hidden hand, role, stress, dashboard, actions |
| Game Master | `gm.html`: how-to-play slides, sound on/off, computer speed (also during the game), start, difficulty, Human/CPU per team, test mode, pause, +5 min, undo, fire any breaking news card, fix fires by hand |

## Before you start: how to play

1. Put `screen.html` on the big screen and click it once so the browser allows sound.
2. In `gm.html`, click **Explain the game on the big screen**. Every team laptop switches to "Eyes up! Look at the big screen".
3. Go through the 12 slides (two of them show the big screen and the team laptop with numbered callouts) with **Next** and **Back** (arrow keys work too).
4. On the last slide, **Let's go!** closes the slides, starts the clock and deals the cards.

During the game, **Show the rules again** pauses the clock and opens the slides; **Back to the game** resumes it.

Sound is subtle most of the time: footsteps, the NS chime, card flicks. It gets tense when it should: an alarm on every escalation, a ticking clock in the last 5 minutes (louder in the last minute) and a heartbeat once you hit 4 escalations.

## Rules in short

- **Board:** two offices.
  - HPark: work floor (Deadline slip) and meeting rooms (Client escalation).
  - AMS: work floor (Limited resources) and meeting rooms (Scope creep).
  - Each office has a Living Room (War Room, start) and a pantry.
- **Turn:** 4 actions, then draw 2 cards (they pop up on your own laptop). The crisis cards flip by themselves once nobody is over the hand limit.
- **End of turn on the big screen:** first what the team did, then the new crises on the same screen. After that it shrinks into a bar at the bottom of the board and stays there until the next team does something.
- **The NS:** any move that changes office costs 1 extra action. "No trains today" blocks it.
- **Escalations:** a 4th fire in a room escalates to the client and spreads to every connected room. After 6 escalations the client pulls the plug.
- **Deadlines:** meet one with 3 room cards of one colour, in a War Room. The Tech Lead needs only 2. The four deadlines are the Sprint Demo, the Client Sign-off, the Staffing Plan and the Scope Freeze.
- **Accents:** every role comes with an accent the team keeps up all game: French, Dutch, very British, extremely American, Italian or Russian.
- **Breaking news:** one card at the start of every round, and the Game Master can fire any card at any time.
  - Defensie account hacked
  - Saudi client project cancelled: hand in hours
  - Thomas stuck abroad: no deadline signed off this round
  - Sir Martin Q&A: everyone to AMS
  - No internet in AMS
  - No trains
  - Lunch team failed: crackers and cheese
  - Fiscal quarter: timesheets
  - Launch date mix-up: 5 minutes off the clock
- **The handover:** update the project dashboard (1 action) at least every other turn. If you forget, your team loses 2 actions on its next turn and the next team gets +1 right away to cover. Tune it with `handoverCost` and `handoverGift`.
- **Espresso:** once per turn, for 0 to 4 bonus actions. It hides crash cards in the crisis deck, and a crash sends you to a chair massage in the pantry so you skip a turn. Matcha never crashes.
- **Win:** People's Lovie Winner.
- **Lose:** 6 escalations, a colour runs out of fires, or 17:30 arrives.

## Tuning

Everything is in `config()` at the top of `api.php`:

- rooms and crisis texts
- breaking news texts
- Thomas's exotic locations
- train cost
- handover cost and gift
- dashboard rule
- cards per deadline
- accents
- escalation limit
- computer speed

## Notes

- There's no security on purpose. Take it offline after the meeting.
- In simulations, four computer teams that never trade cards win about 25 to 40% within 24 turns (they still forget the dashboard now and then). Use 4 Friday cards for normal, 5 for hard.
