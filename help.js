/* PANDEMONKS help: the (?) buttons on the team laptop.
   Every entry over-explains on purpose: what it is, what you do, what happens, and what you can do after. */

const HELP = {
  /* ---------- your turn ---------- */
  actions: (c) => ({
    title: 'Actions',
    body: `<h4>What it is</h4><p>Actions are your budget for this turn. Every team gets <b>${c.actionsPerTurn} actions</b> at the start of its turn.</p>
      <h4>What costs an action</h4><ul><li>Every move costs 1 action, plus ${c.trainCost} extra when you change office (the NS).</li><li>Putting out 1 fire, opening a War Room, meeting a deadline, trading a card, updating the dashboard and a stroopwafel break: 1 action each.</li></ul>
      <h4>What is free</h4><ul><li>Pulling an espresso (once per turn).</li><li>Playing an event card, even on another team's turn.</li><li>Discarding a card.</li></ul>
      <h4>When can you get more or fewer</h4><p>An espresso can add 0 to 4 actions. A handover, the fiscal quarter news or no internet in AMS can take some away. Covering someone else's handover gives you +${c.handoverGift}.</p>
      <h4>When they run out</h4><p>At 0 actions your action phase is over and you draw your cards. You can also stop early with <b>End turn</b>.</p>`,
  }),
  end_actions: () => ({
    title: 'End turn',
    body: `<h4>What it does</h4><p>Stops your action phase right now. Any actions you still have are lost. They do not carry over to your next turn.</p>
      <h4>What happens next</h4><p>You go straight to drawing your 2 cards. After that the crises flip and the next team is up.</p>
      <h4>When to use it</h4><p>Only when nothing useful is left to do. Even walking one room closer to the next fire is usually better than ending early.</p>`,
  }),
  draw: (c) => ({
    title: 'Drawing cards',
    body: `<h4>What you do</h4><p>Click <b>Draw 2 cards</b>. Two cards come off the project deck and show up on your laptop. The big screen only shows the backs, so the others don't see what you got.</p>
      <h4>What you can get</h4><ul><li><b>Room cards</b>: one per room. You need these for deadlines, War Rooms and some moves.</li><li><b>Event cards</b>: one-off helpers you can play any time.</li><li><b>Friday 17:00</b>: bad news. It doesn't go in your hand. It hits the board right away (see the big screen).</li></ul>
      <h4>Then</h4><p>If your hand is now above ${c.handLimit} cards you have to discard or play cards first. The crises then flip by themselves.</p>`,
  }),
  crises: (c) => ({
    title: 'The crisis step',
    body: `<h4>What it is</h4><p>The last step of every turn. Crisis cards come off the crisis inbox (the deck on the big screen). Each card names a room, and that room gets 1 new fire.</p>
      <h4>How many</h4><p>The crisis inbox row on the big screen shows how many cards flip per turn. It starts at ${c.rates[0]} and goes up every time a Friday 17:00 card shows up.</p>
      <h4>Crash cards</h4><p>Espressos hide crash cards in this deck. When one comes up, that team goes to the chair massage and skips its next turn.</p>
      <h4>Automatic</h4><p>You don't have to click anything. The crises flip as soon as nobody is above ${c.handLimit} cards.</p>`,
  }),

  /* ---------- moving ---------- */
  move: (c) => ({
    title: 'Moving around',
    body: `<h4>What it is</h4><p>Your team is the pawn with your number on the board. Most actions only work in the room you are standing in, so moving is how you get to the fires and to the War Rooms.</p>
      <h4>How you do it</h4><p>On your turn, every room you can reach <b>glows</b>. Click it and pick how you want to get there. The options you see depend on where you are and which cards you hold:</p>
      <ul><li><b>Walk over</b>: to a room joined by a corridor, the stairs or the lift. No card needed.</li><li><b>NS Intercity</b>: between the two Living Rooms, from HPark to AMS and back.</li><li><b>Send a DM</b>: discard the card of the room you want to go to.</li><li><b>Call an all-hands</b>: discard the card of the room you are in, go anywhere.</li><li><b>War Room hop</b>: from one War Room to any other War Room.</li></ul>
      <h4>Cost</h4><p>1 action per move, and ${c.trainCost} extra if you end up in the other office.</p>
      <h4>Tip</h4><p>Walking costs no cards. Every room card you spend on a move is a card you can't use for a deadline any more.</p>`,
  }),
  walk: () => ({
    title: 'Walk over',
    body: `<h4>What you do</h4><p>Move your pawn to a room that is connected to yours by a line on the board (a corridor, the stairs or the lift).</p><h4>Cost</h4><p>1 action. No card needed.</p><h4>Then</h4><p>You stand in the new room, so you can put out its fires, trade with teams there, or open a War Room there.</p>`,
  }),
  train: (c) => ({
    title: 'The NS Intercity',
    body: `<h4>What it is</h4><p>The board has two offices: HPark and AMS. The only line between them is the train between the two Living Rooms.</p>
      <h4>What it costs</h4><p>Any move that ends in the other office costs <b>1 action + ${c.trainCost} extra</b> for the train, whatever way you move (walk, DM, all-hands or hop).</p>
      <h4>No trains today</h4><p>When the "No trains" breaking news is active, nobody can change office for a whole round. Plan for it: don't leave all teams in one office.</p>`,
  }),
  direct: (c) => ({
    title: 'Send a DM and go',
    body: `<h4>What you do</h4><p>Discard the room card of the room you want to go to. Your pawn goes straight there, from anywhere on the board.</p>
      <h4>Cost</h4><p>1 action (+${c.trainCost} if it is in the other office) and that room card.</p>
      <h4>Watch out</h4><p>The card goes to the discard pile, so you can't use it for a deadline any more. Ask the others first if they need that colour.</p>`,
  }),
  allhands: (c) => ({
    title: 'Call an all-hands',
    body: `<h4>What you do</h4><p>You stand in a room and you hold <b>that room's card</b>. Discard it and you can go to <b>any</b> room on the board.</p>
      <h4>Cost</h4><p>1 action (+${c.trainCost} for the other office) and the card of the room you are in.</p>
      <h4>When to use it</h4><p>When a fire breaks out on the other side of the board and walking would take your whole turn.</p>`,
  }),
  hop: (c) => ({
    title: 'War Room hop',
    body: `<h4>What you do</h4><p>If you stand in a War Room, you can move to <b>any other War Room</b> in one go.</p>
      <h4>Cost</h4><p>1 action (+${c.trainCost} if the other War Room is in the other office). No card needed.</p>
      <h4>Why it matters</h4><p>This is the reason to spread War Rooms across the board. They turn into shortcuts for every team.</p>`,
  }),
  opsmove: () => ({
    title: 'Ops shortcut (Ops Lead only)',
    body: `<h4>What you do</h4><p>Once per turn, when you stand in a War Room, discard <b>any</b> room card and go to any room on the board.</p><h4>Cost</h4><p>1 action (+1 for the other office) and the card you pick.</p>`,
  }),
  gather: () => ({
    title: 'Pull them in (Resource Planner only)',
    body: `<h4>What you do</h4><p>Move any team's pawn to a room where another team already stands. Use the pawn buttons to pick who you move.</p><h4>Cost</h4><p>Your action, not theirs. Always ask the other team first: you plan, they decide.</p>`,
  }),
  pawn: () => ({
    title: 'Pick a pawn (Resource Planner)',
    body: `<h4>What it is</h4><p>As Resource Planner you can spend your actions to move another team as if it were your own pawn.</p><h4>How</h4><p>Click the team number here, then click a glowing room on the board. Switch back to your own number to move yourself.</p>`,
  }),

  /* ---------- in the room ---------- */
  treat: (c) => ({
    title: 'Put out a fire',
    body: `<h4>What you do</h4><p>Remove 1 fire of the colour you pick from the room you stand in.</p>
      <h4>Cost</h4><p>1 action per click.</p>
      <h4>Bonus</h4><ul><li>If the deadline of that colour is already met, one click removes <b>all</b> fires of that colour in the room.</li><li>The Producer always removes all fires of one colour with one click.</li></ul>
      <h4>Why it matters</h4><p>A room can hold 3 fires of a colour. The 4th one makes it escalate to the client and spread fires to every connected room. Rooms with 3 fires are the urgent ones.</p>`,
  }),
  fires: (c) => ({
    title: 'Fires',
    body: `<h4>What they are</h4><p>Every fire is a problem on a project. Their colour matches the zone: ${Object.values(c.colors).map((x) => `${x.name} in the ${x.zone}`).join(', ')}.</p>
      <h4>Where they come from</h4><p>Crisis cards at the end of every turn, Friday 17:00 cards, escalations and some breaking news.</p>
      <h4>The limit</h4><p>A room holds at most 3 fires of one colour. A 4th means an escalation.</p>
      <h4>The stock</h4><p>Each colour has ${c.tokensPerColor} fires in stock (shown under Deadlines on the big screen). If a colour runs out of stock, you lose.</p>`,
  }),
  escalation: (c) => ({
    title: 'Escalations',
    body: `<h4>What it is</h4><p>When a room that already has 3 fires of a colour gets one more, it escalates to the client. The 4th fire is not placed. Instead every connected room gets 1 fire of that colour.</p>
      <h4>Chain reactions</h4><p>If one of those rooms was also at 3, it escalates too. That's how one bad flip can light up half an office.</p>
      <h4>The limit</h4><p>Every escalation moves the counter on the big screen. At <b>${c.maxRageQuits}</b> the client pulls the plug and everyone loses.</p>`,
  }),
  build: (c) => ({
    title: 'Open a War Room',
    body: `<h4>What a War Room is</h4><p>A room you claim as a base for the whole group. It gets a WAR ROOM tag on the board. Fires still land there as normal.</p>
      <h4>What you do</h4><p>Stand in the room and discard <b>that room's card</b> (the Ops Lead doesn't need the card). The room becomes a War Room.</p>
      <h4>Cost</h4><p>1 action and the room card.</p>
      <h4>What you can do in a War Room afterwards</h4><ul><li><b>Meet deadlines.</b> You can only hand in deadline cards while you stand in a War Room.</li><li><b>Hop.</b> From any War Room you can move to any other War Room for 1 action.</li></ul>
      <h4>Limits</h4><p>Both Living Rooms are War Rooms from the start. There can be at most ${c.maxWarRooms} War Rooms at a time. If you open another one, you choose an existing one to close.</p>`,
  }),
  cure: (c) => ({
    title: 'Meet a deadline',
    body: `<h4>What it is</h4><p>Winning the game means meeting all four deadlines before 17:30: ${Object.values(c.colors).map((x) => `<b>${x.fix}</b> (${x.name})`).join(', ')}.</p>
      <h4>What you need</h4><ul><li>Stand in a War Room.</li><li>Hold <b>${c.fixCards} room cards of the same colour</b> (the Tech Lead needs ${c.fixCards - 1}).</li></ul>
      <h4>What you do</h4><p>Click the deadline. The cards are discarded and the deadline is met.</p><h4>Cost</h4><p>1 action.</p>
      <h4>What changes afterwards</h4><ul><li>Putting out a fire of that colour now clears all of that colour in the room at once.</li><li>The Producer clears that colour just by walking into a room, and no new fires of that colour land where the Producer stands.</li><li>If no fires of that colour are left anywhere, no new ones appear at all.</li></ul>
      <h4>Watch out</h4><p>While Thomas is stuck abroad with the approvals, no deadline can be signed off.</p>`,
  }),
  trade: (c) => ({
    title: 'Trade a card',
    body: `<h4>What it is</h4><p>The only way to get cards to the team that needs them. Collecting ${c.fixCards} cards of one colour alone is slow. Collecting them together is fast.</p>
      <h4>Rules</h4><ul><li>Both teams stand in the <b>same room</b>.</li><li>The card has to be the card of <b>that room</b>. The Account Lead can give or take any room card.</li><li>It is your action, so you need to be on turn.</li></ul>
      <h4>Give or take</h4><p><b>Give</b> sends one of your cards to them. <b>Take</b> pulls one of theirs to you. Agree on it out loud first.</p>
      <h4>Cost</h4><p>1 action. If the other team ends up above ${c.handLimit} cards, they have to discard one.</p>`,
  }),
  dashboard: (c) => ({
    title: 'Update the project dashboard',
    body: `<h4>What you do</h4><p>Click it to update your dashboard. 1 action, at most once per turn.</p>
      <h4>Why</h4><p>Do it at least once every ${c.dashboardEvery} of your own turns. If you forget, you get a <b>handover</b>: next turn your team loses ${c.handoverCost} actions and the next team gets +${c.handoverGift} to cover for you.</p>
      <h4>How to read the button</h4><p>It turns yellow on the turn you have to do it. A ✓ means it's done for this turn.</p>`,
  }),
  handover: (c) => ({
    title: 'The handover',
    body: `<h4>What happened</h4><p>Your team went ${c.dashboardEvery} turns without updating the dashboard, so another team had to cover your project.</p>
      <h4>The effect</h4><ul><li>Your next turn has ${c.handoverCost} fewer actions.</li><li>The team after you got +${c.handoverGift} right away.</li><li>The rest is lost in the status call.</li></ul>
      <h4>Avoid it</h4><p>Spend 1 action on the dashboard every other turn.</p>`,
  }),
  espresso: (c) => ({
    title: 'Pull an espresso',
    body: `<h4>What you do</h4><p>Once per turn, for free, you draw the top card of the espresso deck. You don't know which one you get.</p>
      <h4>What it does</h4><p>The card gives you <b>0 to 4 bonus actions</b> this turn. Most cards also hide <b>crash cards</b> in the crisis deck and raise your stress by the same number.</p>
      <h4>The crash</h4><p>When one of your crash cards is flipped in a crisis step, your team goes to the chair massage in the nearest pantry and <b>skips its next turn</b>. Your stress drops to 0.</p>
      <h4>The deck</h4><ul>${Object.entries(c.espresso).map(([id, e]) => `<li><b>${e[0]}</b> ×${c.espressoDeck.filter((x) => x === id).length}: +${e[1]} action${e[1] === 1 ? '' : 's'}, ${e[2]} crash card${e[2] === 1 ? '' : 's'}</li>`).join('')}</ul>
      <h4>Limit</h4><p>Once your stress is at ${c.maxStress} your hands shake too much and you can't pull one.</p>`,
  }),
  breather: () => ({
    title: 'Coffee and a stroopwafel',
    body: `<h4>Where</h4><p>Only in a pantry: the HPark Pantry or the AMS Cafeteria.</p><h4>What it does</h4><p>Your stress goes down by 1.</p><h4>Cost</h4><p>1 action.</p><h4>Why</h4><p>Lower stress means more espressos later. It's also a safe place to wait, because pantries never get fires.</p>`,
  }),
  stress: (c) => ({
    title: 'Stress',
    body: `<h4>What it is</h4><p>The cups next to your buttons. ${c.maxStress} is the maximum.</p>
      <h4>What raises it</h4><ul><li>Every crash card an espresso hides adds 1.</li><li>The lunch team failing adds 1, unless you stand in a pantry.</li></ul>
      <h4>What lowers it</h4><ul><li>A stroopwafel in a pantry: −1.</li><li>The Waffle & Barista Breakfast event: everyone to 0.</li><li>A chair massage after a crash: back to 0.</li></ul>
      <h4>Why it matters</h4><p>At ${c.maxStress} you can't pull an espresso.</p>`,
  }),
  minus: () => ({
    title: 'Timesheets',
    body: `<h4>What happened</h4><p>The fiscal quarter breaking news: everybody has to fill in timesheets.</p><h4>The effect</h4><p>Your next turn has 1 action less. After that it's gone.</p>`,
  }),
  owe: () => ({
    title: 'Hand in your hours',
    body: `<h4>What happened</h4><p>A client project was cancelled. To get paid, every team has to hand in its hours.</p><h4>What you do</h4><p>Discard 1 room card from your hand (any card). Teams without room cards are let off.</p><h4>Why it matters</h4><p>The crises can't flip until every team has done this.</p>`,
  }),
  hand: (c) => ({
    title: 'Your hand',
    body: `<h4>What it is</h4><p>Your cards. Only you see them. Describe them out loud, never turn your laptop around.</p>
      <h4>What's in it</h4><ul><li><b>Room cards</b> for deadlines, War Rooms, DMs, all-hands moves and trades.</li><li><b>Event cards</b>, free to play any time.</li></ul>
      <h4>Hand limit</h4><p>At most <b>${c.handLimit} cards</b>. If you go over (after drawing or getting a card), discard or play cards until you are back at ${c.handLimit}. The crises wait for you.</p>
      <h4>Discard</h4><p>Free, any time. The card goes to the discard pile for good.</p>`,
  }),

  /* ---------- rooms ---------- */
  'room:normal': (c) => ({
    title: 'A normal room',
    body: `<h4>What it is</h4><p>One of the 16 rooms on the board. Each belongs to a zone and gets fires of that zone's colour only.</p><h4>What you can do here</h4><ul><li>Put out its fires.</li><li>Open a War Room with this room's card.</li><li>Trade this room's card with a team in the same room.</li><li>Call an all-hands with this room's card.</li></ul>`,
  }),
  'room:warroom': (c) => ({
    title: 'War Room',
    body: `<h4>What it is</h4><p>A base the group has claimed. Fires still land here.</p><h4>What you can do here</h4><ul><li>Meet deadlines: ${c.fixCards} room cards of one colour (Tech Lead: ${c.fixCards - 1}).</li><li>Hop to any other War Room for 1 action.</li><li>Ops Lead: discard any room card to go anywhere, once per turn.</li></ul><h4>Limit</h4><p>At most ${c.maxWarRooms} War Rooms, the two Living Rooms included.</p>`,
  }),
  'room:living': (c) => ({
    title: 'Living Room',
    body: `<h4>What it is</h4><p>The heart of each office and the place where teams start. It's a War Room from the start, and the NS station to the other office.</p><h4>What you can do here</h4><ul><li>Meet deadlines.</li><li>Hop to another War Room.</li><li>Take the train to the other Living Room (1 + ${c.trainCost} actions).</li></ul><h4>Good to know</h4><p>No fires ever land here.</p>`,
  }),
  'room:pantry': () => ({
    title: 'Pantry',
    body: `<h4>What it is</h4><p>The HPark Pantry and the AMS Cafeteria. No fires ever land here.</p><h4>What you can do here</h4><ul><li>Coffee and a stroopwafel: −1 stress for 1 action.</li></ul><h4>Good to know</h4><p>Teams that crash on espresso end up here for a chair massage and skip a turn. When the lunch team fails, being here lowers your stress instead of raising it.</p>`,
  }),

  /* ---------- cards ---------- */
  'card:room': (c, arg) => {
    const r = c.rooms[arg] || {};
    const col = c.colors[r.color] || {};
    return {
      title: `Room card: ${r.name || ''}`,
      body: `<h4>What it is</h4><p>The card of <b>${r.name}</b>, in the ${col.zone} (${col.name}, colour of the deadline <b>${col.fix}</b>).</p>
        <h4>What you can use it for</h4><ul><li><b>Meet a deadline</b>: ${c.fixCards} cards of this colour in a War Room.</li><li><b>Send a DM</b>: discard it to go straight to ${r.name}.</li><li><b>All-hands</b>: if you stand in ${r.name}, discard it to go anywhere.</li><li><b>Open a War Room</b> in ${r.name}.</li><li><b>Trade</b> it with a team while you both stand in ${r.name}.</li></ul>
        <h4>Good to know</h4><p>Every use except trading discards the card. Keep cards of the colour your group is collecting.</p>`,
    };
  },
  'card:friday': (c) => ({
    title: 'Friday 17:00',
    body: `<h4>What it is</h4><p>The epidemic card. The client sends "small" feedback just before the weekend.</p><h4>What happens right away</h4><ul><li>The crisis rate goes up a step (more cards flip each turn).</li><li>The room at the bottom of the crisis deck gets 3 fires at once.</li><li>All crisis cards flipped so far are shuffled and put back on top, so rooms that burned before will burn again soon.</li></ul><h4>Good to know</h4><p>It never stays in your hand.</p>`,
  }),
  'card:event': (c, id) => {
    const e = c.events[id] || {};
    const extra = {
      pizza: 'Pick up to 2 fires anywhere on the board, in any colour. They are removed. Use it on rooms at 3 fires to stop an escalation.',
      tiramisu: 'Pick one room. Every fire in it, of every colour, is removed.',
      freelancer: 'Pick any team (yours or another) and any room. That pawn goes there at once, with no train and no actions needed. Ask the other team first.',
      holiday: 'The next crisis step is skipped completely. No crisis cards flip at the end of that turn. Best played right before a turn ends when the board is hot.',
      budget: `Pick any room and it becomes a War Room for free, with no card and no action. If there are already ${c.maxWarRooms}, you close one.`,
      dog: 'The stress of every team goes to 0, so everybody can pull espressos again.',
    }[id] || '';
    return { title: `Event: ${e.name || ''}`, body: `<h4>What it does</h4><p>${esc(e.text || '')}</p><h4>In detail</h4><p>${extra}</p><h4>How to play it</h4><p>Click <b>Play</b> on the card, any time, also during another team's turn. It costs no action. Afterwards it's discarded. It still counts toward your hand limit while you hold it.</p>` };
  },
  'card:espresso': (c) => HELP.espresso(c),
  'card:crash': () => ({ title: 'Caffeine crash', body: `<h4>What it is</h4><p>A crash card that an espresso hid in the crisis deck.</p><h4>What happens</h4><p>The team goes to the chair massage in the nearest pantry, skips its next turn and drops to 0 stress.</p>` }),
  'card:incident': () => ({ title: 'Crisis card', body: `<h4>What it is</h4><p>A card from the crisis inbox. It names a room and a very real problem.</p><h4>What happens</h4><p>That room gets 1 new fire. If it already had 3, it escalates.</p>` }),
  'card:news': (c, id) => ({ title: 'Breaking news', body: `<h4>What it is</h4><p>One breaking news card hits at the start of every round, and the Game Master can trigger one at any time.</p><h4>This one</h4><p>${esc((c.news[id] || [])[1] || '').replace('%s', 'an exotic location')}</p>` }),

  /* ---------- roles ---------- */
  role: (c, id) => {
    const r = c.roles[id] || {};
    const more = {
      producer: 'This is automatic: whenever you put out a fire, every fire of that colour in your room goes. Once a deadline is met, walking into a room clears that colour, and no new fires of that colour land where you stand.',
      techlead: `Whenever you meet a deadline in a War Room you need ${c.fixCards - 1} cards of one colour instead of ${c.fixCards}. Let the others send you cards.`,
      account: 'When you share a room with another team, you can give any of your room cards and they can take any of yours, not only the card of that room. You are the card hub.',
      planner: 'Use the pawn buttons in your action panel to pick another team, then click a room. It costs your actions. You can also move any team to a room where another team stands.',
      ops: 'Opening a War Room costs you no card. And once per turn, from a War Room, you can discard any room card to go anywhere.',
      teamlead: 'Wherever you stand, your room and every connected room are protected: no new fires, and escalations stop at the door. Park yourself next to the hottest rooms.',
    }[id] || '';
    return { title: `${r.name || 'Your role'}`, body: `<h4>Your power</h4><p>${esc(r.text || '')}</p><h4>In detail</h4><p>${more}</p><h4>Your accent</h4><p><b>${esc(r.accentName || '')}</b>. ${esc(r.talk || '')} Keep it up all game.</p>` };
  },
};

