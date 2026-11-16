<?php
/*
 * PANDEMONKS · Go-Live!
 * One-file game engine. All rules live here; the browser screens only display
 * state and send actions. State is stored in data/state.json.
 *
 * GET  api.php?a=config            static game config
 * GET  api.php?a=state&since=V     full state, or {same:true} when nothing changed
 *                                  (also lets computer teams take their next step)
 * POST api.php?a=act  {team, type, ...params}
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const DATA_DIR = __DIR__ . '/data';
const STATE_FILE = DATA_DIR . '/state.json';
const LOCK_FILE = DATA_DIR . '/state.lock';
const HISTORY_MAX = 40;

class GameError extends Exception {}

/* ================================================================== config */

function config(): array {
    static $c = null;
    if ($c !== null) return $c;

    // the four crisis colours, one per zone
    $colors = [
        'deadline'  => ['name' => 'Deadline slip',     'zone' => 'HPark work floor',    'token' => 'fire', 'fix' => 'The Sprint Demo',     'hex' => '#22D3EE', 'shape' => 'circle'],
        'client'    => ['name' => 'Client escalation', 'zone' => 'HPark meeting rooms', 'token' => 'fire', 'fix' => 'The Client Sign-off', 'hex' => '#FF2E88', 'shape' => 'square'],
        'resources' => ['name' => 'Limited resources', 'zone' => 'AMS work floor',      'token' => 'fire', 'fix' => 'The Staffing Plan',  'hex' => '#FF6B35', 'shape' => 'diamond'],
        'scope'     => ['name' => 'Scope creep',       'zone' => 'AMS meeting rooms',   'token' => 'fire', 'fix' => 'The Scope Freeze',   'hex' => '#FFD400', 'shape' => 'triangle'],
    ];

    // id => [name, colour|null (special), office, x, y, crisis texts]
    $defs = [
        'pm'      => ['PM Corner',            'deadline',  'hil', 160, 210, ['Timesheets are due. All of them.', 'Project is not in the dashboard. Again.']],
        'dev'     => ['Dev Side',             'deadline',  'hil', 410, 210, ['Urgent PHP patch: every site needs checking', 'It works on my machine']],
        'qa'      => ['QA Corner',            'deadline',  'hil', 160, 360, ['The bug only happens on the client\'s iPad', 'Client tested it on a 2014 laptop']],
        'coffee'  => ['Coffee Corner',        'deadline',  'hil', 410, 360, ['Coffee machine is broken. Again.', 'Someone finished the oat milk and said nothing']],
        'dojo'    => ['Deadline Dojo',        'client',    'hil', 160, 590, ['Client CEO wants the logo bigger', 'The deadline moved forward. Again.']],
        'ninja'   => ['Ninja Safe House',     'client',    'hil', 410, 590, ['Last-minute UX change: the menu moves to the left', '"Can we see three more options?"']],
        'samurai' => ['Samurai Suite',        'client',    'hil', 160, 740, ['Client printed the site, marked it up with a pen and scanned it back', 'Feedback arrives as a 47-reply email chain']],
        'lotus'   => ['Lotus Lair',           'client',    'hil', 410, 740, ['The hybrid call has no working mic', 'A stakeholder nobody has met joins the final review']],
        'studio'  => ['Studio',               'resources', 'ams', 1190, 210, ['The shoot needs a drone permit by tomorrow', 'The only person who knows the CMS is on holiday']],
        'exp2'    => ['Experience Desks 2F',  'resources', 'ams', 1440, 210, ['Client cannot copy from Figma with Viewer access', 'WebGL crashes on Safari']],
        'cm2'     => ['Client Management 2F', 'resources', 'ams', 1190, 360, ['"Can it pop a bit more?"', 'The budget was approved in the wrong currency']],
        'silent3' => ['Silent Workspace 3F',  'resources', 'ams', 1440, 360, ['The silent floor is not silent', 'Four laptops left at reception, one of them is yours']],
        'r11'     => ['1.1 Boardroom',        'scope',     'ams', 1190, 590, ['Legal wants to review the confetti', 'Pitch deck v12_FINAL_final2.pptx']],
        'r26'     => ['2.6 Boardroom',        'scope',     'ams', 1440, 590, ['Client wants the logo bigger. And bolder.', 'The board wants "an AI angle"']],
        'r33'     => ['3.3 Meeting Room',     'scope',     'ams', 1190, 740, ['Last-minute UX change: add a carousel', 'Client wants the homepage in green']],
        'r24'     => ['2.4 Meeting Room',     'scope',     'ams', 1440, 740, ['Dust set off the fire alarm', 'The lift is broken and the delivery goes to the 5th floor']],
        'hlive'   => ['HPark Living Room',    null,        'hil', 660, 265, []],
        'hpantry' => ['HPark Pantry',         null,        'hil', 660, 665, []],
        'alive'   => ['AMS Living Room',      null,        'ams', 940, 265, []],
        'acafe'   => ['AMS Cafeteria',        null,        'ams', 940, 665, []],
    ];
    $rooms = [];
    foreach ($defs as $id => [$name, $col, $office, $x, $y, $crises]) {
        $rooms[$id] = ['id' => $id, 'name' => $name, 'color' => $col, 'office' => $office, 'x' => $x, 'y' => $y, 'crises' => $crises, 'special' => $col === null, 'pantry' => in_array($id, ['hpantry', 'acafe'], true)];
    }

    $links = [
        ['pm', 'dev', ''], ['qa', 'coffee', ''], ['pm', 'qa', ''], ['dev', 'coffee', ''],
        ['dojo', 'ninja', ''], ['samurai', 'lotus', ''], ['dojo', 'samurai', ''], ['ninja', 'lotus', ''],
        ['studio', 'exp2', ''], ['cm2', 'silent3', ''], ['studio', 'cm2', ''], ['exp2', 'silent3', ''],
        ['r11', 'r26', ''], ['r33', 'r24', ''], ['r11', 'r33', ''], ['r26', 'r24', ''],
        ['dev', 'hlive', ''], ['coffee', 'hlive', ''], ['ninja', 'hpantry', ''], ['lotus', 'hpantry', ''],
        ['studio', 'alive', ''], ['cm2', 'alive', ''], ['r11', 'acafe', ''], ['r33', 'acafe', ''],
        ['hlive', 'hpantry', 'Stairs'], ['alive', 'acafe', 'Lift'],
        ['coffee', 'ninja', 'Stairs'], ['silent3', 'r26', 'Lift'],
        ['hlive', 'alive', 'NS Intercity'],
    ];

    $roles = [
        'producer' => ['name' => 'The Producer',         'tag' => 'Clears the floor', 'text' => 'Put out a fire removes every fire of one colour in your room. Once its deadline is met, you clear that colour just by being there.', 'accent' => 'FR', 'accentName' => 'French accent', 'talk' => 'Speak with a French accent. Every plan is magnifique, every fire is a catastrophe.'],
        'techlead' => ['name' => 'The Tech Lead',        'tag' => 'Ships it early',   'text' => 'You meet a deadline with 2 matching room cards instead of 3.', 'accent' => 'NL', 'accentName' => 'Dutch accent', 'talk' => 'Speak with a heavy Dutch accent. Be very direct. Use Dunglish: that is not my cup of tea, we have to take the bull by the horns.'],
        'account'  => ['name' => 'The Account Lead',     'tag' => 'Connects people',  'text' => 'When sharing in the same room you may give any room card, and other teams may take any room card from you.', 'accent' => 'UK', 'accentName' => 'Very British', 'talk' => 'Be terribly British. Apologise before every suggestion and call everything a bit of a pickle.'],
        'planner'  => ['name' => 'The Resource Planner', 'tag' => 'Moves the team',   'text' => 'Spend your actions moving another team as if it were yours, or move any team to a room where another team stands. Ask first.', 'accent' => 'US', 'accentName' => 'Extremely American', 'talk' => 'Be extremely American. Everything is awesome, huge, a total game changer. High fives are allowed.'],
        'ops'      => ['name' => 'The Ops Lead',         'tag' => 'Builds the base',  'text' => 'Open a War Room without discarding a card. Once per turn, from a War Room, discard any room card to go anywhere.', 'accent' => 'IT', 'accentName' => 'Italian accent', 'talk' => 'Speak with an Italian accent. Hands included. Every problem is mamma mia.'],
        'teamlead' => ['name' => 'The Client Partner',   'tag' => 'Keeps the peace',  'text' => 'No fires land in your room or in any room connected to it. Escalations stop at your door too.', 'accent' => 'RU', 'accentName' => 'Russian accent', 'talk' => 'Speak with a heavy Russian accent. Very serious. No smiling. Fires do not scare you.'],
    ];

    $events = [
        'pizza'      => ['name' => 'Birthday Bonbons',     'text' => 'Someone had a birthday. Remove up to 2 fires anywhere.'],
        'tiramisu'   => ['name' => 'Tiramisu Party',       'text' => 'Remove every fire in one room.'],
        'freelancer' => ['name' => 'Freelancer Rescue',    'text' => 'Move any team to any room. No train needed.'],
        'holiday'    => ['name' => 'Client on Holiday',    'text' => 'Skip the next crisis step.'],
        'budget'     => ['name' => 'Budget Approved',      'text' => 'Open a War Room in any room for free.'],
        'dog'        => ['name' => 'Waffle & Barista Breakfast', 'text' => 'Every team drops to 0 stress.'],
    ];

    // breaking news: one flips at the start of every round
    $news = [
        'defensie'   => ['Defensie account hacked', 'Urgent attention required. Dev Side takes 2 fires.'],
        'saudi'      => ['Client project is not launching anymore', 'Get all hours in and clear the exact effort to get paid. Every team discards 1 room card.'],
        'thomas'     => ['No first class seats left', 'Thomas is stuck in %s with all the approvals. No deadline can be signed off this round.'],
        'martin'     => ['Impromptu Q&A with Sir Martin', 'All teams are needed in AMS. Everyone moves to the AMS Living Room right now.'],
        'nointernet' => ['No internet in AMS', 'Teams that start their turn in AMS get 1 action less this round.'],
        'notrains'   => ['No trains between AMS and HIL today', 'Nobody can change office this round.'],
        'lunch'      => ['The lunch team failed to make lunch', 'Raid the pantries for leftover crackers and cheese. Every team gets +1 stress, except teams in a pantry, who drop 1.'],
        'fiscal'     => ['Fiscal quarter is here', 'All efforts on the timesheets. Every team has 1 action less on its next turn.'],
        'launch'     => ['US and NL got the launch date mixed up', 'The site goes live 12 November instead of 11 December. 5 minutes come off the clock.'],
    ];
    $thomasPlaces = ['Baku', 'Istanbul', 'Los Angeles', 'a Doha transit lounge', 'Reykjavik', 'a Bora Bora layover'];

    // espresso deck: id => [name, extra actions, crash cards, line]
    $espresso = [
        'single' => ['Single Shot',      1, 1, 'A quick one. Barely counts.'],
        'double' => ['Double Shot',      2, 1, 'Now we are talking.'],
        'triple' => ['Triple Ristretto', 3, 2, 'You can hear colours.'],
        'matcha' => ['Matcha Latte',     1, 0, 'Matcha lovers, we have got you covered.'],
        'decaf'  => ['Decaf (sabotage)', 0, 0, 'Someone swapped the beans. Nothing happens.'],
        'allnighter' => ['The All-Nighter', 4, 3, 'Rebuild the whole site before the borrel.'],
    ];
    $espressoDeck = ['single', 'single', 'single', 'double', 'double', 'double', 'triple', 'triple', 'matcha', 'matcha', 'decaf', 'allnighter'];

    $c = [
        'title' => 'Pandemonks',
        'colors' => $colors,
        'rooms' => $rooms,
        'links' => $links,
        'roles' => $roles,
        'events' => $events,
        'news' => $news,
        'thomasPlaces' => $thomasPlaces,
        'espresso' => $espresso,
        'espressoDeck' => $espressoDeck,
        'rates' => [2, 2, 2, 2, 3, 3, 4],
        'maxRageQuits' => 6,
        'tokensPerColor' => 16,
        'maxWarRooms' => 4,
        'handLimit' => 7,
        'actionsPerTurn' => 4,
        'fixCards' => 3,
        'trainCost' => 1,
        'dashboardEvery' => 2,
        'handoverCost' => 2,   // actions the forgetful team loses on its next turn
        'handoverGift' => 1,   // of those, how many go to the next team right away
        'maxStress' => 4,
        'startRoom' => 'hlive',
        'amsStart' => 'alive',
        'teamColors' => ['1' => '#F4F1EA', '2' => '#A3E635', '3' => '#60A5FA', '4' => '#C084FC'],
        'botDelay' => 3.0,
    ];
    return $c;
}