function helpBtn(key, label = 'What does this do?') {
  return `<button type="button" class="help" data-help="${esc(key)}" aria-label="${esc(label)}" title="${esc(label)}">?</button>`;
}
function helpKeyForCard(card) {
  if (card === 'friday') return 'card:friday';
  if (card.startsWith('crash:')) return 'card:crash';
  if (card.startsWith('n:')) return 'card:news|' + card.slice(2);
  if (card.startsWith('x:')) return 'card:espresso';
  if (card.startsWith('e:')) return 'card:event|' + card.slice(2);
  if (card.startsWith('r:')) return card.includes('#') ? 'card:incident' : 'card:room|' + card.slice(2);
  return 'hand';
}
function showHelp(key) {
  const [k, arg] = key.split('|');
  const fn = HELP[k];
  if (!fn || !PM.cfg) return;
  const h = fn(PM.cfg, arg);
  closeHelp();
  const bg = document.createElement('div');
  bg.id = 'helpbox';
  bg.className = 'modal-bg helpbg';
  bg.innerHTML = `<div class="modal helpmodal" role="dialog" aria-label="${esc(h.title)}"><div class="kicker">How it works</div><h2>${esc(h.title)}</h2><div class="helpbody">${h.body}</div><button class="hot" data-helpclose>Got it</button></div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.hasAttribute('data-helpclose')) closeHelp(); });
  document.body.appendChild(bg);
}
function closeHelp() { const b = document.getElementById('helpbox'); if (b) b.remove(); }
// one listener for every (?) on the page; it runs first so the button under it doesn't fire too
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-help]');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  showHelp(b.dataset.help);
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeHelp(); });
PM.help = true;