function neighbours(string $room): array {
    static $adj = null;
    if ($adj === null) {
        $adj = [];
        foreach (config()['links'] as [$a, $b]) { $adj[$a][] = $b; $adj[$b][] = $a; }
    }
    return $adj[$room] ?? [];
}

function roomColor(string $room): ?string { return config()['rooms'][$room]['color']; }
function roomName(string $room): string { return config()['rooms'][$room]['name']; }
function pods(): array { return array_keys(array_filter(config()['rooms'], fn($r) => !$r['special'])); }

/* ================================================================== storage */

function emptyState(): array {
    return [
        'v' => 1,
        'status' => 'lobby',
        'teams' => [],
        'settings' => ['fridays' => 4, 'minutes' => 45],
        'log' => [],
        'reveals' => [],
        'revealSeq' => 0,
        'history' => [],
        'tutorial' => ['on' => false, 'step' => 0],
        'sound' => true,
    ];
}

function withState(callable $fn) {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0775, true);
    $lock = fopen(LOCK_FILE, 'c');
    flock($lock, LOCK_EX);
    try {
        $raw = is_file(STATE_FILE) ? file_get_contents(STATE_FILE) : '';
        $s = $raw ? json_decode($raw, true) : null;
        if (!is_array($s)) $s = emptyState();
        $before = $s['v'];
        $result = $fn($s);
        if ($s['v'] !== $before) {
            file_put_contents(STATE_FILE . '.tmp', json_encode($s));
            rename(STATE_FILE . '.tmp', STATE_FILE);
        }
        return $result;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function publicState(array $s): array {
    unset($s['history'], $s['espressoDeck'], $s['fxHeld'], $s['turnFx']);
    $s['clockLeft'] = clockLeft($s);
    $s['now'] = time();
    if (empty($s['teams'])) $s['teams'] = new stdClass();
    if (isset($s['fireDeck'])) { $s['crisisLeft'] = count($s['fireDeck']); unset($s['fireDeck']); }
    return $s;
}

/* ================================================================== helpers */

function addLog(array &$s, string $text, string $kind = 'info', string $from = 'Monkbot'): void {
    $s['log'][] = ['t' => time(), 'text' => $text, 'kind' => $kind, 'from' => $from];
    if (count($s['log']) > 80) $s['log'] = array_slice($s['log'], -80);
}

function reveal(array &$s, string $kind, string $title, array $cards = [], string $sub = '', array $panels = []): void {
    $s['revealSeq'] = ($s['revealSeq'] ?? 0) + 1;
    $r = ['seq' => $s['revealSeq'], 'kind' => $kind, 'title' => $title, 'sub' => $sub, 'cards' => $cards, 'panels' => $panels];
    $s['reveals'][] = $r;
    if (count($s['reveals']) > 12) $s['reveals'] = array_slice($s['reveals'], -12);
    fx($s, ['type' => 'reveal', 'r' => $r]);
}

/* ---- structured events for the big screen: animations + the turn recap ---- */
function fx(array &$s, array $e): void {
    if (!empty($s['fxHold'])) { $s['fxHeld'][] = $e; return; }
    pushFx($s, $e);
}
function pushFx(array &$s, array $e): void {
    $s['fxSeq'] = ($s['fxSeq'] ?? 0) + 1;
    $e['seq'] = $s['fxSeq'];
    $s['fx'][] = $e;
    if (count($s['fx']) > 60) $s['fx'] = array_slice($s['fx'], -60);
    if ($e['type'] !== 'reveal') $s['turnFx'][] = $e;
}
function holdFx(array &$s): void { $s['fxHold'] = true; $s['fxHeld'] = $s['fxHeld'] ?? []; }
function flushFx(array &$s): void {
    $s['fxHold'] = false;
    $held = $s['fxHeld'] ?? [];
    $s['fxHeld'] = [];
    foreach ($held as $e) pushFx($s, $e);
}

function recapPanels(array $s, string $team): array {
    $cfg = config();
    $panels = [];
    $fires = 0; $esc = 0;
    foreach ($s['turnFx'] ?? [] as $e) {
        $t = $e['type'];
        if ($t === 'fire') { $fires++; continue; }
        if ($t === 'escalate') { $esc++; continue; }
        if (($e['team'] ?? null) !== $team && !in_array($t, ['crash', 'news'], true)) continue;
        switch ($t) {
        case 'move':
            $lbl = ['walk' => 'Walked to', 'dm' => 'DM\'d and ran to', 'allhands' => 'All-hands, then off to', 'hop' => 'War Room hop to', 'ops' => 'Ops shortcut to', 'gather' => 'Got pulled into', 'freelancer' => 'Freelancer lift to', 'martin' => 'Summoned to'][$e['kind']] ?? 'Moved to';
            $panels[] = ['icon' => !empty($e['cross']) ? 'train' : 'walk', 'text' => (!empty($e['cross']) && $e['kind'] === 'walk' ? 'Took the NS to' : $lbl) . ' ' . roomName($e['to'])];
            break;
        case 'treat': $panels[] = ['icon' => 'poof', 'text' => 'Put out ' . $e['n'] . ' fire' . ($e['n'] === 1 ? '' : 's') . ' in ' . roomName($e['room'])]; break;
        case 'share': $panels[] = ['icon' => 'swap', 'text' => ($e['dir'] === 'give' ? 'Gave ' : 'Took ') . roomName(roomOfCard($e['card'])) . ($e['dir'] === 'give' ? ' to ' : ' from ') . teamName($s, $e['other'])]; break;
        case 'build': $panels[] = ['icon' => 'warroom', 'text' => 'Opened a War Room in ' . roomName($e['room'])]; break;
        case 'cure': $panels[] = ['icon' => 'playbook', 'text' => 'Met the deadline: ' . $cfg['colors'][$e['color']]['fix'] . '!']; break;
        case 'espresso': $panels[] = ['icon' => 'coffee', 'text' => $cfg['espresso'][$e['id']][0] . ': +' . $e['plus'] . ' action' . ($e['plus'] === 1 ? '' : 's')]; break;
        case 'dashboard': $panels[] = ['icon' => 'tick', 'text' => 'Updated the dashboard']; break;
        case 'cookie': $panels[] = ['icon' => 'cookie', 'text' => 'Forgot the dashboard. Handover!']; break;
        case 'event': $panels[] = ['icon' => 'star', 'text' => 'Played ' . $cfg['events'][substr($e['card'], 2)]['name']]; break;
        case 'breather': $panels[] = ['icon' => 'coffee', 'text' => 'Coffee and a stroopwafel']; break;
        case 'crash': $panels[] = ['icon' => 'zz', 'text' => teamName($s, $e['team']) . ' crashed into a chair massage']; break;
        case 'massage': $panels[] = ['icon' => 'zz', 'text' => 'Spent the turn in a chair massage']; break;
        }
    }
    $panels = array_slice($panels, 0, 5);
    if ($fires) $panels[] = ['icon' => 'fire', 'text' => $fires . ' new fire' . ($fires === 1 ? '' : 's') . ' came in'];
    if ($esc) $panels[] = ['icon' => 'boom', 'text' => $esc . ' escalation' . ($esc === 1 ? '' : 's') . '!'];
    if (!$panels) $panels[] = ['icon' => 'walk', 'text' => 'A quiet turn. Suspiciously quiet.'];
    return array_slice($panels, 0, 6);
}

function snark(string $kind): array {
    $lines = [
        'ragequit' => [['Client', 'Per my last email...'], ['Client', 'Looping in my manager here.'], ['Studio Lead', 'Let us take this offline.']],
        'friday'   => [['Client', 'Small thing, can we try it in green? Thx!'], ['Client', 'Quick one before the weekend...'], ['Client', 'Sending over a few tiny tweaks (see attached 14 pages).']],
        'crash'    => [['Reception', 'Your chair massage slot starts now. Enjoy!'], ['Reception', 'Please leave your laptop at reception during the massage.']],
        'fix'      => [['Studio Lead', 'Gold stars to all!'], ['Client', 'Love it. Can we see 3 more options?']],
        'espresso' => [['Lunch Team', 'Whoever drank the last oat milk: we know.'], ['Reception', 'The coffee machine is making a new noise.'], ['IT', 'Expect network disruptions at 17:30.']],
        'treat'    => [['Studio Lead', 'Love the energy here.'], ['Timesheet Inspector', 'Remember to log this in your timesheet.']],
        'cookie'   => [['Timesheet Inspector', 'Project not in the dashboard? Then somebody else runs it for a bit.'], ['Studio Lead', 'Who is covering? Please write it down this time.']],
        'news'     => [['Reception', 'Has anyone seen the charger on the black table?'], ['IT', 'We are looking into it.'], ['Lunch Team', 'The lunch menu for next week is ready!']],
    ];
    $l = $lines[$kind] ?? [['Monkbot', '...']];
    return $l[array_rand($l)];
}

function teamName(array $s, $t): string { return $s['teams'][(string)$t]['name'] ?? ('Team ' . $t); }

function activeTeam(array $s): ?string {
    if (($s['status'] ?? '') !== 'playing') return null;
    return (string)$s['order'][$s['turnIdx']];
}

function requirePlaying(array $s): void {
    if ($s['status'] !== 'playing') throw new GameError('The game is not running.');
}

function requireTurn(array $s, string $team, string $phase): void {
    requirePlaying($s);
    if (activeTeam($s) !== $team) throw new GameError('It is not your turn.');
    if ($s['phase'] !== $phase) {
        $names = ['actions' => 'doing actions', 'draw' => 'drawing cards', 'infect' => 'flipping crises'];
        throw new GameError('Right now the team is ' . ($names[$s['phase']] ?? $s['phase']) . '.');
    }
}

function requireTeam(array $s, string $team): array {
    if (!isset($s['teams'][$team])) throw new GameError('Unknown team.');
    return $s['teams'][$team];
}

function removeFromHand(array &$s, string $team, string $card): void {
    $i = array_search($card, $s['teams'][$team]['hand'], true);
    if ($i === false) throw new GameError('That card is not in your hand.');
    array_splice($s['teams'][$team]['hand'], $i, 1);
    $s['projectDiscard'][] = $card;
}

function hasCard(array $s, string $team, string $card): bool { return in_array($card, $s['teams'][$team]['hand'], true); }
function roomOfCard(string $card): ?string { return str_starts_with($card, 'r:') ? substr($card, 2) : null; }

function spendAction(array &$s): void {
    $s['actionsLeft'] -= 1 + ($s['pendingExtra'] ?? 0);
    $s['pendingExtra'] = 0;
    if ($s['actionsLeft'] <= 0) {
        $s['actionsLeft'] = 0;
        $s['phase'] = 'draw';
        addLog($s, teamName($s, activeTeam($s)) . ' is out of actions.', 'turn');
    }
}

function office(string $room): string { return config()['rooms'][$room]['office']; }
function effectActive(array $s, string $id): bool { return isset($s['effects'][$id]) && ($s['turnCount'] ?? 0) < $s['effects'][$id]; }
function pantryFor(string $room): string { return office($room) === 'ams' ? 'acafe' : 'hpantry'; }

function teamWithRole(array $s, string $role): ?string {
    foreach ($s['teams'] as $id => $t) if (($t['role'] ?? '') === $role) return (string)$id;
    return null;
}

function isProtected(array $s, string $room): bool {
    $p = teamWithRole($s, 'teamlead');
    if ($p === null) return false;
    $loc = $s['teams'][$p]['loc'];
    return $loc === $room || in_array($room, neighbours($loc), true);
}

function producerBlocks(array $s, string $room, string $color): bool {
    $p = teamWithRole($s, 'producer');
    return $p !== null && $s['teams'][$p]['loc'] === $room && !empty($s['cured'][$color]);
}

function tokensOnBoard(array $s, string $color): int {
    $n = 0;
    foreach ($s['fires'] as $f) $n += $f[$color] ?? 0;
    return $n;
}

function checkEradicated(array &$s, string $color): void {
    if (!empty($s['cured'][$color]) && empty($s['eradicated'][$color]) && tokensOnBoard($s, $color) === 0) {
        $s['eradicated'][$color] = true;
        addLog($s, config()['colors'][$color]['name'] . ' is completely under control. No new fires of that colour.', 'good');
    }
}

function removeTokens(array &$s, string $room, string $color, int $n): int {
    $have = $s['fires'][$room][$color] ?? 0;
    $n = min($n, $have);
    if ($n <= 0) return 0;
    $s['fires'][$room][$color] = $have - $n;
    $s['supply'][$color] += $n;
    checkEradicated($s, $color);
    return $n;
}

function producerSweep(array &$s): void {
    $p = teamWithRole($s, 'producer');
    if ($p === null) return;
    $loc = $s['teams'][$p]['loc'];
    foreach (config()['colors'] as $color => $_) {
        if (!empty($s['cured'][$color]) && ($s['fires'][$loc][$color] ?? 0) > 0) {
            $n = removeTokens($s, $loc, $color, 99);
            addLog($s, 'The Producer puts out ' . $n . ' fire' . ($n === 1 ? '' : 's') . ' in ' . roomName($loc) . '.', 'good');
        }
    }
}

function movePawn(array &$s, string $pawn, string $to, string $how, bool $free = false, string $kind = 'walk', ?string $card = null): void {
    if (!isset(config()['rooms'][$to])) throw new GameError('Unknown room.');
    $from = $s['teams'][$pawn]['loc'];
    if ($from === $to) throw new GameError('That team is already there.');
    $cross = office($from) !== office($to);
    if ($cross && !$free) {
        if (effectActive($s, 'notrains')) throw new GameError('No trains between AMS and HIL today. Nobody changes office this round.');
        $cost = 1 + config()['trainCost'];
        if (($s['actionsLeft'] ?? 0) < $cost) throw new GameError('Changing office takes the NS: that costs ' . $cost . ' actions.');
        $s['pendingExtra'] = config()['trainCost'];
        $how .= ', hops on the NS';
    }
    $s['teams'][$pawn]['loc'] = $to;
    fx($s, ['type' => 'move', 'team' => activeTeam($s) ?? $pawn, 'pawn' => $pawn, 'from' => $from, 'to' => $to, 'cross' => $cross, 'kind' => $kind, 'card' => $card]);
    addLog($s, teamName($s, $pawn) . ' ' . $how . ' to ' . roomName($to) . '.', 'move');
    producerSweep($s);
}

function lose(array &$s, string $reason): void {
    if ($s['status'] !== 'playing') return;
    $s['status'] = 'lost';
    $s['result'] = ['won' => false, 'reason' => $reason, 'at' => time()];
    stopClock($s);
    addLog($s, 'Game over: ' . $reason, 'bad', 'Client');
    reveal($s, 'lost', 'The client printed it out', [], $reason);
}

function win(array &$s): void {
    $s['status'] = 'won';
    $s['result'] = ['won' => true, 'reason' => 'All four deadlines met. The site is live before the borrel.', 'at' => time()];
    stopClock($s);
    addLog($s, 'We are live!!! Gold stars to all!', 'good', 'Studio Lead');
    reveal($s, 'won', "People's Lovie Winner", [], 'All four deadlines met with ' . gmdate('i:s', max(0, clockLeft($s))) . ' to spare. Biertjes and winetjes in the cafeteria.');
}

/* ================================================================== burnout */

function placeTokens(array &$s, string $room, string $color, int $n, array &$chain): void {
    for ($i = 0; $i < $n; $i++) {
        if ($s['status'] !== 'playing') return;
        if (config()['rooms'][$room]['special']) return;
        if (!empty($s['eradicated'][$color])) return;
        if (isProtected($s, $room) || producerBlocks($s, $room, $color)) return;
        $have = $s['fires'][$room][$color] ?? 0;
        if ($have >= 3) {
            if (in_array($room, $chain, true)) return;
            $chain[] = $room;
            $s['escalations']++;
            fx($s, ['type' => 'escalate', 'room' => $room, 'color' => $color]);
            [$from, $line] = snark('ragequit');
            addLog($s, 'ESCALATED TO THE CLIENT from ' . roomName($room) . '! Fires spread to every connected room.', 'bad');
            addLog($s, $line, 'snark', $from);
            reveal($s, 'ragequit', 'Escalated!', ['r:' . $room], roomName($room) . ' went over budget, over time and over the head of the PM. Fires spread to ' . implode(', ', array_map('roomName', array_filter(neighbours($room), fn($r) => !config()['rooms'][$r]['special']))) . '.');
            if ($s['escalations'] >= config()['maxRageQuits']) { lose($s, '6 escalations. The client pulls the plug.'); return; }
            foreach (neighbours($room) as $nb) placeTokens($s, $nb, $color, 1, $chain);
            return;
        }
        if ($s['supply'][$color] <= 0) { lose($s, 'We ran out of people to fight ' . config()['colors'][$color]['name'] . ' fires.'); return; }
        $s['fires'][$room][$color] = $have + 1;
        $s['supply'][$color]--;
        fx($s, ['type' => 'fire', 'room' => $room, 'color' => $color]);
    }
}

function burnRoom(array &$s, string $room, int $n): void {
    $chain = [];
    placeTokens($s, $room, roomColor($room), $n, $chain);
}

function drawCrisis(array &$s, bool $bottom = false): ?string {
    if (empty($s['fireDeck'])) {
        if (empty($s['fireDiscard'])) return null;
        $s['fireDeck'] = $s['fireDiscard'];
        shuffle($s['fireDeck']);
        $s['fireDiscard'] = [];
    }
    if ($bottom) {
        // the bottom card is always a desk card, never a crash card
        for ($i = count($s['fireDeck']) - 1; $i >= 0; $i--) {
            if (str_starts_with($s['fireDeck'][$i], 'r:')) { $card = $s['fireDeck'][$i]; array_splice($s['fireDeck'], $i, 1); $s['fireDiscard'][] = $card; return $card; }
        }
        return null;
    }
    $card = array_shift($s['fireDeck']);
    if (str_starts_with($card, 'r:')) $s['fireDiscard'][] = $card;
    return $card;
}

function crisisCard(string $room): string {
    $c = config()['rooms'][$room]['crises'];
    return 'r:' . $room . '#' . array_rand($c);
}

function resolveFriday(array &$s): void {
    $s['rateIdx'] = min($s['rateIdx'] + 1, count(config()['rates']) - 1);
    $card = drawCrisis($s, true);
    $room = substr($card, 2);
    [$from, $line] = snark('friday');
    addLog($s, 'FRIDAY 17:00! The client sends feedback. ' . roomName($room) . ' takes 3 fires.', 'bad');
    addLog($s, $line, 'snark', $from);
    reveal($s, 'friday', 'Friday 17:00', [crisisCard($room)], $line);
    burnRoom($s, $room, 3);
    $pile = $s['fireDiscard'];
    shuffle($pile);
    $s['fireDeck'] = array_merge($pile, $s['fireDeck']);
    $s['fireDiscard'] = [];
}

/* ================================================================== clock */

function clockLeft(array $s): int {
    if (empty($s['clock'])) return ($s['settings']['minutes'] ?? 45) * 60;
    $c = $s['clock'];
    $end = $c['stoppedAt'] ?? $c['pausedAt'] ?? time();
    return (int)($c['seconds'] - ($end - $c['startedAt'] - $c['pausedTotal']));
}

function stopClock(array &$s): void {
    if (!empty($s['clock']) && empty($s['clock']['stoppedAt'])) $s['clock']['stoppedAt'] = $s['clock']['pausedAt'] ?? time();
}

/* ================================================================== setup */

function startGame(array &$s, array $p): void {
    $cfg = config();
    if (count($s['teams']) < 2) throw new GameError('At least 2 teams need to join first.');
    $fridays = max(3, min(6, (int)($p['fridays'] ?? $s['settings']['fridays'] ?? 4)));
    $minutes = max(5, min(120, (int)($p['minutes'] ?? $s['settings']['minutes'] ?? 45)));
    $s['settings'] = ['fridays' => $fridays, 'minutes' => $minutes, 'botDelay' => isset($p['botDelay']) ? max(0, min(10, (float)$p['botDelay'])) : config()['botDelay']];

    $order = array_map('strval', array_keys($s['teams']));
    sort($order);
    $roles = array_keys($cfg['roles']);
    shuffle($roles);
    foreach ($order as $i => $id) {
        $s['teams'][$id]['role'] = $roles[$i];
        $s['teams'][$id]['loc'] = !empty($s['teams'][$id]['amsterdam']) ? $cfg['amsStart'] : $cfg['startRoom'];
        $s['teams'][$id]['hand'] = [];
        $s['teams'][$id]['stress'] = 0;
        $s['teams'][$id]['meditating'] = false;
        $s['teams'][$id]['minus'] = 0;
        $s['teams'][$id]['owe'] = 0;
        $s['teams'][$id]['dashAge'] = 0;
        $s['teams'][$id]['cookies'] = 0;
        $s['teams'][$id]['debt'] = 0;
        $s['teams'][$id]['gift'] = 0;
    }

    $s['fires'] = [];
    foreach ($cfg['rooms'] as $id => $_) $s['fires'][$id] = array_fill_keys(array_keys($cfg['colors']), 0);
    $s['supply'] = array_fill_keys(array_keys($cfg['colors']), $cfg['tokensPerColor']);
    $s['cured'] = array_fill_keys(array_keys($cfg['colors']), false);
    $s['eradicated'] = array_fill_keys(array_keys($cfg['colors']), false);
    $s['warRooms'] = [$cfg['startRoom'], $cfg['amsStart']];
    $s['effects'] = [];
    $s['pendingExtra'] = 0;
    $s['fx'] = [];
    $s['turnFx'] = [];
    $s['fxHeld'] = [];
    $s['fxHold'] = false;
    $s['newsDeck'] = array_keys($cfg['news']);
    shuffle($s['newsDeck']);
    $s['lastNews'] = null;
    $s['escalations'] = 0;
    $s['rateIdx'] = 0;
    $s['quiet'] = false;
    $s['status'] = 'playing';
    $s['order'] = $order;
    $s['turnIdx'] = 0;
    $s['turnCount'] = 1;
    $s['phase'] = 'actions';
    $s['actionsLeft'] = $cfg['actionsPerTurn'];
    $s['opsMoveUsed'] = false;
    $s['espressoUsed'] = false;
    $s['result'] = null;
    $s['log'] = [];
    $s['reveals'] = [];
    $s['espressoDeck'] = $cfg['espressoDeck'];
    shuffle($s['espressoDeck']);
    $s['botAt'] = microtime(true) + botDelay($s) * 2;

    $s['fireDeck'] = array_map(fn($r) => 'r:' . $r, pods());
    shuffle($s['fireDeck']);
    $s['fireDiscard'] = [];
    $opening = [];
    holdFx($s);
    foreach ([3, 2, 1, 1] as $n) {
        $card = drawCrisis($s);
        $opening[] = crisisCard(substr($card, 2));
        burnRoom($s, substr($card, 2), $n);
    }

    $deck = [];
    foreach (pods() as $id) { $deck[] = 'r:' . $id; $deck[] = 'r:' . $id; }
    foreach ($cfg['events'] as $id => $_) $deck[] = 'e:' . $id;
    shuffle($deck);
    $deal = [2 => 4, 3 => 3][count($order)] ?? 2;
    foreach ($order as $id) for ($i = 0; $i < $deal; $i++) $s['teams'][$id]['hand'][] = array_shift($deck);

    $piles = array_fill(0, $fridays, []);
    foreach ($deck as $i => $card) $piles[$i % $fridays][] = $card;
    $s['projectDeck'] = [];
    foreach ($piles as $pile) { $pile[] = 'friday'; shuffle($pile); $s['projectDeck'] = array_merge($s['projectDeck'], $pile); }
    $s['projectDiscard'] = [];

    $s['clock'] = ['startedAt' => time(), 'pausedAt' => null, 'pausedTotal' => 0, 'seconds' => $minutes * 60, 'stoppedAt' => null];
    addLog($s, 'Good morning HPark and AMS! The site goes live at 17:30, right before the borrel. Meet all four deadlines before then.', 'turn', 'Studio Lead');
    $s['fxHold'] = false;
    $accentPanels = [];
    foreach ($s['order'] as $tid) { $r = $cfg['roles'][$s['teams'][$tid]['role']]; $accentPanels[] = ['icon' => 'star', 'text' => teamName($s, $tid) . ': ' . $r['accentName'] . ' (' . $r['name'] . ')']; }
    reveal($s, 'recap', 'Accents on!', [], '', $accentPanels);
    reveal($s, 'start', 'It is 09:00', $opening, 'Go-live is at 17:30. These rooms are already on fire.');
    flushFx($s);
    $s['turnFx'] = [];
    addLog($s, teamName($s, $order[0]) . ' starts.', 'turn');
}

/* ================================================================== actions */

function pawnFor(array $s, string $team, array $p): string {
    $pawn = isset($p['pawn']) && $p['pawn'] !== '' ? (string)$p['pawn'] : $team;
    requireTeam($s, $pawn);
    if ($pawn !== $team && $s['teams'][$team]['role'] !== 'planner') throw new GameError('Only the Resource Planner can move other teams.');
    if (!empty($s['teams'][$pawn]['meditating'])) throw new GameError('That team is stuck in a chair massage.');
    return $pawn;
}

function doAction(array &$s, string $team, string $type, array $p): void {
    doActionInner($s, $team, $type, $p);
    autoFlip($s);
}

/* the crises flip by themselves as soon as nobody is over the hand limit */
function flipBlocker(array $s): ?string {
    $cfg = config();
    foreach ($s['teams'] as $id => $t) {
        if (count($t['hand']) > $cfg['handLimit']) return teamName($s, (string)$id) . ' has to get down to ' . $cfg['handLimit'] . ' cards first.';
        if (($t['owe'] ?? 0) > 0 && array_filter($t['hand'], fn($c) => roomOfCard($c))) return teamName($s, (string)$id) . ' still has to hand in 1 room card for the hours.';
    }
    return null;
}
function autoFlip(array &$s): void {
    if (($s['status'] ?? '') !== 'playing' || ($s['phase'] ?? '') !== 'infect' || flipBlocker($s) !== null) return;
    $team = activeTeam($s);
    if ($team !== null) doActionInner($s, $team, 'infect', []);
}

function doActionInner(array &$s, string $team, string $type, array $p): void {
    $cfg = config();
    $me = $s['teams'][$team] ?? null;

    switch ($type) {
    case 'walk': {
        requireTurn($s, $team, 'actions');
        $pawn = pawnFor($s, $team, $p);
        $to = (string)($p['to'] ?? '');
        if (!in_array($to, neighbours($s['teams'][$pawn]['loc']), true)) throw new GameError('That room is not connected.');
        movePawn($s, $pawn, $to, 'walks');
        spendAction($s);
        break;
    }
    case 'direct': {
        requireTurn($s, $team, 'actions');
        $pawn = pawnFor($s, $team, $p);
        $to = (string)($p['to'] ?? '');
        removeFromHand($s, $team, 'r:' . $to);
        movePawn($s, $pawn, $to, 'sends a DM and runs', false, 'dm', 'r:' . $to);
        spendAction($s);
        break;
    }
    case 'allhands': {
        requireTurn($s, $team, 'actions');
        $pawn = pawnFor($s, $team, $p);
        $loc = $s['teams'][$pawn]['loc'];
        if ($cfg['rooms'][$loc]['special']) throw new GameError('There is no room card for this room.');
        removeFromHand($s, $team, 'r:' . $loc);
        movePawn($s, $pawn, (string)($p['to'] ?? ''), 'calls an all-hands and moves', false, 'allhands', 'r:' . $loc);
        spendAction($s);
        break;
    }
    case 'hop': {
        requireTurn($s, $team, 'actions');
        $pawn = pawnFor($s, $team, $p);
        $to = (string)($p['to'] ?? '');
        if (!in_array($s['teams'][$pawn]['loc'], $s['warRooms'], true) || !in_array($to, $s['warRooms'], true)) throw new GameError('Both places need a War Room.');
        movePawn($s, $pawn, $to, 'hops between War Rooms', false, 'hop');
        spendAction($s);
        break;
    }
    case 'opsmove': {
        requireTurn($s, $team, 'actions');
        if ($me['role'] !== 'ops') throw new GameError('Only the Ops Lead can do that.');
        if ($s['opsMoveUsed']) throw new GameError('Already used this turn.');
        if (!in_array($me['loc'], $s['warRooms'], true)) throw new GameError('You need to stand in a War Room.');
        $card = (string)($p['card'] ?? '');
        if (!roomOfCard($card)) throw new GameError('Pick a room card to discard.');
        removeFromHand($s, $team, $card);
        $s['opsMoveUsed'] = true;
        movePawn($s, $team, (string)($p['to'] ?? ''), 'takes an Ops shortcut', false, 'ops', $card);
        spendAction($s);
        break;
    }
    case 'gather': {
        requireTurn($s, $team, 'actions');
        if ($me['role'] !== 'planner') throw new GameError('Only the Resource Planner can do that.');
        $pawn = pawnFor($s, $team, $p);
        $to = (string)($p['to'] ?? '');
        $ok = false;
        foreach ($s['teams'] as $id => $t) if ((string)$id !== $pawn && $t['loc'] === $to) $ok = true;
        if (!$ok) throw new GameError('There is no other team in that room.');
        movePawn($s, $pawn, $to, 'is pulled in by the Resource Planner', false, 'gather');
        spendAction($s);
        break;
    }
    case 'build': {
        requireTurn($s, $team, 'actions');
        $loc = $me['loc'];
        if (in_array($loc, $s['warRooms'], true)) throw new GameError('There already is a War Room here.');
        if ($cfg['rooms'][$loc]['special']) throw new GameError('You cannot open a War Room here.');
        if ($me['role'] !== 'ops') removeFromHand($s, $team, 'r:' . $loc);
        addWarRoom($s, $loc, (string)($p['remove'] ?? ''));
        fx($s, ['type' => 'build', 'team' => $team, 'room' => $loc, 'card' => $me['role'] !== 'ops' ? 'r:' . $loc : null]);
        addLog($s, teamName($s, $team) . ' opens a War Room in ' . roomName($loc) . '.', 'good');
        spendAction($s);
        break;
    }
    case 'treat': {
        requireTurn($s, $team, 'actions');
        $color = (string)($p['color'] ?? '');
        $loc = $me['loc'];
        if (($s['fires'][$loc][$color] ?? 0) <= 0) throw new GameError('No fire of that colour here.');
        $all = $me['role'] === 'producer' || !empty($s['cured'][$color]);
        $n = removeTokens($s, $loc, $color, $all ? 99 : 1);
        fx($s, ['type' => 'treat', 'team' => $team, 'room' => $loc, 'color' => $color, 'n' => $n]);
        addLog($s, teamName($s, $team) . ' puts out ' . $n . ' fire' . ($n === 1 ? '' : 's') . ' in ' . roomName($loc) . '.', 'good');
        if (mt_rand(1, 3) === 1) { [$f, $l] = snark('treat'); addLog($s, $l, 'snark', $f); }
        spendAction($s);
        break;
    }
    case 'give':
    case 'take': {
        requireTurn($s, $team, 'actions');
        $other = (string)($p['other'] ?? '');
        requireTeam($s, $other);
        if ($other === $team) throw new GameError('Pick another team.');
        if ($s['teams'][$other]['loc'] !== $me['loc']) throw new GameError('You need to be in the same room.');
        $card = (string)($p['card'] ?? '');
        $room = roomOfCard($card);
        if (!$room) throw new GameError('Only room cards can be shared.');
        [$from, $to] = $type === 'give' ? [$team, $other] : [$other, $team];
        if ($s['teams'][$from]['role'] !== 'account' && $room !== $me['loc']) throw new GameError('You can only share the card of the room you are in.');
        if (!hasCard($s, $from, $card)) throw new GameError('That card is not in their hand.');
        $i = array_search($card, $s['teams'][$from]['hand'], true);
        array_splice($s['teams'][$from]['hand'], $i, 1);
        $s['teams'][$to]['hand'][] = $card;
        fx($s, ['type' => 'share', 'team' => $team, 'other' => $other, 'dir' => $type, 'from' => $from, 'to' => $to, 'card' => $card, 'room' => $me['loc']]);
        addLog($s, teamName($s, $from) . ' hands ' . roomName($room) . ' to ' . teamName($s, $to) . '.', 'good');
        spendAction($s);
        break;
    }
    case 'cure': {
        requireTurn($s, $team, 'actions');
        $color = (string)($p['color'] ?? '');
        if (!isset($cfg['colors'][$color])) throw new GameError('Unknown colour.');
        if (!empty($s['cured'][$color])) throw new GameError('That deadline is already met.');
        if (effectActive($s, 'thomas')) throw new GameError('Thomas is stuck abroad with all the approvals. No deadlines signed off this round.');
        if (!in_array($me['loc'], $s['warRooms'], true)) throw new GameError('You need to be in a War Room.');
        $need = fixNeed($me);
        $cards = array_values(array_filter($me['hand'], fn($c) => roomOfCard($c) && roomColor(roomOfCard($c)) === $color));
        if (count($cards) < $need) throw new GameError('You need ' . $need . ' cards of that colour.');
        $used = array_slice($cards, 0, $need);
        foreach ($used as $c) removeFromHand($s, $team, $c);
        $s['cured'][$color] = true;
        fx($s, ['type' => 'cure', 'team' => $team, 'room' => $me['loc'], 'color' => $color, 'cards' => $used]);
        [$f, $l] = snark('fix');
        addLog($s, teamName($s, $team) . ' writes ' . $cfg['colors'][$color]['fix'] . '!', 'good');
        addLog($s, $l, 'snark', $f);
        reveal($s, 'cure', 'Deadline met!', $used, $cfg['colors'][$color]['fix'] . ' is done and signed off. ' . $cfg['colors'][$color]['name'] . ' is under control.');
        producerSweep($s);
        checkEradicated($s, $color);
        spendAction($s);
        if (count(array_filter($s['cured'])) === count($cfg['colors'])) win($s);
        break;
    }
    case 'breather': {
        requireTurn($s, $team, 'actions');
        if (empty($cfg['rooms'][$me['loc']]['pantry'])) throw new GameError('Breathers happen in a pantry or the cafeteria.');
        if ($me['stress'] <= 0) throw new GameError('You are as relaxed as it gets.');
        $s['teams'][$team]['stress']--;
        fx($s, ['type' => 'breather', 'team' => $team, 'room' => $me['loc']]);
        addLog($s, teamName($s, $team) . ' grabs a coffee and a stroopwafel. Stress down to ' . $s['teams'][$team]['stress'] . '.', 'good', 'Lunch Team');
        spendAction($s);
        break;
    }
    case 'dashboard': {
        requireTurn($s, $team, 'actions');
        if (($me['dashAge'] ?? 0) === 0 && !empty($me['dashDone'])) throw new GameError('Your dashboard is already up to date.');
        $s['teams'][$team]['dashAge'] = 0;
        $s['teams'][$team]['dashDone'] = true;
        fx($s, ['type' => 'dashboard', 'team' => $team, 'room' => $me['loc']]);
        addLog($s, teamName($s, $team) . ' updates the project dashboard. Nobody has to cover.', 'good', 'Timesheet Inspector');
        spendAction($s);
        break;
    }
    case 'espresso': {
        requireTurn($s, $team, 'actions');
        if ($s['espressoUsed']) throw new GameError('One espresso per turn. Even you have limits.');
        if ($me['stress'] >= $cfg['maxStress']) throw new GameError('Stress is maxed. Your hands are shaking too much to hold the cup.');
        if (empty($s['espressoDeck'])) { $s['espressoDeck'] = $cfg['espressoDeck']; shuffle($s['espressoDeck']); }
        $id = array_shift($s['espressoDeck']);
        [$name, $plus, $crash, $line] = $cfg['espresso'][$id];
        $s['espressoUsed'] = true;
        $s['actionsLeft'] += $plus;
        fx($s, ['type' => 'espresso', 'team' => $team, 'room' => $me['loc'], 'id' => $id, 'plus' => $plus, 'crash' => $crash]);
        $s['teams'][$team]['stress'] = min($cfg['maxStress'], $me['stress'] + $crash);
        for ($i = 0; $i < $crash; $i++) {
            // the crash hides somewhere in the top half of the crisis deck
            $pos = mt_rand(0, max(0, intdiv(count($s['fireDeck']), 2)));
            array_splice($s['fireDeck'], $pos, 0, ['c:' . $team]);
        }
        [$f, $l] = snark('espresso');
        addLog($s, teamName($s, $team) . ' orders a ' . $name . ': +' . $plus . ' action' . ($plus === 1 ? '' : 's') . ', ' . $crash . ' crash card' . ($crash === 1 ? '' : 's') . ' hidden in the crisis deck.', 'turn', 'Lunch Team');
        addLog($s, $l, 'snark', $f);
        reveal($s, 'espresso', $name, ['x:' . $id], '+' . $plus . ' action' . ($plus === 1 ? '' : 's') . ' for ' . teamName($s, $team) . '. ' . $crash . ' crash card' . ($crash === 1 ? '' : 's') . ' shuffled into the crisis deck.');
        break;
    }
    case 'end_actions': {
        requireTurn($s, $team, 'actions');
        $s['phase'] = 'draw';
        addLog($s, teamName($s, $team) . ' ends their actions.', 'turn');
        break;
    }
    case 'draw': {
        requireTurn($s, $team, 'draw');
        $got = 0;
        $drawn = [];
        for ($i = 0; $i < 2 && $s['status'] === 'playing'; $i++) {
            if (empty($s['projectDeck'])) {
                $s['projectDeck'] = $s['projectDiscard'];
                shuffle($s['projectDeck']);
                $s['projectDiscard'] = [];
                addLog($s, 'The Project Deck ran out and is reshuffled.');
                if (empty($s['projectDeck'])) break;
            }
            $card = array_shift($s['projectDeck']);
            if ($card === 'friday') { resolveFriday($s); $drawn[] = 'friday'; }
            else { $s['teams'][$team]['hand'][] = $card; $got++; $drawn[] = $card; }
        }
        if ($got) fx($s, ['type' => 'draw', 'team' => $team, 'n' => $got, 'cards' => $drawn]);
        $s['lastDraw'] = ['team' => $team, 'cards' => $drawn, 'seq' => ($s['lastDraw']['seq'] ?? 0) + 1];
        addLog($s, teamName($s, $team) . ' draws ' . $got . ' card' . ($got === 1 ? '' : 's') . '.', 'turn');
        if ($s['status'] === 'playing') $s['phase'] = 'infect';
        break;
    }
    case 'infect': {
        requireTurn($s, $team, 'infect');
        foreach ($s['teams'] as $id => $t) if (!empty($t['owe']) && !array_filter($t['hand'], fn($c) => roomOfCard($c))) $s['teams'][$id]['owe'] = 0;
        if ($why = flipBlocker($s)) throw new GameError($why);
        $s['flipCards'] = [];
        $s['flipNote'] = '';
        if ($s['quiet']) {
            $s['quiet'] = false;
            addLog($s, 'The client is on holiday. No new crises this turn.', 'good');
            $s['flipNote'] = 'The client is on holiday. No new crises this turn.';
        } else {
            $rate = $cfg['rates'][$s['rateIdx']];
            $flipped = [];
            holdFx($s);
            for ($i = 0; $i < $rate && $s['status'] === 'playing'; $i++) {
                $card = drawCrisis($s);
                if (!$card) break;
                if (str_starts_with($card, 'c:')) {
                    $who = substr($card, 2);
                    $flipped[] = 'crash:' . $who;
                    if (isset($s['teams'][$who])) {
                        $crashFrom = $s['teams'][$who]['loc'];
                        $s['teams'][$who]['loc'] = pantryFor($crashFrom);
                        fx($s, ['type' => 'crash', 'team' => $who, 'pawn' => $who, 'from' => $crashFrom, 'to' => $s['teams'][$who]['loc']]);
                        $s['teams'][$who]['meditating'] = true;
                        $s['teams'][$who]['stress'] = 0;
                        [$f, $l] = snark('crash');
                        addLog($s, teamName($s, $who) . ' CRASHES and is sent to a chair massage in ' . roomName($s['teams'][$who]['loc']) . '. They skip their next turn.', 'bad');
                        addLog($s, $l, 'snark', $f);
                    }
                    continue;
                }
                $room = substr($card, 2);
                $flipped[] = crisisCard($room);
                burnRoom($s, $room, 1);
            }
            addLog($s, 'New crises: ' . implode(', ', array_map(fn($c) => str_starts_with($c, 'crash:') ? 'a caffeine crash' : roomName(explode('#', substr($c, 2))[0]), $flipped)) . '.', 'bad');
            // the crisis cards are shown together with the turn recap (in nextTurn); the fires stay held until then
            $s['flipCards'] = $flipped;
        }
        if ($s['status'] === 'playing') nextTurn($s);
        else { $s['fxHold'] = false; endTurnReveal($s, $team); flushFx($s); }
        break;
    }
    case 'discard': {
        requirePlaying($s);
        requireTeam($s, $team);
        $card = (string)($p['card'] ?? '');
        removeFromHand($s, $team, $card);
        fx($s, ['type' => 'discard', 'team' => $team, 'card' => $card]);
        if (($s['teams'][$team]['owe'] ?? 0) > 0 && roomOfCard($card)) {
            $s['teams'][$team]['owe']--;
            addLog($s, teamName($s, $team) . ' clears its hours. One room card handed in.', 'info', 'Timesheet Inspector');
        } else addLog($s, teamName($s, $team) . ' discards a card.');
        break;
    }
    case 'event': {
        requirePlaying($s);
        requireTeam($s, $team);
        $card = (string)($p['card'] ?? '');
        if (!str_starts_with($card, 'e:') || !hasCard($s, $team, $card)) throw new GameError('You do not hold that event.');
        $ev = substr($card, 2);
        fx($s, ['type' => 'event', 'team' => $team, 'card' => $card]);
        playEvent($s, $team, $ev, $p);
        removeFromHand($s, $team, $card);
        addLog($s, teamName($s, $team) . ' plays ' . $cfg['events'][$ev]['name'] . '.', 'good');
        reveal($s, 'event', $cfg['events'][$ev]['name'], [$card], $cfg['events'][$ev]['text']);
        break;
    }
    default:
        throw new GameError('Unknown action: ' . $type);
    }
}

function fixNeed(array $team): int { return config()['fixCards'] - (($team['role'] ?? '') === 'techlead' ? 1 : 0); }

function addWarRoom(array &$s, string $room, string $remove): void {
    if (in_array($room, $s['warRooms'], true)) throw new GameError('There already is a War Room there.');
    if (count($s['warRooms']) >= config()['maxWarRooms']) {
        if (!in_array($remove, $s['warRooms'], true)) throw new GameError('There are already 4 War Rooms. Pick one to close.');
        $s['warRooms'] = array_values(array_diff($s['warRooms'], [$remove]));
    }
    $s['warRooms'][] = $room;
}

function playEvent(array &$s, string $team, string $ev, array $p): void {
    switch ($ev) {
    case 'pizza': {
        $list = $p['fires'] ?? [];
        if (!is_array($list) || !$list) throw new GameError('Pick up to 2 fires to remove.');
        $removed = 0;
        foreach (array_slice($list, 0, 2) as $f) $removed += removeTokens($s, (string)($f['room'] ?? ''), (string)($f['color'] ?? ''), 1);
        if (!$removed) throw new GameError('No fires there.');
        break;
    }
    case 'tiramisu': {
        $room = (string)($p['room'] ?? '');
        if (!isset($s['fires'][$room])) throw new GameError('Pick a room.');
        $n = 0;
        foreach ($s['fires'][$room] as $c => $_) $n += removeTokens($s, $room, $c, 99);
        if (!$n) throw new GameError('There are no fires in that room.');
        break;
    }
    case 'freelancer': {
        $pawn = (string)($p['pawn'] ?? '');
        requireTeam($s, $pawn);
        movePawn($s, $pawn, (string)($p['to'] ?? ''), 'gets a freelancer to cover and moves', true, 'freelancer');
        break;
    }
    case 'holiday':
        $s['quiet'] = true;
        break;
    case 'budget': {
        $room = (string)($p['room'] ?? '');
        if (!isset(config()['rooms'][$room]) || config()['rooms'][$room]['special']) throw new GameError('Pick a room.');
        addWarRoom($s, $room, (string)($p['remove'] ?? ''));
        break;
    }
    case 'dog':
        foreach ($s['teams'] as $id => $_) $s['teams'][$id]['stress'] = 0;
        break;
    default:
        throw new GameError('Unknown event.');
    }
}

function botDelay(array $s): float { return (float)($s['settings']['botDelay'] ?? config()['botDelay']); }

function endTurnReveal(array &$s, string $team): void {
    $cards = $s['flipCards'] ?? [];
    $note = $s['flipNote'] ?? '';
    $s['flipCards'] = [];
    $s['flipNote'] = '';
    reveal($s, 'endturn', teamName($s, $team) . "'s turn", $cards, $note, recapPanels($s, $team));
}

function nextTurn(array &$s): void {
    $cfg = config();
    // the handover rule for the team that just finished
    $prev = activeTeam($s);
    $gift = 0;
    $s['fxHold'] = false;
    if ($prev !== null && isset($s['teams'][$prev])) endTurnReveal($s, $prev);
    flushFx($s);
    if ($prev !== null && isset($s['teams'][$prev])) {
        $s['teams'][$prev]['dashAge'] = ($s['teams'][$prev]['dashAge'] ?? 0) + 1;
        $s['teams'][$prev]['dashDone'] = false;
        if ($s['teams'][$prev]['dashAge'] >= $cfg['dashboardEvery']) {
            $s['teams'][$prev]['dashAge'] = 0;
            $s['teams'][$prev]['cookies'] = ($s['teams'][$prev]['cookies'] ?? 0) + 1; // number of handovers, for the score
            $s['teams'][$prev]['debt'] = ($s['teams'][$prev]['debt'] ?? 0) + $cfg['handoverCost'];
            $gift = $cfg['handoverGift'];
            $nextId = $s['order'][($s['turnIdx'] + 1) % count($s['order'])];
            fx($s, ['type' => 'cookie', 'team' => $prev, 'room' => $s['teams'][$prev]['loc'], 'to' => $nextId, 'cost' => $cfg['handoverCost'], 'gift' => $gift]);
            [$f, $l] = snark('cookie');
            addLog($s, teamName($s, $prev) . ' did not update the dashboard for ' . $cfg['dashboardEvery'] . ' turns. Handover: ' . $cfg['handoverCost'] . ' actions less next turn, ' . teamName($s, $nextId) . ' gets +' . $gift . ' to cover.', 'bad', 'Timesheet Inspector');
            addLog($s, $l, 'snark', $f);
            reveal($s, 'cookie', 'Handover!', [], teamName($s, $prev) . ' forgot the dashboard, so the project changes hands. ' . teamName($s, $prev) . ' loses ' . $cfg['handoverCost'] . ' actions next turn. ' . teamName($s, $nextId) . ' covers and gets +' . $gift . ' right now. The rest is lost in the status call.');
        }
    }
    $s['turnFx'] = [];

    $s['turnIdx'] = ($s['turnIdx'] + 1) % count($s['order']);
    $s['turnCount'] = ($s['turnCount'] ?? 1) + 1;
    $s['phase'] = 'actions';
    $s['actionsLeft'] = $cfg['actionsPerTurn'];
    $s['opsMoveUsed'] = false;
    $s['espressoUsed'] = false;
    $s['pendingExtra'] = 0;
    $s['botAt'] = microtime(true) + botDelay($s) * 3;

    if ($s['turnIdx'] === 0) {
        $s['round'] = ($s['round'] ?? 1) + 1;
        resolveNews($s);
        if ($s['status'] !== 'playing') return;
    }

    $id = activeTeam($s);
    if ($gift && $id !== $prev) $s['teams'][$id]['gift'] = ($s['teams'][$id]['gift'] ?? 0) + $gift;
    if (!empty($s['teams'][$id]['meditating'])) {
        $s['teams'][$id]['meditating'] = false;
        $s['actionsLeft'] = 0;
        $s['phase'] = 'draw';
        fx($s, ['type' => 'massage', 'team' => $id, 'room' => $s['teams'][$id]['loc']]);
        addLog($s, teamName($s, $id) . ' is still in the chair massage. No actions this turn.', 'bad', 'Reception');
        reveal($s, 'crash', 'Chair massage', ['crash:' . $id], teamName($s, $id) . ' sits this turn out. Shoulders down, laptop closed.');
        return;
    }
    $minus = (int)($s['teams'][$id]['minus'] ?? 0);
    $why = [];
    if ($minus) { $why[] = 'timesheets'; $s['teams'][$id]['minus'] = 0; }
    $debt = (int)($s['teams'][$id]['debt'] ?? 0);
    if ($debt) { $minus += $debt; $why[] = 'handover'; $s['teams'][$id]['debt'] = 0; }
    if (effectActive($s, 'nointernet') && office($s['teams'][$id]['loc']) === 'ams') { $minus++; $why[] = 'no internet in AMS'; }
    $s['actionsLeft'] = max(1, $cfg['actionsPerTurn'] - $minus);
    $plus = (int)($s['teams'][$id]['gift'] ?? 0);
    if ($plus) { $s['actionsLeft'] += $plus; $why[] = '+' . $plus . ' covering a handover'; $s['teams'][$id]['gift'] = 0; }
    addLog($s, 'Your turn, ' . teamName($s, $id) . '.' . ($why ? ' ' . $s['actionsLeft'] . ' actions (' . implode(', ', $why) . ').' : ''), 'turn');
    reveal($s, 'turn', teamName($s, $id), [], 'One minute of team talk, then ' . $s['actionsLeft'] . ' actions.' . ($why ? ' (' . implode(', ', $why) . ')' : ''));
}

function resolveNews(array &$s, ?string $force = null): void {
    $cfg = config();
    if ($force === null) {
        if (empty($s['newsDeck'])) return;
        $id = array_shift($s['newsDeck']);
    } else {
        $id = $force;
        $s['newsDeck'] = array_values(array_diff($s['newsDeck'] ?? [], [$id]));
    }
    [$title, $text] = $cfg['news'][$id];
    $until = ($s['turnCount'] ?? 1) + count($s['order']);
    holdFx($s);
    switch ($id) {
    case 'defensie':
        burnRoom($s, 'dev', 2);
        break;
    case 'saudi':
        foreach ($s['teams'] as $t => $team) if (array_filter($team['hand'], fn($c) => roomOfCard($c))) $s['teams'][$t]['owe'] = 1;
        break;
    case 'thomas':
        $text = sprintf($text, $cfg['thomasPlaces'][array_rand($cfg['thomasPlaces'])]);
        $s['effects']['thomas'] = $until;
        break;
    case 'martin':
        foreach ($s['teams'] as $t => $team) {
            if ($team['loc'] !== 'alive') fx($s, ['type' => 'move', 'team' => (string)$t, 'pawn' => (string)$t, 'from' => $team['loc'], 'to' => 'alive', 'cross' => office($team['loc']) !== 'ams', 'kind' => 'martin']);
            $s['teams'][$t]['loc'] = 'alive';
        }
        $s['teams'] = array_map(function ($t) { $t['meditating'] = false; return $t; }, $s['teams']);
        producerSweep($s);
        break;
    case 'nointernet':
    case 'notrains':
        $s['effects'][$id] = $until;
        break;
    case 'lunch':
        foreach ($s['teams'] as $t => $team) {
            $d = !empty($cfg['rooms'][$team['loc']]['pantry']) ? -1 : 1;
            $s['teams'][$t]['stress'] = max(0, min($cfg['maxStress'], ($team['stress'] ?? 0) + $d));
        }
        break;
    case 'fiscal':
        foreach ($s['teams'] as $t => $_) $s['teams'][$t]['minus'] = 1;
        break;
    case 'launch':
        if (!empty($s['clock'])) $s['clock']['seconds'] -= 300;
        break;
    }
    $s['lastNews'] = ['id' => $id, 'title' => $title, 'text' => $text, 'turn' => $s['turnCount'] ?? 1];
    $s['newsText'][$id] = $text;
    addLog($s, 'BREAKING: ' . $title . '. ' . $text, 'bad', 'Studio Lead');
    [$f, $l] = snark('news');
    addLog($s, $l, 'snark', $f);
    $s['fxHold'] = false;
    reveal($s, 'news', 'Breaking news', ['n:' . $id], '');
    flushFx($s);
}

/* ================================================================== computer teams */

function pathTo(string $from, string $to): array {
    if ($from === $to) return [$from];
    $q = [[$from]];
    $seen = [$from => true];
    while ($q) {
        $p = array_shift($q);
        foreach (neighbours(end($p)) as $n) {
            if (isset($seen[$n])) continue;
            $np = array_merge($p, [$n]);
            if ($n === $to) return $np;
            $seen[$n] = true;
            $q[] = $np;
        }
    }
    return [$from];
}

/** One computer step. Returns true when it changed the state. */
function botStep(array &$s): bool {
    $cfg = config();
    // any computer team over the hand limit discards first (even off-turn)
    foreach ($s['teams'] as $id => $t) {
        $id = (string)$id;
        if (empty($t['bot']) || (count($t['hand']) <= $cfg['handLimit'] && empty($t['owe']))) continue;
        $card = botWorstCard($s, $id);
        doAction($s, $id, 'discard', ['card' => $card]);
        return true;
    }
    $me = activeTeam($s);
    if ($me === null || empty($s['teams'][$me]['bot'])) return false;
    $T = $s['teams'][$me];

    if ($s['phase'] === 'draw') { doAction($s, $me, 'draw', []); return true; }
    if ($s['phase'] === 'infect') {
        if (flipBlocker($s) !== null) return false; // wait for humans to discard
        doAction($s, $me, 'infect', []);
        return true;
    }

    $loc = $T['loc'];
    $try = function (string $type, array $p) use (&$s, $me) {
        try { doAction($s, $me, $type, $p); return true; } catch (GameError $e) { return false; }
    };

    // 1. ship a fix
    foreach ($cfg['colors'] as $c => $_) {
        if ($s['cured'][$c]) continue;
        $have = count(array_filter($T['hand'], fn($x) => roomOfCard($x) && roomColor(roomOfCard($x)) === $c));
        if ($have >= fixNeed($T)) {
            if (in_array($loc, $s['warRooms'], true)) { if ($try('cure', ['color' => $c])) return true; }
            $best = null;
            foreach ($s['warRooms'] as $w) { $p = pathTo($loc, $w); if (!$best || count($p) < count($best)) $best = $p; }
            if ($best && count($best) > 1) {
                if (count($best) > 3 && hasCard($s, $me, 'r:' . end($best)) && $try('direct', ['to' => end($best)])) return true;
                if ($try('walk', ['to' => $best[1]])) return true;
            }
        }
    }
    // 2. calm down the hottest colour at this desk
    $here = $s['fires'][$loc] ?? [];
    arsort($here);
    foreach ($here as $c => $n) if ($n > 0 && $try('treat', ['color' => $c])) return true;

    // 3. coffee when it is a good moment
    if (!$s['espressoUsed'] && $T['stress'] < 2 && $s['actionsLeft'] <= 2 && mt_rand(1, 3) === 1 && $try('espresso', [])) return true;

    // 4. breather in a pantry, dashboard before a handover hits
    if (!empty($cfg['rooms'][$loc]['pantry']) && $T['stress'] >= 2 && $try('breather', [])) return true;
    if (($T['dashAge'] ?? 0) >= $cfg['dashboardEvery'] - 1 && $s['actionsLeft'] <= 2 && empty($T['dashDone']) && $try('dashboard', [])) return true;

    // 5. move toward the most stressed desk (3s first, then closest)
    $target = null; $score = -1;
    foreach ($s['fires'] as $room => $f) {
        $m = max($f);
        if ($m <= 0 || $room === $loc) continue;
        $d = count(pathTo($loc, $room));
        $sc = $m * 10 - $d;
        if ($sc > $score) { $score = $sc; $target = $room; }
    }
    if ($target) {
        $p = pathTo($loc, $target);
        if (count($p) > 3 && hasCard($s, $me, 'r:' . $target) && $s['fires'][$target] && max($s['fires'][$target]) >= 3 && $try('direct', ['to' => $target])) return true;
        if (count($p) > 1 && $try('walk', ['to' => $p[1]])) return true;
    }
    doAction($s, $me, 'end_actions', []);
    return true;
}

function botWorstCard(array $s, string $id): string {
    $hand = $s['teams'][$id]['hand'];
    $count = [];
    foreach ($hand as $c) if ($r = roomOfCard($c)) $count[roomColor($r)] = ($count[roomColor($r)] ?? 0) + 1;
    $worst = $hand[0]; $low = 99;
    foreach ($hand as $c) {
        $r = roomOfCard($c);
        $v = $r ? (($s['cured'][roomColor($r)] ?? false) ? -1 : $count[roomColor($r)]) : 50;
        if ($v < $low) { $low = $v; $worst = $c; }
    }
    return $worst;
}

/* ================================================================== game master + lobby */

function gmAction(array &$s, string $type, array $p): bool {
    switch ($type) {
    case 'join': {
        $id = (string)(int)($p['team'] ?? 0);
        if ((int)$id < 1 || (int)$id > 4) throw new GameError('Pick team 1 to 4.');
        if ($s['status'] !== 'lobby' && !isset($s['teams'][$id])) throw new GameError('The game already started.');
        $bot = !empty($p['bot']);
        $botNames = ['1' => 'Autopilot', '2' => 'The Interns', '3' => 'The Freelance Pool', '4' => 'Timesheet Bots'];
        $name = trim(mb_substr((string)($p['name'] ?? ''), 0, 28)) ?: ($bot ? $botNames[$id] : 'Team ' . $id);
        $prev = $s['teams'][$id] ?? [];
        $s['teams'][$id] = array_merge($prev, [
            'name' => $name,
            'members' => trim(mb_substr((string)($p['members'] ?? ($bot ? 'computer' : '')), 0, 80)),
            'bot' => $bot,
            'amsterdam' => !empty($p['amsterdam']),
        ]);
        if ($s['status'] === 'lobby') addLog($s, $name . ' joined' . ($bot ? ' (computer).' : '.'));
        return true;
    }
    case 'set_bot': {
        $id = (string)(int)($p['team'] ?? 0);
        requireTeam($s, $id);
        $s['teams'][$id]['bot'] = !empty($p['bot']);
        $s['botAt'] = microtime(true) + 1;
        addLog($s, teamName($s, $id) . ($s['teams'][$id]['bot'] ? ' is now played by the computer.' : ' is back in human hands.'));
        return true;
    }
    case 'leave': {
        if ($s['status'] !== 'lobby') throw new GameError('Only in the lobby.');
        unset($s['teams'][(string)(int)($p['team'] ?? 0)]);
        return true;
    }
    case 'start':
        if ($s['status'] === 'playing') throw new GameError('Already running.');
        startGame($s, $p);
        $s['tutorial'] = ['on' => false, 'step' => 0];
        return true;
    case 'reset': {
        $teams = !empty($p['keepTeams']) ? ($s['teams'] ?? []) : [];
        foreach ($teams as &$t) unset($t['role'], $t['loc'], $t['hand'], $t['stress'], $t['meditating'], $t['minus'], $t['owe'], $t['dashAge'], $t['dashDone'], $t['cookies'], $t['debt'], $t['gift']);
        unset($t);
        $settings = $s['settings'] ?? ['fridays' => 4, 'minutes' => 45];
        $sound = $s['sound'] ?? true;
        $v = $s['v'];
        $s = emptyState();
        $s['v'] = $v;
        $s['teams'] = $teams;
        $s['settings'] = $settings;
        $s['sound'] = $sound;
        return true;
    }
    case 'pause':
        if (empty($s['clock']) || $s['clock']['pausedAt'] || $s['clock']['stoppedAt']) return false;
        $s['clock']['pausedAt'] = time();
        addLog($s, 'The clock is paused. Everyone checks Slack.');
        return true;
    case 'resume':
        if (empty($s['clock']) || !$s['clock']['pausedAt']) return false;
        $s['clock']['pausedTotal'] += time() - $s['clock']['pausedAt'];
        $s['clock']['pausedAt'] = null;
        addLog($s, 'The clock is running again.');
        return true;
    case 'add_time':
        if (empty($s['clock'])) return false;
        $s['clock']['seconds'] += (int)($p['seconds'] ?? 300);
        addLog($s, 'The client moved the go-live. Do not ask why.', 'info', 'Client');
        return true;
    case 'news':
        requirePlaying($s);
        $id = (string)($p['id'] ?? '');
        if ($id !== '' && !isset(config()['news'][$id])) throw new GameError('Unknown news card.');
        if ($id === '' && empty($s['newsDeck'])) throw new GameError('No breaking news left.');
        resolveNews($s, $id === '' ? null : $id);
        return true;
    case 'tutorial':
        $s['tutorial'] = ['on' => !empty($p['on']), 'step' => max(0, min(20, (int)($p['step'] ?? 0)))];
        return true;
    case 'speed':
        $s['settings']['botDelay'] = max(0, min(10, (float)($p['botDelay'] ?? 3)));
        return true;
    case 'sound':
        $s['sound'] = !empty($p['on']);
        return true;
    case 'skip_turn':
        requirePlaying($s);
        addLog($s, 'The Game Master skips to the next team.');
        nextTurn($s);
        return true;
    case 'gm_fire': {
        requirePlaying($s);
        $room = (string)($p['room'] ?? '');
        $color = (string)($p['color'] ?? '');
        if (!isset($s['fires'][$room][$color]) || config()['rooms'][$room]['special']) throw new GameError('Unknown desk or colour.');
        if ((int)($p['delta'] ?? 0) > 0) {
            if ($s['fires'][$room][$color] < 3 && $s['supply'][$color] > 0) { $s['fires'][$room][$color]++; $s['supply'][$color]--; }
        } else removeTokens($s, $room, $color, 1);
        return true;
    }
    }
    return false;
}

const GM_TYPES = ['join', 'set_bot', 'leave', 'start', 'reset', 'pause', 'resume', 'add_time', 'skip_turn', 'gm_fire', 'news', 'tutorial', 'sound', 'speed'];
const NO_HISTORY = ['pause', 'resume', 'reset', 'join', 'leave', 'set_bot', 'tutorial', 'sound', 'speed'];

/* ================================================================== router */

function respond($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$a = $_GET['a'] ?? 'state';

try {
    if ($a === 'config') respond(config());

    if ($a === 'state') {
        $since = (int)($_GET['since'] ?? 0);
        $out = withState(function (array &$s) use ($since) {
            if ($s['status'] === 'playing' && clockLeft($s) <= 0) {
                $s['v']++;
                lose($s, 'It is 17:30 and the site is still not live. Borrel cancelled.');
            }
            if ($s['status'] === 'playing' && empty($s['tutorial']['on']) && microtime(true) >= ($s['botAt'] ?? 0)) {
                $snapshot = $s;
                unset($snapshot['history']);
                try {
                    if (botStep($s)) {
                        $s['history'][] = $snapshot;
                        if (count($s['history']) > HISTORY_MAX) $s['history'] = array_slice($s['history'], -HISTORY_MAX);
                        $phase = $s['phase'] ?? '';
                        $s['botAt'] = microtime(true) + botDelay($s) * ($phase === 'actions' ? 1 : 1.8);
                        $s['v']++;
                    }
                } catch (GameError $e) {
                    $s = $snapshot + ['history' => $s['history'] ?? []];
                    $s['botAt'] = microtime(true) + 3;
                }
            }
            if ($since && $since === $s['v']) return ['same' => true, 'v' => $s['v'], 'clockLeft' => clockLeft($s)];
            return publicState($s);
        });
        respond($out);
    }

    if ($a === 'act') {
        $p = json_decode(file_get_contents('php://input'), true);
        if (!is_array($p)) throw new GameError('Bad request.');
        $type = (string)($p['type'] ?? '');
        $team = (string)($p['team'] ?? '');
        $out = withState(function (array &$s) use ($type, $team, $p) {
            if ($type === 'undo') {
                if (empty($s['history'])) throw new GameError('Nothing to undo.');
                $prev = array_pop($s['history']);
                $hist = $s['history'];
                $v = $s['v'];
                $s = $prev;
                $s['history'] = $hist;
                $s['v'] = $v + 1;
                $s['botAt'] = microtime(true) + 4;
                addLog($s, 'The Game Master rewinds the last step. Nobody saw anything.');
                return publicState($s);
            }
            $snapshot = $s;
            unset($snapshot['history']);
            $changed = gmAction($s, $type, $p);
            if (!$changed && !in_array($type, GM_TYPES, true)) {
                doAction($s, $team, $type, $p);
                $changed = true;
            }
            if ($changed) {
                if (!in_array($type, NO_HISTORY, true)) {
                    $s['history'][] = $snapshot;
                    if (count($s['history']) > HISTORY_MAX) $s['history'] = array_slice($s['history'], -HISTORY_MAX);
                }
                if ($type === 'reset') $s['history'] = [];
                if (!in_array($type, ['join', 'leave', 'set_bot', 'start'], true)) $s['botAt'] = max($s['botAt'] ?? 0, microtime(true) + 1.2);
                $s['v']++;
            }
            return publicState($s);
        });
        respond(['ok' => true, 'state' => $out]);
    }

    respond(['ok' => false, 'error' => 'Unknown endpoint'], 404);
} catch (GameError $e) {
    respond(['ok' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    respond(['ok' => false, 'error' => 'Server error: ' . $e->getMessage()], 500);
}
