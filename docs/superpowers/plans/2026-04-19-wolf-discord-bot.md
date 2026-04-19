# Discord 人狼Bot 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discord上で複数サーバーに対応した人狼ゲーム自動進行Botを構築する

**Architecture:** モノリシック構成。GameManagerがguild_idをキーに複数のGameSessionを並行管理。役職はroles.jsonのデータとして定義し、RoleHandlerが汎用処理する。夜処理は6段階の固定順序で実行。

**Tech Stack:** TypeScript, discord.js v14, better-sqlite3, winston, Jest, Railway

---

## ファイル構成

```
wolf-discord/
├── src/
│   ├── bot.ts
│   ├── deploy-commands.ts
│   ├── types.ts
│   ├── commands/
│   │   ├── start.ts
│   │   ├── setup.ts
│   │   ├── admin.ts
│   │   ├── logs.ts
│   │   └── spectate.ts
│   ├── game/
│   │   ├── GameManager.ts
│   │   ├── GameSession.ts
│   │   ├── PhaseEngine.ts
│   │   ├── NightEngine.ts
│   │   ├── VoteEngine.ts
│   │   └── WinChecker.ts
│   ├── roles/
│   │   ├── roles.json
│   │   └── RoleHandler.ts
│   ├── ui/
│   │   ├── ButtonBuilder.ts
│   │   └── EmbedBuilder.ts
│   ├── db/
│   │   └── Database.ts
│   └── utils/
│       ├── logger.ts
│       └── timer.ts
├── config/
│   └── defaults.json
├── tests/
│   ├── VoteEngine.test.ts
│   ├── NightEngine.test.ts
│   ├── WinChecker.test.ts
│   ├── RoleHandler.test.ts
│   └── GameSession.test.ts
├── .env
├── .env.example
├── .gitignore
├── railway.toml
├── package.json
└── tsconfig.json
```

---

## Task 1: プロジェクト初期設定

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `config/defaults.json`

- [ ] **Step 1: package.jsonを作成する**

```json
{
  "name": "wolf-discord",
  "version": "1.0.0",
  "main": "dist/bot.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/bot.js",
    "dev": "tsx watch src/bot.ts",
    "deploy": "tsx src/deploy-commands.ts",
    "test": "jest"
  },
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "discord.js": "^14.14.1",
    "dotenv": "^16.4.5",
    "winston": "^3.13.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.10",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.12.7",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "tsx": "^4.7.3",
    "typescript": "^5.4.5"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.ts"]
  }
}
```

- [ ] **Step 2: tsconfig.jsonを作成する**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: .gitignoreを作成する**

```
node_modules/
dist/
.env
*.db
*.db-journal
```

- [ ] **Step 4: .env.exampleを作成する**

```
BOT_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_application_client_id_here
GUILD_ID=your_dev_guild_id_here
NODE_ENV=development
LOG_LEVEL=debug
```

- [ ] **Step 5: config/defaults.jsonを作成する**

```json
{
  "dayDuration": 300,
  "nightDuration": 120,
  "voteDuration": 60,
  "maxRevotes": 2,
  "tieDeath": "random",
  "anonymousVote": false,
  "revealRoleOnDeath": true
}
```

- [ ] **Step 6: .envを作成してトークンを設定する**

```
BOT_TOKEN=（Discord Developer PortalのBotトークンを貼る）
CLIENT_ID=（Developer PortalのアプリケーションIDを貼る）
GUILD_ID=（テスト用サーバーのIDを貼る）
NODE_ENV=development
LOG_LEVEL=debug
```

CLIENT_IDの取得方法: Discord Developer Portal → アプリ → General Information → Application ID

- [ ] **Step 7: 依存関係をインストールする**

```bash
npm install
```

期待出力: `added NNN packages`

- [ ] **Step 8: コミットする**

```bash
git init
git add package.json tsconfig.json .gitignore .env.example config/defaults.json
git commit -m "feat: initialize project scaffold"
```

---

## Task 2: 共通型定義

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: src/types.tsを作成する**

```typescript
export type Team = 'village' | 'werewolf' | 'fox' | 'solo';
export type EffectType =
  | 'reveal_role'
  | 'reveal_team'
  | 'protect'
  | 'kill'
  | 'copy_role'
  | 'transform'
  | 'curse'
  | 'vote_weight'
  | 'extra_action'
  | 'block_action'
  | 'revive'
  | 'custom';
export type GameState = 'waiting' | 'playing' | 'ended';
export type PhaseType = 'day' | 'night';

export interface RoleDef {
  id: string;
  name: string;
  team: Team;
  description: string;
  timing: 'night' | 'day' | 'always' | 'none';
  hasTarget: boolean;
  priority: number;
  winCondition: string;
  effect: {
    type: EffectType;
    targetFilter?: 'any' | 'alive' | 'dead' | 'village' | 'werewolf' | 'fox';
    [key: string]: unknown;
  };
}

export interface Player {
  userId: string;
  roleId: string;
  isAlive: boolean;
  deathPhase?: string;
  deathCause?: string;
  isProtected: boolean;
  isCursed: boolean;
  voteWeight: number;
  isBlocked: boolean;
}

export interface GameSettings {
  dayDuration: number;
  nightDuration: number;
  voteDuration: number;
  maxRevotes: number;
  tieDeath: 'random' | 'none';
  anonymousVote: boolean;
  revealRoleOnDeath: boolean;
}

export interface NightAction {
  actorId: string;
  targetId: string | null;
  roleId: string;
  priority: number;
}

export interface VoteRecord {
  voterId: string;
  targetId: string;
}

export interface VoteResult {
  targetId: string;
  count: number;
  voters: string[];
}

export interface NightResult {
  killed: string[];
  notifications: Map<string, string>;
}
```

- [ ] **Step 2: コミットする**

```bash
git add src/types.ts
git commit -m "feat: add shared type definitions"
```

---

## Task 3: ロガー & タイマー

**Files:**
- Create: `src/utils/logger.ts`
- Create: `src/utils/timer.ts`

- [ ] **Step 1: src/utils/logger.tsを作成する**

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
```

- [ ] **Step 2: src/utils/timer.tsを作成する**

```typescript
import { TextChannel } from 'discord.js';
import logger from './logger';

export class GameTimer {
  private timeout: NodeJS.Timeout | null = null;
  private warningTimeout: NodeJS.Timeout | null = null;

  start(
    durationSec: number,
    channel: TextChannel,
    label: string,
    onEnd: () => void
  ): void {
    this.clear();

    if (durationSec > 30) {
      this.warningTimeout = setTimeout(() => {
        channel.send(`⏰ **${label}** 残り30秒`).catch((e) => logger.warn('timer warning send failed', { e }));
      }, (durationSec - 30) * 1000);
    }

    this.timeout = setTimeout(() => {
      logger.debug('timer expired', { label });
      onEnd();
    }, durationSec * 1000);
  }

  clear(): void {
    if (this.timeout) { clearTimeout(this.timeout); this.timeout = null; }
    if (this.warningTimeout) { clearTimeout(this.warningTimeout); this.warningTimeout = null; }
  }
}
```

- [ ] **Step 3: コミットする**

```bash
git add src/utils/logger.ts src/utils/timer.ts
git commit -m "feat: add logger and timer utilities"
```

---

## Task 4: データベース

**Files:**
- Create: `src/db/Database.ts`

- [ ] **Step 1: src/db/Database.tsを作成する**

```typescript
import BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import logger from '../utils/logger';

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data.db');

let db: BetterSqlite3.Database;

export function getDb(): BetterSqlite3.Database {
  if (!db) {
    db = new BetterSqlite3(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
    logger.info('database initialized', { path: DB_PATH });
  }
  return db;
}

function initSchema(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'waiting',
      phase TEXT NOT NULL DEFAULT 'day',
      day INTEGER NOT NULL DEFAULT 0,
      host_id TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT,
      winner_team TEXT
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL DEFAULT '',
      is_alive INTEGER NOT NULL DEFAULT 1,
      death_phase TEXT,
      death_cause TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      voter_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      day INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (game_id) REFERENCES games(id)
    );

    CREATE TABLE IF NOT EXISTS night_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      target_id TEXT,
      role_id TEXT NOT NULL,
      night INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (game_id) REFERENCES games(id)
    );

    CREATE TABLE IF NOT EXISTS game_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (game_id) REFERENCES games(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      guild_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (guild_id, key)
    );
  `);
}

export function logEvent(gameId: string, eventType: string, payload: object): void {
  const db = getDb();
  db.prepare(
    'INSERT INTO game_logs (game_id, event_type, payload) VALUES (?, ?, ?)'
  ).run(gameId, eventType, JSON.stringify(payload));
}

export function getSetting(guildId: string, key: string, defaultValue: string): string {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE guild_id = ? AND key = ?')
    .get(guildId, key) as { value: string } | undefined;
  return row?.value ?? defaultValue;
}

export function setSetting(guildId: string, key: string, value: string): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (guild_id, key, value) VALUES (?, ?, ?)')
    .run(guildId, key, value);
}
```

- [ ] **Step 2: コミットする**

```bash
git add src/db/Database.ts
git commit -m "feat: add SQLite database with schema"
```

---

## Task 5: 役職データ (roles.json)

**Files:**
- Create: `src/roles/roles.json`

- [ ] **Step 1: src/roles/roles.jsonを作成する**

priority は夜処理段階に対応: 1=状態変更, 2=防御, 3=攻撃, 4=判定, 5=死亡確定, 6=通知（通知はエンジンが行うため6は未使用）

```json
[
  {
    "id": "villager",
    "name": "村人",
    "team": "village",
    "description": "特別な能力を持たない村人。昼に投票で人狼を追放する。",
    "timing": "none",
    "hasTarget": false,
    "priority": 0,
    "winCondition": "すべての人狼を追放する",
    "effect": { "type": "custom" }
  },
  {
    "id": "werewolf",
    "name": "人狼",
    "team": "werewolf",
    "description": "毎夜1人を襲撃する。人狼同士はお互いを認識できる。",
    "timing": "night",
    "hasTarget": true,
    "priority": 3,
    "winCondition": "村人陣営の人数が人狼以下になる",
    "effect": { "type": "kill", "targetFilter": "alive" }
  },
  {
    "id": "seer",
    "name": "占い師",
    "team": "village",
    "description": "毎夜1人の陣営（人狼か否か）を占える。",
    "timing": "night",
    "hasTarget": true,
    "priority": 4,
    "winCondition": "すべての人狼を追放する",
    "effect": { "type": "reveal_team", "targetFilter": "alive" }
  },
  {
    "id": "medium",
    "name": "霊媒師",
    "team": "village",
    "description": "昼に処刑されたプレイヤーの役職が分かる（自動発動）。",
    "timing": "day",
    "hasTarget": false,
    "priority": 4,
    "winCondition": "すべての人狼を追放する",
    "effect": { "type": "reveal_role", "targetFilter": "dead" }
  },
  {
    "id": "knight",
    "name": "騎士",
    "team": "village",
    "description": "毎夜1人を人狼の襲撃から守る。連続して同じ人は守れない。",
    "timing": "night",
    "hasTarget": true,
    "priority": 2,
    "winCondition": "すべての人狼を追放する",
    "effect": { "type": "protect", "targetFilter": "alive", "noContinuous": true }
  },
  {
    "id": "mason",
    "name": "共有者",
    "team": "village",
    "description": "ゲーム開始時にもう1人の共有者を知ることができる。",
    "timing": "always",
    "hasTarget": false,
    "priority": 0,
    "winCondition": "すべての人狼を追放する",
    "effect": { "type": "custom", "special": "reveal_team_members" }
  },
  {
    "id": "madman",
    "name": "狂人",
    "team": "werewolf",
    "description": "人間だが人狼陣営に属する。占われると人間と出る。",
    "timing": "none",
    "hasTarget": false,
    "priority": 0,
    "winCondition": "村人陣営の人数が人狼以下になる",
    "effect": { "type": "custom", "appearsAs": "village" }
  },
  {
    "id": "fox",
    "name": "妖狐",
    "team": "fox",
    "description": "人狼に襲撃されても死なない。占い師に占われると呪い死する。ゲーム終了時に生存していれば勝利。",
    "timing": "always",
    "hasTarget": false,
    "priority": 0,
    "winCondition": "ゲーム終了時に生存している",
    "effect": { "type": "custom", "special": "fox" }
  },
  {
    "id": "heretic",
    "name": "背徳者",
    "team": "fox",
    "description": "妖狐の仲間。妖狐が死亡すると自分も死亡する。",
    "timing": "always",
    "hasTarget": false,
    "priority": 0,
    "winCondition": "妖狐と共にゲーム終了時に生存している",
    "effect": { "type": "custom", "special": "heretic" }
  },
  {
    "id": "bakeneko",
    "name": "猫又",
    "team": "village",
    "description": "人狼に襲撃されて死亡すると、人狼陣営の1人をランダムに道連れにする。",
    "timing": "always",
    "hasTarget": false,
    "priority": 5,
    "winCondition": "すべての人狼を追放する",
    "effect": { "type": "custom", "special": "bakeneko" }
  },
  {
    "id": "fanatic",
    "name": "狂信者",
    "team": "werewolf",
    "description": "人狼陣営だが人狼の仲間は分からない。占われると人間と出る。夜に行動はない。",
    "timing": "none",
    "hasTarget": false,
    "priority": 0,
    "winCondition": "村人陣営の人数が人狼以下になる",
    "effect": { "type": "custom", "appearsAs": "village" }
  },
  {
    "id": "hunter",
    "name": "狩人",
    "team": "village",
    "description": "処刑時に道連れにする対象を指定できる（昼投票後に発動）。",
    "timing": "day",
    "hasTarget": true,
    "priority": 3,
    "winCondition": "すべての人狼を追放する",
    "effect": { "type": "kill", "targetFilter": "alive", "trigger": "on_execution" }
  },
  {
    "id": "doctor",
    "name": "医者",
    "team": "village",
    "description": "毎夜1人を死亡から守る（自分も可）。",
    "timing": "night",
    "hasTarget": true,
    "priority": 2,
    "winCondition": "すべての人狼を追放する",
    "effect": { "type": "protect", "targetFilter": "alive", "canTargetSelf": true }
  },
  {
    "id": "detective",
    "name": "探偵",
    "team": "village",
    "description": "毎夜1人の正確な役職名を調べることができる。",
    "timing": "night",
    "hasTarget": true,
    "priority": 4,
    "winCondition": "すべての人狼を追放する",
    "effect": { "type": "reveal_role", "targetFilter": "alive" }
  },
  {
    "id": "hamster",
    "name": "ハムスター人間",
    "team": "village",
    "description": "占い師に占われると村人と出る。人狼に噛まれても死なない。",
    "timing": "always",
    "hasTarget": false,
    "priority": 0,
    "winCondition": "すべての人狼を追放する",
    "effect": { "type": "custom", "special": "hamster", "appearsAs": "village", "immuneToWerewolf": true }
  },
  {
    "id": "cursed_wolf_father",
    "name": "呪狼",
    "team": "werewolf",
    "description": "占い師に占われると人狼と出る（通常の人狼と同じ）。噛んだ村人を人狼に変える。",
    "timing": "night",
    "hasTarget": true,
    "priority": 3,
    "winCondition": "村人陣営の人数が人狼以下になる",
    "effect": { "type": "custom", "special": "cursed_wolf_father" }
  },
  {
    "id": "traitor",
    "name": "裏切り者",
    "team": "village",
    "description": "最初は村人陣営だが、人狼が全滅すると人狼陣営に寝返る。",
    "timing": "none",
    "hasTarget": false,
    "priority": 0,
    "winCondition": "人狼と共に勝利する（人狼全滅後）",
    "effect": { "type": "custom", "special": "traitor" }
  },
  {
    "id": "seer_werewolf",
    "name": "賢狼",
    "team": "werewolf",
    "description": "毎夜1人の陣営を占える人狼。",
    "timing": "night",
    "hasTarget": true,
    "priority": 4,
    "winCondition": "村人陣営の人数が人狼以下になる",
    "effect": { "type": "reveal_team", "targetFilter": "alive" }
  },
  {
    "id": "blocker",
    "name": "霊能者",
    "team": "village",
    "description": "毎夜1人の行動を封じる。",
    "timing": "night",
    "hasTarget": true,
    "priority": 1,
    "winCondition": "すべての人狼を追放する",
    "effect": { "type": "block_action", "targetFilter": "alive" }
  },
  {
    "id": "reviver",
    "name": "呪術師",
    "team": "village",
    "description": "1度だけ死亡したプレイヤーを蘇生できる。",
    "timing": "night",
    "hasTarget": true,
    "priority": 5,
    "winCondition": "すべての人狼を追放する",
    "effect": { "type": "revive", "targetFilter": "dead", "usesLeft": 1 }
  }
]
```

- [ ] **Step 2: コミットする**

```bash
git add src/roles/roles.json
git commit -m "feat: add initial role definitions (20 roles)"
```

---

## Task 6: RoleHandler（役職能力汎用エンジン）

**Files:**
- Create: `src/roles/RoleHandler.ts`
- Create: `tests/RoleHandler.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/RoleHandler.test.ts
import { RoleHandler } from '../src/roles/RoleHandler';
import { Player, NightAction } from '../src/types';

const makePlayer = (userId: string, roleId: string, isAlive = true): Player => ({
  userId,
  roleId,
  isAlive,
  isProtected: false,
  isCursed: false,
  voteWeight: 1,
  isBlocked: false,
});

describe('RoleHandler', () => {
  let handler: RoleHandler;

  beforeEach(() => {
    handler = new RoleHandler();
  });

  test('getRoleDef returns role definition by id', () => {
    const def = handler.getRoleDef('seer');
    expect(def).toBeDefined();
    expect(def!.name).toBe('占い師');
  });

  test('getRoleDef returns undefined for unknown id', () => {
    expect(handler.getRoleDef('unknown_role')).toBeUndefined();
  });

  test('getAllRoles returns all loaded roles', () => {
    const roles = handler.getAllRoles();
    expect(roles.length).toBeGreaterThan(0);
    expect(roles.find(r => r.id === 'villager')).toBeDefined();
  });

  test('getTeam returns correct team for werewolf', () => {
    const player = makePlayer('u1', 'werewolf');
    expect(handler.getTeam(player)).toBe('werewolf');
  });

  test('getTeam returns village for villager', () => {
    const player = makePlayer('u1', 'villager');
    expect(handler.getTeam(player)).toBe('village');
  });

  test('appearsAs returns village for madman when checked by seer', () => {
    const player = makePlayer('u1', 'madman');
    expect(handler.appearsAs(player)).toBe('village');
  });

  test('appearsAs returns werewolf for werewolf', () => {
    const player = makePlayer('u1', 'werewolf');
    expect(handler.appearsAs(player)).toBe('werewolf');
  });

  test('canAct returns true for seer at night', () => {
    const player = makePlayer('u1', 'seer');
    expect(handler.canAct(player, 'night')).toBe(true);
  });

  test('canAct returns false for villager', () => {
    const player = makePlayer('u1', 'villager');
    expect(handler.canAct(player, 'night')).toBe(false);
  });

  test('canAct returns false for blocked player', () => {
    const player = makePlayer('u1', 'seer');
    player.isBlocked = true;
    expect(handler.canAct(player, 'night')).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest tests/RoleHandler.test.ts --no-coverage
```

期待出力: `FAIL` (RoleHandler not found)

- [ ] **Step 3: src/roles/RoleHandler.tsを作成する**

```typescript
import rolesData from './roles.json';
import { RoleDef, Player, PhaseType, Team } from '../types';

export class RoleHandler {
  private roles: Map<string, RoleDef>;

  constructor() {
    this.roles = new Map(
      (rolesData as RoleDef[]).map((r) => [r.id, r])
    );
  }

  getRoleDef(roleId: string): RoleDef | undefined {
    return this.roles.get(roleId);
  }

  getAllRoles(): RoleDef[] {
    return [...this.roles.values()];
  }

  getTeam(player: Player): Team {
    return this.roles.get(player.roleId)?.team ?? 'village';
  }

  appearsAs(player: Player): Team {
    const role = this.roles.get(player.roleId);
    if (!role) return 'village';
    const appearsAs = role.effect['appearsAs'] as Team | undefined;
    return appearsAs ?? role.team;
  }

  canAct(player: Player, phase: PhaseType): boolean {
    if (!player.isAlive) return false;
    if (player.isBlocked) return false;
    const role = this.roles.get(player.roleId);
    if (!role) return false;
    return role.timing === phase || role.timing === 'always';
  }

  hasTarget(roleId: string): boolean {
    return this.roles.get(roleId)?.hasTarget ?? false;
  }

  getPriority(roleId: string): number {
    return this.roles.get(roleId)?.priority ?? 0;
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest tests/RoleHandler.test.ts --no-coverage
```

期待出力: `PASS`

- [ ] **Step 5: コミットする**

```bash
git add src/roles/RoleHandler.ts tests/RoleHandler.test.ts
git commit -m "feat: add RoleHandler with generic role engine"
```

---

## Task 7: VoteEngine（投票・同票処理）

**Files:**
- Create: `src/game/VoteEngine.ts`
- Create: `tests/VoteEngine.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/VoteEngine.test.ts
import { VoteEngine } from '../src/game/VoteEngine';

describe('VoteEngine', () => {
  let engine: VoteEngine;

  beforeEach(() => {
    engine = new VoteEngine();
  });

  test('castVote registers a vote', () => {
    engine.castVote('voter1', 'target1');
    expect(engine.getVotes().get('voter1')).toBe('target1');
  });

  test('castVote overwrites previous vote', () => {
    engine.castVote('voter1', 'target1');
    engine.castVote('voter1', 'target2');
    expect(engine.getVotes().get('voter1')).toBe('target2');
  });

  test('tally returns correct vote counts', () => {
    engine.castVote('v1', 'a');
    engine.castVote('v2', 'a');
    engine.castVote('v3', 'b');
    const results = engine.tally();
    expect(results.find(r => r.targetId === 'a')?.count).toBe(2);
    expect(results.find(r => r.targetId === 'b')?.count).toBe(1);
  });

  test('getTopVoted returns single winner', () => {
    engine.castVote('v1', 'a');
    engine.castVote('v2', 'a');
    engine.castVote('v3', 'b');
    const top = engine.getTopVoted();
    expect(top).toEqual(['a']);
  });

  test('getTopVoted returns multiple on tie', () => {
    engine.castVote('v1', 'a');
    engine.castVote('v2', 'b');
    const top = engine.getTopVoted();
    expect(top).toHaveLength(2);
    expect(top).toContain('a');
    expect(top).toContain('b');
  });

  test('isTie returns true when tied', () => {
    engine.castVote('v1', 'a');
    engine.castVote('v2', 'b');
    expect(engine.isTie()).toBe(true);
  });

  test('isTie returns false when clear winner', () => {
    engine.castVote('v1', 'a');
    engine.castVote('v2', 'a');
    engine.castVote('v3', 'b');
    expect(engine.isTie()).toBe(false);
  });

  test('reset clears all votes', () => {
    engine.castVote('v1', 'a');
    engine.reset();
    expect(engine.getVotes().size).toBe(0);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest tests/VoteEngine.test.ts --no-coverage
```

期待出力: `FAIL`

- [ ] **Step 3: src/game/VoteEngine.tsを作成する**

```typescript
import { VoteRecord, VoteResult } from '../types';

export class VoteEngine {
  private votes: Map<string, string> = new Map();

  castVote(voterId: string, targetId: string): void {
    this.votes.set(voterId, targetId);
  }

  getVotes(): Map<string, string> {
    return new Map(this.votes);
  }

  tally(): VoteResult[] {
    const counts = new Map<string, string[]>();
    for (const [voterId, targetId] of this.votes) {
      if (!counts.has(targetId)) counts.set(targetId, []);
      counts.get(targetId)!.push(voterId);
    }
    return [...counts.entries()]
      .map(([targetId, voters]) => ({ targetId, count: voters.length, voters }))
      .sort((a, b) => b.count - a.count);
  }

  getTopVoted(): string[] {
    const results = this.tally();
    if (results.length === 0) return [];
    const max = results[0].count;
    return results.filter(r => r.count === max).map(r => r.targetId);
  }

  isTie(): boolean {
    return this.getTopVoted().length > 1;
  }

  reset(): void {
    this.votes.clear();
  }

  getRecords(): VoteRecord[] {
    return [...this.votes.entries()].map(([voterId, targetId]) => ({ voterId, targetId }));
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest tests/VoteEngine.test.ts --no-coverage
```

期待出力: `PASS`

- [ ] **Step 5: コミットする**

```bash
git add src/game/VoteEngine.ts tests/VoteEngine.test.ts
git commit -m "feat: add VoteEngine with tie detection"
```

---

## Task 8: WinChecker（勝利判定）

**Files:**
- Create: `src/game/WinChecker.ts`
- Create: `tests/WinChecker.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/WinChecker.test.ts
import { WinChecker } from '../src/game/WinChecker';
import { RoleHandler } from '../src/roles/RoleHandler';
import { Player } from '../src/types';

const makePlayer = (userId: string, roleId: string, isAlive = true): Player => ({
  userId, roleId, isAlive,
  isProtected: false, isCursed: false, voteWeight: 1, isBlocked: false,
});

describe('WinChecker', () => {
  let checker: WinChecker;
  let handler: RoleHandler;

  beforeEach(() => {
    handler = new RoleHandler();
    checker = new WinChecker(handler);
  });

  test('werewolf wins when alive werewolves >= alive villagers', () => {
    const players = [
      makePlayer('w1', 'werewolf'),
      makePlayer('v1', 'villager'),
    ];
    expect(checker.check(players)).toBe('werewolf');
  });

  test('village wins when all werewolves are dead', () => {
    const players = [
      makePlayer('w1', 'werewolf', false),
      makePlayer('v1', 'villager'),
      makePlayer('v2', 'seer'),
    ];
    expect(checker.check(players)).toBe('village');
  });

  test('no winner when game continues', () => {
    const players = [
      makePlayer('w1', 'werewolf'),
      makePlayer('v1', 'villager'),
      makePlayer('v2', 'seer'),
    ];
    expect(checker.check(players)).toBeNull();
  });

  test('fox wins if alive when village wins', () => {
    const players = [
      makePlayer('w1', 'werewolf', false),
      makePlayer('v1', 'villager'),
      makePlayer('f1', 'fox'),
    ];
    expect(checker.check(players)).toBe('fox');
  });

  test('village wins if fox dead and werewolves dead', () => {
    const players = [
      makePlayer('w1', 'werewolf', false),
      makePlayer('v1', 'villager'),
      makePlayer('f1', 'fox', false),
    ];
    expect(checker.check(players)).toBe('village');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest tests/WinChecker.test.ts --no-coverage
```

期待出力: `FAIL`

- [ ] **Step 3: src/game/WinChecker.tsを作成する**

```typescript
import { Player, Team } from '../types';
import { RoleHandler } from '../roles/RoleHandler';

export class WinChecker {
  constructor(private roleHandler: RoleHandler) {}

  check(players: Player[]): Team | null {
    const alive = players.filter(p => p.isAlive);
    const aliveWerewolves = alive.filter(p => this.roleHandler.getTeam(p) === 'werewolf');
    const aliveVillage = alive.filter(p => {
      const team = this.roleHandler.getTeam(p);
      return team !== 'werewolf' && team !== 'fox';
    });
    const aliveFox = alive.filter(p => this.roleHandler.getTeam(p) === 'fox');

    // 人狼が全滅 → 村人勝利（狐が生存していれば狐勝利）
    if (aliveWerewolves.length === 0) {
      if (aliveFox.length > 0) return 'fox';
      return 'village';
    }

    // 人狼の数が村人以上 → 人狼勝利
    if (aliveWerewolves.length >= aliveVillage.length + aliveFox.length) {
      return 'werewolf';
    }

    return null;
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest tests/WinChecker.test.ts --no-coverage
```

期待出力: `PASS`

- [ ] **Step 5: コミットする**

```bash
git add src/game/WinChecker.ts tests/WinChecker.test.ts
git commit -m "feat: add WinChecker for village/werewolf/fox victory"
```

---

## Task 9: NightEngine（夜処理6段階）

**Files:**
- Create: `src/game/NightEngine.ts`
- Create: `tests/NightEngine.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/NightEngine.test.ts
import { NightEngine } from '../src/game/NightEngine';
import { RoleHandler } from '../src/roles/RoleHandler';
import { Player, NightAction } from '../src/types';

const makePlayer = (userId: string, roleId: string, isAlive = true): Player => ({
  userId, roleId, isAlive,
  isProtected: false, isCursed: false, voteWeight: 1, isBlocked: false,
});

describe('NightEngine', () => {
  let engine: NightEngine;
  let handler: RoleHandler;

  beforeEach(() => {
    handler = new RoleHandler();
    engine = new NightEngine(handler);
  });

  test('werewolf kill removes target', () => {
    const players = [
      makePlayer('w1', 'werewolf'),
      makePlayer('v1', 'villager'),
    ];
    const actions: NightAction[] = [
      { actorId: 'w1', targetId: 'v1', roleId: 'werewolf', priority: 3 },
    ];
    const result = engine.process(players, actions);
    expect(result.killed).toContain('v1');
  });

  test('knight protect prevents kill', () => {
    const players = [
      makePlayer('w1', 'werewolf'),
      makePlayer('v1', 'villager'),
      makePlayer('k1', 'knight'),
    ];
    const actions: NightAction[] = [
      { actorId: 'w1', targetId: 'v1', roleId: 'werewolf', priority: 3 },
      { actorId: 'k1', targetId: 'v1', roleId: 'knight', priority: 2 },
    ];
    const result = engine.process(players, actions);
    expect(result.killed).not.toContain('v1');
  });

  test('seer action does not kill', () => {
    const players = [
      makePlayer('s1', 'seer'),
      makePlayer('w1', 'werewolf'),
    ];
    const actions: NightAction[] = [
      { actorId: 's1', targetId: 'w1', roleId: 'seer', priority: 4 },
    ];
    const result = engine.process(players, actions);
    expect(result.killed).toHaveLength(0);
  });

  test('seer gets notification of target team', () => {
    const players = [
      makePlayer('s1', 'seer'),
      makePlayer('w1', 'werewolf'),
    ];
    const actions: NightAction[] = [
      { actorId: 's1', targetId: 'w1', roleId: 'seer', priority: 4 },
    ];
    const result = engine.process(players, actions);
    expect(result.notifications.get('s1')).toContain('人狼');
  });

  test('fox does not die from werewolf attack', () => {
    const players = [
      makePlayer('w1', 'werewolf'),
      makePlayer('f1', 'fox'),
    ];
    const actions: NightAction[] = [
      { actorId: 'w1', targetId: 'f1', roleId: 'werewolf', priority: 3 },
    ];
    const result = engine.process(players, actions);
    expect(result.killed).not.toContain('f1');
  });

  test('fox dies when seer checks it (curse)', () => {
    const players = [
      makePlayer('s1', 'seer'),
      makePlayer('f1', 'fox'),
    ];
    const actions: NightAction[] = [
      { actorId: 's1', targetId: 'f1', roleId: 'seer', priority: 4 },
    ];
    const result = engine.process(players, actions);
    expect(result.killed).toContain('f1');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest tests/NightEngine.test.ts --no-coverage
```

期待出力: `FAIL`

- [ ] **Step 3: src/game/NightEngine.tsを作成する**

```typescript
import { Player, NightAction, NightResult } from '../types';
import { RoleHandler } from '../roles/RoleHandler';

export class NightEngine {
  constructor(private roleHandler: RoleHandler) {}

  process(players: Player[], actions: NightAction[]): NightResult {
    const playerMap = new Map(players.map(p => [p.userId, { ...p }]));
    const notifications = new Map<string, string>();

    const sorted = [...actions].sort((a, b) => a.priority - b.priority);

    for (const action of sorted) {
      if (!action.targetId) continue;
      const actor = playerMap.get(action.actorId);
      const target = playerMap.get(action.targetId);
      if (!actor || !target) continue;

      const roleDef = this.roleHandler.getRoleDef(action.roleId);
      if (!roleDef) continue;

      switch (roleDef.effect.type) {
        case 'protect':
          target.isProtected = true;
          break;

        case 'block_action':
          target.isBlocked = true;
          break;

        case 'kill': {
          if (this.roleHandler.getTeam(target) === 'fox') break;
          if (target.isProtected) break;
          target.isAlive = false;
          break;
        }

        case 'reveal_team': {
          const team = this.roleHandler.appearsAs(target);
          const isFox = this.roleHandler.getTeam(target) === 'fox';
          if (isFox) {
            target.isCursed = true;
            target.isAlive = false;
            const label = team === 'werewolf' ? '人狼' : '人間';
            notifications.set(action.actorId, `${target.userId} は **${label}** です（呪い発動）`);
          } else {
            const label = team === 'werewolf' ? '人狼' : '人間';
            notifications.set(action.actorId, `${target.userId} は **${label}** です`);
          }
          break;
        }

        case 'reveal_role': {
          const roleName = this.roleHandler.getRoleDef(target.roleId)?.name ?? target.roleId;
          notifications.set(action.actorId, `${target.userId} の役職は **${roleName}** です`);
          break;
        }

        case 'revive':
          target.isAlive = true;
          target.deathPhase = undefined;
          target.deathCause = undefined;
          notifications.set(action.actorId, `${target.userId} を蘇生しました`);
          break;
      }
    }

    const killed = [...playerMap.values()]
      .filter(p => !p.isAlive && players.find(orig => orig.userId === p.userId)?.isAlive)
      .map(p => p.userId);

    return { killed, notifications };
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npx jest tests/NightEngine.test.ts --no-coverage
```

期待出力: `PASS`

- [ ] **Step 5: コミットする**

```bash
git add src/game/NightEngine.ts tests/NightEngine.test.ts
git commit -m "feat: add NightEngine with 6-stage processing"
```

---

## Task 10: GameSession & PhaseEngine

**Files:**
- Create: `src/game/GameSession.ts`
- Create: `src/game/PhaseEngine.ts`
- Create: `tests/GameSession.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/GameSession.test.ts
import { GameSession } from '../src/game/GameSession';
import { GameSettings } from '../src/types';

const defaultSettings: GameSettings = {
  dayDuration: 300,
  nightDuration: 120,
  voteDuration: 60,
  maxRevotes: 2,
  tieDeath: 'random',
  anonymousVote: false,
  revealRoleOnDeath: true,
};

describe('GameSession', () => {
  test('initial state is waiting', () => {
    const session = new GameSession('game1', 'guild1', 'ch1', 'host1', defaultSettings);
    expect(session.state).toBe('waiting');
  });

  test('addPlayer adds a player', () => {
    const session = new GameSession('game1', 'guild1', 'ch1', 'host1', defaultSettings);
    session.addPlayer('user1');
    expect(session.players).toHaveLength(1);
  });

  test('addPlayer does not add duplicate', () => {
    const session = new GameSession('game1', 'guild1', 'ch1', 'host1', defaultSettings);
    session.addPlayer('user1');
    session.addPlayer('user1');
    expect(session.players).toHaveLength(1);
  });

  test('removePlayer removes a player', () => {
    const session = new GameSession('game1', 'guild1', 'ch1', 'host1', defaultSettings);
    session.addPlayer('user1');
    session.removePlayer('user1');
    expect(session.players).toHaveLength(0);
  });

  test('getAlivePlayers returns only alive players', () => {
    const session = new GameSession('game1', 'guild1', 'ch1', 'host1', defaultSettings);
    session.addPlayer('user1');
    session.addPlayer('user2');
    session.assignRoles(['villager', 'werewolf']);
    session.killPlayer('user1', 'day', 'executed');
    expect(session.getAlivePlayers()).toHaveLength(1);
  });

  test('assignRoles sets role for each player', () => {
    const session = new GameSession('game1', 'guild1', 'ch1', 'host1', defaultSettings);
    session.addPlayer('user1');
    session.addPlayer('user2');
    session.assignRoles(['villager', 'werewolf']);
    const roles = session.players.map(p => p.roleId);
    expect(roles).toContain('villager');
    expect(roles).toContain('werewolf');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest tests/GameSession.test.ts --no-coverage
```

期待出力: `FAIL`

- [ ] **Step 3: src/game/GameSession.tsを作成する**

```typescript
import { Player, GameSettings, GameState, PhaseType, NightAction } from '../types';

export class GameSession {
  readonly id: string;
  readonly guildId: string;
  readonly channelId: string;
  readonly hostId: string;
  readonly settings: GameSettings;

  state: GameState = 'waiting';
  phase: PhaseType = 'day';
  day = 0;
  players: Player[] = [];
  nightActions: NightAction[] = [];
  revoteCount = 0;
  spectators: Set<string> = new Set();

  constructor(
    id: string,
    guildId: string,
    channelId: string,
    hostId: string,
    settings: GameSettings
  ) {
    this.id = id;
    this.guildId = guildId;
    this.channelId = channelId;
    this.hostId = hostId;
    this.settings = settings;
  }

  addPlayer(userId: string): void {
    if (this.players.find(p => p.userId === userId)) return;
    this.players.push({
      userId,
      roleId: '',
      isAlive: true,
      isProtected: false,
      isCursed: false,
      voteWeight: 1,
      isBlocked: false,
    });
  }

  removePlayer(userId: string): void {
    this.players = this.players.filter(p => p.userId !== userId);
  }

  assignRoles(roleIds: string[]): void {
    const shuffled = [...roleIds].sort(() => Math.random() - 0.5);
    this.players.forEach((p, i) => {
      p.roleId = shuffled[i] ?? 'villager';
    });
  }

  getAlivePlayers(): Player[] {
    return this.players.filter(p => p.isAlive);
  }

  getPlayer(userId: string): Player | undefined {
    return this.players.find(p => p.userId === userId);
  }

  killPlayer(userId: string, phase: string, cause: string): void {
    const p = this.getPlayer(userId);
    if (!p) return;
    p.isAlive = false;
    p.deathPhase = phase;
    p.deathCause = cause;
  }

  addNightAction(action: NightAction): void {
    this.nightActions = this.nightActions.filter(a => a.actorId !== action.actorId);
    this.nightActions.push(action);
  }

  clearNightActions(): void {
    this.nightActions = [];
    this.players.forEach(p => {
      p.isProtected = false;
      p.isBlocked = false;
    });
  }
}
```

- [ ] **Step 4: src/game/PhaseEngine.tsを作成する**

```typescript
import { Client, TextChannel, User } from 'discord.js';
import { GameSession } from './GameSession';
import { NightEngine } from './NightEngine';
import { WinChecker } from './WinChecker';
import { RoleHandler } from '../roles/RoleHandler';
import { GameTimer } from '../utils/timer';
import { EmbedBuilder as WolfEmbedBuilder } from '../ui/EmbedBuilder';
import { ButtonBuilder as WolfButtonBuilder } from '../ui/ButtonBuilder';
import { logEvent } from '../db/Database';
import logger from '../utils/logger';

export class PhaseEngine {
  private timer = new GameTimer();
  private nightEngine: NightEngine;
  private winChecker: WinChecker;
  private embedBuilder: WolfEmbedBuilder;
  private buttonBuilder: WolfButtonBuilder;

  constructor(private roleHandler: RoleHandler) {
    this.nightEngine = new NightEngine(roleHandler);
    this.winChecker = new WinChecker(roleHandler);
    this.embedBuilder = new WolfEmbedBuilder(roleHandler);
    this.buttonBuilder = new WolfButtonBuilder(roleHandler);
  }

  async startDay(session: GameSession, client: Client): Promise<void> {
    this.timer.clear();
    session.phase = 'day';
    session.revoteCount = 0;
    const channel = await client.channels.fetch(session.channelId) as TextChannel;

    const embed = this.embedBuilder.phaseAnnounce(session, 'day');
    await channel.send({ embeds: [embed] });

    logEvent(session.id, 'phase_start', { phase: 'day', day: session.day });

    if (session.day === 0) {
      this.timer.start(session.settings.dayDuration, channel, '初日議論', () => {
        this.startNight(session, client);
      });
      return;
    }

    this.timer.start(session.settings.dayDuration, channel, '議論', () => {
      this.startVote(session, client);
    });
  }

  async startVote(session: GameSession, client: Client): Promise<void> {
    const channel = await client.channels.fetch(session.channelId) as TextChannel;
    const alive = session.getAlivePlayers();
    const embed = this.embedBuilder.voteAnnounce(session);
    const row = this.buttonBuilder.voteButtons(session.id, alive);
    await channel.send({ embeds: [embed], components: [row] });
    logEvent(session.id, 'vote_start', { day: session.day });

    this.timer.start(session.settings.voteDuration, channel, '投票', () => {
      this.resolveVote(session, client);
    });
  }

  async resolveVote(session: GameSession, client: Client): Promise<void> {
    const channel = await client.channels.fetch(session.channelId) as TextChannel;

    if (!('voteEngine' in session)) return;
    const ve = (session as GameSession & { voteEngine: import('./VoteEngine').VoteEngine }).voteEngine;
    const top = ve.getTopVoted();

    if (top.length > 1 && session.revoteCount < session.settings.maxRevotes) {
      session.revoteCount++;
      const embed = this.embedBuilder.tieAnnounce(top, session.revoteCount);
      const row = this.buttonBuilder.revoteButtons(session.id, top);
      ve.reset();
      await channel.send({ embeds: [embed], components: [row] });
      logEvent(session.id, 'revote', { targets: top, revoteCount: session.revoteCount });
      this.timer.start(session.settings.voteDuration, channel, '再投票', () => {
        this.resolveVote(session, client);
      });
      return;
    }

    let executed: string | null = null;
    if (top.length === 1) {
      executed = top[0];
    } else if (session.settings.tieDeath === 'random') {
      executed = top[Math.floor(Math.random() * top.length)];
    }

    if (executed) {
      session.killPlayer(executed, `day${session.day}`, 'executed');
      logEvent(session.id, 'execution', { userId: executed, day: session.day });
      const embed = this.embedBuilder.executionResult(session, executed);
      await channel.send({ embeds: [embed] });
    } else {
      await channel.send({ embeds: [this.embedBuilder.noExecution(session)] });
    }

    const winner = this.winChecker.check(session.players);
    if (winner) {
      await this.endGame(session, client, winner);
      return;
    }

    await this.startNight(session, client);
  }

  async startNight(session: GameSession, client: Client): Promise<void> {
    this.timer.clear();
    session.phase = 'night';
    session.day++;
    session.clearNightActions();
    const channel = await client.channels.fetch(session.channelId) as TextChannel;

    const embed = this.embedBuilder.phaseAnnounce(session, 'night');
    await channel.send({ embeds: [embed] });
    logEvent(session.id, 'phase_start', { phase: 'night', day: session.day });

    await this.sendNightDMs(session, client);

    this.timer.start(session.settings.nightDuration, channel, '夜行動', async () => {
      await this.resolveNight(session, client);
    });
  }

  private async sendNightDMs(session: GameSession, client: Client): Promise<void> {
    const alive = session.getAlivePlayers();
    for (const player of alive) {
      try {
        const user = await client.users.fetch(player.userId);
        if (!this.roleHandler.canAct(player, 'night')) continue;
        const embed = this.embedBuilder.nightActionPrompt(session, player);
        const row = this.buttonBuilder.nightActionButtons(session.id, session, player, this.roleHandler);
        await user.send({ embeds: [embed], components: [row] });
      } catch (e) {
        logger.warn('failed to send night DM', { userId: player.userId, e });
      }
    }
  }

  async resolveNight(session: GameSession, client: Client): Promise<void> {
    const result = this.nightEngine.process(session.players, session.nightActions);

    for (const userId of result.killed) {
      session.killPlayer(userId, `night${session.day}`, 'killed');
    }
    logEvent(session.id, 'night_resolve', { killed: result.killed, day: session.day });

    const channel = await client.channels.fetch(session.channelId) as TextChannel;

    for (const [userId, msg] of result.notifications) {
      try {
        const user = await client.users.fetch(userId);
        await user.send(msg);
      } catch (e) {
        logger.warn('failed to send night notification', { userId, e });
      }
    }

    const deathEmbed = this.embedBuilder.nightResult(session, result.killed);
    await channel.send({ embeds: [deathEmbed] });

    const winner = this.winChecker.check(session.players);
    if (winner) {
      await this.endGame(session, client, winner);
      return;
    }

    await this.startDay(session, client);
  }

  async endGame(session: GameSession, client: Client, winner: string): Promise<void> {
    this.timer.clear();
    session.state = 'ended';
    const channel = await client.channels.fetch(session.channelId) as TextChannel;
    const embed = this.embedBuilder.gameResult(session, winner);
    await channel.send({ embeds: [embed] });
    logEvent(session.id, 'game_end', { winner });
  }
}
```

- [ ] **Step 5: テストが通ることを確認する**

```bash
npx jest tests/GameSession.test.ts --no-coverage
```

期待出力: `PASS`

- [ ] **Step 6: コミットする**

```bash
git add src/game/GameSession.ts src/game/PhaseEngine.ts tests/GameSession.test.ts
git commit -m "feat: add GameSession and PhaseEngine"
```

---

## Task 11: GameManager

**Files:**
- Create: `src/game/GameManager.ts`

- [ ] **Step 1: src/game/GameManager.tsを作成する**

```typescript
import { Client } from 'discord.js';
import { GameSession } from './GameSession';
import { PhaseEngine } from './PhaseEngine';
import { VoteEngine } from './VoteEngine';
import { RoleHandler } from '../roles/RoleHandler';
import { GameSettings } from '../types';
import { getDb, logEvent } from '../db/Database';
import defaults from '../../config/defaults.json';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';

type SessionWithVote = GameSession & { voteEngine: VoteEngine };

export class GameManager {
  private sessions = new Map<string, SessionWithVote>();
  private phaseEngine: PhaseEngine;
  private roleHandler: RoleHandler;

  constructor() {
    this.roleHandler = new RoleHandler();
    this.phaseEngine = new PhaseEngine(this.roleHandler);
  }

  getSession(guildId: string): SessionWithVote | undefined {
    return this.sessions.get(guildId);
  }

  createSession(
    guildId: string,
    channelId: string,
    hostId: string,
    settings: Partial<GameSettings> = {}
  ): SessionWithVote {
    if (this.sessions.has(guildId)) {
      throw new Error('このサーバーではすでにゲームが進行中です');
    }
    const merged: GameSettings = { ...defaults as GameSettings, ...settings };
    const id = randomUUID();
    const session = new GameSession(id, guildId, channelId, hostId, merged) as SessionWithVote;
    session.voteEngine = new VoteEngine();
    this.sessions.set(guildId, session);

    const db = getDb();
    db.prepare(
      'INSERT INTO games (id, guild_id, channel_id, state, host_id) VALUES (?, ?, ?, ?, ?)'
    ).run(id, guildId, channelId, 'waiting', hostId);

    logger.info('game created', { id, guildId, hostId });
    return session;
  }

  async startGame(guildId: string, client: Client): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) throw new Error('ゲームが見つかりません');
    if (session.players.length < 3) throw new Error('最低3人必要です');

    const roleIds = this.buildRoleList(guildId, session.players.length);
    session.assignRoles(roleIds);
    session.state = 'playing';

    const db = getDb();
    db.prepare('UPDATE games SET state = ?, started_at = datetime(\'now\') WHERE id = ?')
      .run('playing', session.id);

    for (const player of session.players) {
      db.prepare(
        'INSERT INTO players (game_id, user_id, role_id) VALUES (?, ?, ?)'
      ).run(session.id, player.userId, player.roleId);
    }

    logEvent(session.id, 'game_start', { players: session.players.map(p => p.userId) });

    await this.sendRoleDMs(session, client);
    await this.phaseEngine.startDay(session, client);
  }

  private buildRoleList(guildId: string, count: number): string[] {
    const db = getDb();
    const rows = db.prepare(
      'SELECT value FROM settings WHERE guild_id = ? AND key = ?'
    ).get(guildId, 'role_config') as { value: string } | undefined;

    if (rows) {
      const config = JSON.parse(rows.value) as string[];
      if (config.length === count) return config;
    }

    const wolves = Math.max(1, Math.floor(count / 4));
    const roles = Array(wolves).fill('werewolf');
    roles.push('seer');
    if (count >= 5) roles.push('knight');
    if (count >= 7) roles.push('medium');
    while (roles.length < count) roles.push('villager');
    return roles;
  }

  private async sendRoleDMs(session: SessionWithVote, client: Client): Promise<void> {
    const { EmbedBuilder: WolfEmbed } = await import('../ui/EmbedBuilder');
    const { ButtonBuilder: WolfButton } = await import('../ui/ButtonBuilder');
    const embedBuilder = new WolfEmbed(this.roleHandler);
    const buttonBuilder = new WolfButton(this.roleHandler);

    for (const player of session.players) {
      try {
        const user = await client.users.fetch(player.userId);
        const embed = embedBuilder.roleAssignment(player, this.roleHandler);
        await user.send({ embeds: [embed] });
      } catch (e) {
        logger.warn('failed to send role DM', { userId: player.userId });
      }
    }
  }

  endSession(guildId: string, winner?: string): void {
    const session = this.sessions.get(guildId);
    if (!session) return;
    const db = getDb();
    db.prepare(
      'UPDATE games SET state = ?, ended_at = datetime(\'now\'), winner_team = ? WHERE id = ?'
    ).run('ended', winner ?? null, session.id);
    this.sessions.delete(guildId);
    logger.info('game ended', { id: session.id, guildId, winner });
  }

  getRoleHandler(): RoleHandler {
    return this.roleHandler;
  }

  getPhaseEngine(): PhaseEngine {
    return this.phaseEngine;
  }
}
```

- [ ] **Step 2: コミットする**

```bash
git add src/game/GameManager.ts
git commit -m "feat: add GameManager for multi-guild session management"
```

---

## Task 12: EmbedBuilder & ButtonBuilder (UI)

**Files:**
- Create: `src/ui/EmbedBuilder.ts`
- Create: `src/ui/ButtonBuilder.ts`

- [ ] **Step 1: src/ui/EmbedBuilder.tsを作成する**

```typescript
import {
  EmbedBuilder,
  ColorResolvable,
} from 'discord.js';
import { GameSession } from '../game/GameSession';
import { Player, PhaseType } from '../types';
import { RoleHandler } from '../roles/RoleHandler';

const COLORS: Record<string, ColorResolvable> = {
  day: '#FFD700',
  night: '#1E3A5F',
  death: '#8B0000',
  win: '#32CD32',
  role: '#9B59B6',
};

export class EmbedBuilder {
  constructor(private roleHandler: RoleHandler) {}

  phaseAnnounce(session: GameSession, phase: PhaseType): EmbedBuilder {
    const alive = session.getAlivePlayers();
    const dead = session.players.filter(p => !p.isAlive);
    const isDay = phase === 'day';

    return new EmbedBuilder()
      .setColor(isDay ? COLORS.day : COLORS.night)
      .setTitle(isDay ? `☀️ ${session.day}日目 昼` : `🌙 ${session.day}日目 夜`)
      .addFields(
        { name: '生存者', value: alive.map(p => `<@${p.userId}>`).join('\n') || 'なし', inline: true },
        { name: '死亡者', value: dead.map(p => `<@${p.userId}>`).join('\n') || 'なし', inline: true }
      )
      .setTimestamp();
  }

  voteAnnounce(session: GameSession): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(COLORS.day)
      .setTitle('🗳️ 投票開始')
      .setDescription(`処刑する人を選んでください（${session.settings.voteDuration}秒）`)
      .setTimestamp();
  }

  tieAnnounce(targets: string[], revoteCount: number): EmbedBuilder {
    return new EmbedBuilder()
      .setColor('#FF8C00')
      .setTitle(`⚖️ 同票 - 再投票 (${revoteCount}回目)`)
      .setDescription(targets.map(t => `<@${t}>`).join(' と ') + ' が同票です')
      .setTimestamp();
  }

  executionResult(session: GameSession, executedId: string): EmbedBuilder {
    const player = session.players.find(p => p.userId === executedId);
    const roleName = session.settings.revealRoleOnDeath
      ? this.roleHandler.getRoleDef(player?.roleId ?? '')?.name ?? '不明'
      : '???';
    return new EmbedBuilder()
      .setColor(COLORS.death)
      .setTitle('⚰️ 処刑')
      .setDescription(`<@${executedId}> が処刑されました\n役職: **${roleName}**`)
      .setTimestamp();
  }

  noExecution(session: GameSession): EmbedBuilder {
    return new EmbedBuilder()
      .setColor('#888888')
      .setTitle('🤝 処刑なし')
      .setDescription('同票のため本日は処刑がありませんでした')
      .setTimestamp();
  }

  nightResult(session: GameSession, killed: string[]): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(COLORS.death)
      .setTitle('🌅 夜明け');

    if (killed.length === 0) {
      embed.setDescription('昨夜は誰も死亡しませんでした');
    } else {
      const lines = killed.map(uid => {
        const p = session.players.find(p => p.userId === uid);
        const roleName = session.settings.revealRoleOnDeath
          ? this.roleHandler.getRoleDef(p?.roleId ?? '')?.name ?? '不明'
          : '???';
        return `<@${uid}> (${roleName})`;
      });
      embed.setDescription(`死亡者:\n${lines.join('\n')}`);
    }
    return embed.setTimestamp();
  }

  gameResult(session: GameSession, winner: string): EmbedBuilder {
    const labels: Record<string, string> = {
      village: '村人陣営',
      werewolf: '人狼陣営',
      fox: '妖狐陣営',
    };
    const roles = session.players.map(p => {
      const roleName = this.roleHandler.getRoleDef(p.roleId)?.name ?? p.roleId;
      return `<@${p.userId}>: **${roleName}** (${p.isAlive ? '生存' : '死亡'})`;
    });
    return new EmbedBuilder()
      .setColor(COLORS.win)
      .setTitle(`🏆 ${labels[winner] ?? winner} の勝利！`)
      .addFields({ name: '役職公開', value: roles.join('\n') })
      .setTimestamp();
  }

  roleAssignment(player: Player, roleHandler: RoleHandler): EmbedBuilder {
    const role = roleHandler.getRoleDef(player.roleId);
    if (!role) return new EmbedBuilder().setTitle('役職不明');
    const teamLabel: Record<string, string> = {
      village: '村人陣営', werewolf: '人狼陣営', fox: '妖狐陣営', solo: '第三陣営',
    };
    return new EmbedBuilder()
      .setColor(COLORS.role)
      .setTitle(`あなたの役職: **${role.name}**`)
      .addFields(
        { name: '陣営', value: teamLabel[role.team] ?? role.team, inline: true },
        { name: '能力', value: role.description },
        { name: '勝利条件', value: role.winCondition }
      );
  }

  nightActionPrompt(session: GameSession, player: Player): EmbedBuilder {
    const role = this.roleHandler.getRoleDef(player.roleId);
    return new EmbedBuilder()
      .setColor(COLORS.night)
      .setTitle(`🌙 ${session.day}日目 夜 - 行動選択`)
      .setDescription(`**${role?.name ?? player.roleId}** として行動してください\n${role?.description ?? ''}`)
      .setTimestamp();
  }
}
```

- [ ] **Step 2: src/ui/ButtonBuilder.tsを作成する**

```typescript
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import { GameSession } from '../game/GameSession';
import { Player } from '../types';
import { RoleHandler } from '../roles/RoleHandler';

export class ButtonBuilder {
  constructor(private roleHandler: RoleHandler) {}

  joinButtons(gameId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`join:${gameId}`)
        .setLabel('参加する')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`leave:${gameId}`)
        .setLabel('参加キャンセル')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  startButton(gameId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`start:${gameId}`)
        .setLabel('ゲーム開始')
        .setStyle(ButtonStyle.Success)
    );
  }

  voteButtons(
    gameId: string,
    targets: Player[]
  ): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();
    const buttons = targets.slice(0, 5).map(p =>
      new ButtonBuilder()
        .setCustomId(`vote:${gameId}:${p.userId}`)
        .setLabel(`<@${p.userId}>`)
        .setStyle(ButtonStyle.Primary)
    );
    return row.addComponents(...buttons);
  }

  revoteButtons(
    gameId: string,
    targets: string[]
  ): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();
    const buttons = targets.map(uid =>
      new ButtonBuilder()
        .setCustomId(`revote:${gameId}:${uid}`)
        .setLabel(`<@${uid}>`)
        .setStyle(ButtonStyle.Danger)
    );
    return row.addComponents(...buttons);
  }

  nightActionButtons(
    gameId: string,
    session: GameSession,
    player: Player,
    roleHandler: RoleHandler
  ): ActionRowBuilder<ButtonBuilder> {
    const alive = session.getAlivePlayers().filter(p => p.userId !== player.userId);
    const row = new ActionRowBuilder<ButtonBuilder>();
    const buttons = alive.slice(0, 4).map(p =>
      new ButtonBuilder()
        .setCustomId(`night:${gameId}:${player.userId}:${p.userId}`)
        .setLabel(`<@${p.userId}>`)
        .setStyle(ButtonStyle.Primary)
    );
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`night:${gameId}:${player.userId}:skip`)
        .setLabel('行動しない')
        .setStyle(ButtonStyle.Secondary)
    );
    return row.addComponents(...buttons);
  }
}
```

- [ ] **Step 3: コミットする**

```bash
git add src/ui/EmbedBuilder.ts src/ui/ButtonBuilder.ts
git commit -m "feat: add EmbedBuilder and ButtonBuilder for Discord UI"
```

---

## Task 13: Botエントリーポイント & コマンド登録

**Files:**
- Create: `src/bot.ts`
- Create: `src/deploy-commands.ts`

- [ ] **Step 1: src/bot.tsを作成する**

```typescript
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, REST, Routes, Collection } from 'discord.js';
import { GameManager } from './game/GameManager';
import logger from './utils/logger';
import { getDb } from './db/Database';

const manager = new GameManager();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  logger.info('bot ready', { tag: client.user?.tag });
  getDb();
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      if (commandName === 'start') {
        const { handleStart } = await import('./commands/start');
        await handleStart(interaction, manager);
      } else if (commandName === 'setup') {
        const { handleSetup } = await import('./commands/setup');
        await handleSetup(interaction, manager);
      } else if (commandName === 'admin') {
        const { handleAdmin } = await import('./commands/admin');
        await handleAdmin(interaction, manager, client);
      } else if (commandName === 'logs') {
        const { handleLogs } = await import('./commands/logs');
        await handleLogs(interaction);
      } else if (commandName === 'spectate') {
        const { handleSpectate } = await import('./commands/spectate');
        await handleSpectate(interaction, manager);
      }
    }

    if (interaction.isButton()) {
      const [action, gameId, ...rest] = interaction.customId.split(':');

      if (action === 'join') {
        const session = manager.getSession(interaction.guildId!);
        if (!session) { await interaction.reply({ content: 'ゲームがありません', ephemeral: true }); return; }
        if (session.state !== 'waiting') { await interaction.reply({ content: '参加受付は終了しています', ephemeral: true }); return; }
        session.addPlayer(interaction.user.id);
        await interaction.reply({ content: '✅ 参加しました', ephemeral: true });
      }

      if (action === 'leave') {
        const session = manager.getSession(interaction.guildId!);
        if (!session || session.state !== 'waiting') { await interaction.reply({ content: 'キャンセルできません', ephemeral: true }); return; }
        session.removePlayer(interaction.user.id);
        await interaction.reply({ content: '参加をキャンセルしました', ephemeral: true });
      }

      if (action === 'start') {
        const session = manager.getSession(interaction.guildId!);
        if (!session) { await interaction.reply({ content: 'ゲームがありません', ephemeral: true }); return; }
        if (session.hostId !== interaction.user.id) { await interaction.reply({ content: 'ホストのみ開始できます', ephemeral: true }); return; }
        await interaction.deferReply();
        await manager.startGame(interaction.guildId!, client);
        await interaction.deleteReply();
      }

      if (action === 'vote' || action === 'revote') {
        const session = manager.getSession(interaction.guildId!);
        if (!session) { await interaction.reply({ content: 'ゲームがありません', ephemeral: true }); return; }
        const targetId = rest[0];
        session.voteEngine.castVote(interaction.user.id, targetId);
        await interaction.reply({ content: `<@${targetId}> に投票しました`, ephemeral: true });
      }

      if (action === 'night') {
        const [actorId, targetId] = rest;
        const session = manager.getSession(interaction.guildId ?? '');
        if (!session) {
          const guilds = client.guilds.cache;
          for (const [gid, _] of guilds) {
            const s = manager.getSession(gid);
            if (s && s.players.find(p => p.userId === actorId)) {
              handleNightAction(s, actorId, targetId, interaction, manager);
              return;
            }
          }
          await interaction.reply({ content: 'ゲームが見つかりません', ephemeral: true });
          return;
        }
        await handleNightAction(session, actorId, targetId, interaction, manager);
      }
    }
  } catch (e) {
    logger.error('interaction error', { e });
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({ content: 'エラーが発生しました', ephemeral: true }).catch(() => {});
    }
  }
});

async function handleNightAction(
  session: any,
  actorId: string,
  targetId: string,
  interaction: any,
  manager: GameManager
): Promise<void> {
  const player = session.getPlayer(actorId);
  if (!player) { await interaction.reply({ content: 'プレイヤーが見つかりません', ephemeral: true }); return; }

  if (targetId !== 'skip') {
    const role = manager.getRoleHandler().getRoleDef(player.roleId);
    session.addNightAction({
      actorId,
      targetId,
      roleId: player.roleId,
      priority: role?.priority ?? 0,
    });
  }
  await interaction.reply({ content: targetId === 'skip' ? '行動しませんでした' : `<@${targetId}> を対象に選びました`, ephemeral: true });
}

client.login(process.env.BOT_TOKEN);
```

- [ ] **Step 2: src/deploy-commands.tsを作成する**

```typescript
import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('人狼ゲームの参加募集を開始する'),

  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('ゲーム設定を変更する')
    .addIntegerOption(o => o.setName('day').setDescription('昼時間(秒)').setMinValue(30))
    .addIntegerOption(o => o.setName('night').setDescription('夜時間(秒)').setMinValue(30))
    .addIntegerOption(o => o.setName('vote').setDescription('投票時間(秒)').setMinValue(15))
    .addIntegerOption(o => o.setName('maxrevotes').setDescription('最大再投票回数').setMinValue(0).setMaxValue(5))
    .addStringOption(o => o.setName('tiedeath').setDescription('同票時処理').addChoices(
      { name: 'ランダム処刑', value: 'random' },
      { name: '処刑なし', value: 'none' }
    ))
    .addBooleanOption(o => o.setName('anonymous').setDescription('匿名投票'))
    .addBooleanOption(o => o.setName('revealrole').setDescription('死亡時役職公開')),

  new SlashCommandBuilder()
    .setName('admin')
    .setDescription('管理者コマンド')
    .addSubcommand(s => s.setName('end').setDescription('ゲームを強制終了'))
    .addSubcommand(s => s.setName('restart').setDescription('再試合'))
    .addSubcommand(s =>
      s.setName('assign')
        .setDescription('役職を手動割当')
        .addUserOption(o => o.setName('user').setDescription('プレイヤー').setRequired(true))
        .addStringOption(o => o.setName('role').setDescription('役職ID').setRequired(true))
    )
    .addSubcommand(s =>
      s.setName('time')
        .setDescription('残り時間を変更')
        .addStringOption(o => o.setName('phase').setDescription('フェーズ').setRequired(true)
          .addChoices({ name: '昼', value: 'day' }, { name: '夜', value: 'night' }, { name: '投票', value: 'vote' }))
        .addIntegerOption(o => o.setName('seconds').setDescription('秒数').setRequired(true).setMinValue(10))
    ),

  new SlashCommandBuilder()
    .setName('logs')
    .setDescription('ゲームログを表示')
    .addStringOption(o => o.setName('game_id').setDescription('ゲームID (省略で最新)')),

  new SlashCommandBuilder()
    .setName('spectate')
    .setDescription('観戦モードで参加/解除'),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);

const guildId = process.env.GUILD_ID;

(async () => {
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildId), { body: commands });
    console.log(`✅ コマンドをサーバー ${guildId} に登録しました`);
  } else {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: commands });
    console.log('✅ グローバルコマンドを登録しました（反映に最大1時間）');
  }
})();
```

- [ ] **Step 3: コミットする**

```bash
git add src/bot.ts src/deploy-commands.ts
git commit -m "feat: add bot entry point and slash command registration"
```

---

## Task 14: コマンド実装

**Files:**
- Create: `src/commands/start.ts`
- Create: `src/commands/setup.ts`
- Create: `src/commands/admin.ts`
- Create: `src/commands/logs.ts`
- Create: `src/commands/spectate.ts`

- [ ] **Step 1: src/commands/start.tsを作成する**

```typescript
import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { GameManager } from '../game/GameManager';
import { ButtonBuilder as WolfButton } from '../ui/ButtonBuilder';

export async function handleStart(
  interaction: ChatInputCommandInteraction,
  manager: GameManager
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'サーバー内で実行してください', ephemeral: true });
    return;
  }
  if (manager.getSession(interaction.guildId)) {
    await interaction.reply({ content: '既にゲームが進行中です', ephemeral: true });
    return;
  }

  const session = manager.createSession(
    interaction.guildId,
    interaction.channelId,
    interaction.user.id
  );
  session.addPlayer(interaction.user.id);

  const wb = new WolfButton(manager.getRoleHandler());
  const embed = new EmbedBuilder()
    .setColor('#4169E1')
    .setTitle('🐺 人狼ゲーム 参加募集中')
    .setDescription('参加するには「参加する」ボタンを押してください\nホストは全員が揃ったら「ゲーム開始」を押してください')
    .addFields({ name: '参加者', value: `<@${interaction.user.id}>` });

  const joinRow = wb.joinButtons(session.id);
  const startRow = wb.startButton(session.id);

  await interaction.reply({ embeds: [embed], components: [joinRow, startRow] });
}
```

- [ ] **Step 2: src/commands/setup.tsを作成する**

```typescript
import { ChatInputCommandInteraction } from 'discord.js';
import { GameManager } from '../game/GameManager';
import { setSetting } from '../db/Database';

export async function handleSetup(
  interaction: ChatInputCommandInteraction,
  manager: GameManager
): Promise<void> {
  if (!interaction.guildId) { await interaction.reply({ content: 'サーバー内で実行してください', ephemeral: true }); return; }

  const day = interaction.options.getInteger('day');
  const night = interaction.options.getInteger('night');
  const vote = interaction.options.getInteger('vote');
  const maxRevotes = interaction.options.getInteger('maxrevotes');
  const tieDeath = interaction.options.getString('tiedeath');
  const anonymous = interaction.options.getBoolean('anonymous');
  const revealRole = interaction.options.getBoolean('revealrole');

  const lines: string[] = [];
  if (day !== null) { setSetting(interaction.guildId, 'dayDuration', String(day)); lines.push(`昼時間: ${day}秒`); }
  if (night !== null) { setSetting(interaction.guildId, 'nightDuration', String(night)); lines.push(`夜時間: ${night}秒`); }
  if (vote !== null) { setSetting(interaction.guildId, 'voteDuration', String(vote)); lines.push(`投票時間: ${vote}秒`); }
  if (maxRevotes !== null) { setSetting(interaction.guildId, 'maxRevotes', String(maxRevotes)); lines.push(`最大再投票: ${maxRevotes}回`); }
  if (tieDeath !== null) { setSetting(interaction.guildId, 'tieDeath', tieDeath); lines.push(`同票処理: ${tieDeath}`); }
  if (anonymous !== null) { setSetting(interaction.guildId, 'anonymousVote', String(anonymous)); lines.push(`匿名投票: ${anonymous}`); }
  if (revealRole !== null) { setSetting(interaction.guildId, 'revealRoleOnDeath', String(revealRole)); lines.push(`死亡時役職公開: ${revealRole}`); }

  if (lines.length === 0) {
    await interaction.reply({ content: '変更なし', ephemeral: true });
    return;
  }

  await interaction.reply({ content: `✅ 設定を更新しました:\n${lines.join('\n')}`, ephemeral: true });
}
```

- [ ] **Step 3: src/commands/admin.tsを作成する**

```typescript
import { ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { GameManager } from '../game/GameManager';

export async function handleAdmin(
  interaction: ChatInputCommandInteraction,
  manager: GameManager,
  client: Client
): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '管理者権限が必要です', ephemeral: true });
    return;
  }
  if (!interaction.guildId) { await interaction.reply({ content: 'サーバー内で実行してください', ephemeral: true }); return; }

  const sub = interaction.options.getSubcommand();
  const session = manager.getSession(interaction.guildId);

  if (sub === 'end') {
    if (!session) { await interaction.reply({ content: 'ゲームがありません', ephemeral: true }); return; }
    manager.endSession(interaction.guildId);
    await interaction.reply({ content: '⛔ ゲームを強制終了しました' });
  }

  if (sub === 'restart') {
    if (!session) { await interaction.reply({ content: 'ゲームがありません', ephemeral: true }); return; }
    const players = session.players.map(p => p.userId);
    manager.endSession(interaction.guildId);
    const newSession = manager.createSession(interaction.guildId, interaction.channelId, session.hostId, session.settings);
    players.forEach(uid => newSession.addPlayer(uid));
    await interaction.reply({ content: '🔄 再試合の参加募集を開始しました（同メンバー）' });
  }

  if (sub === 'assign') {
    if (!session) { await interaction.reply({ content: 'ゲームがありません', ephemeral: true }); return; }
    const user = interaction.options.getUser('user', true);
    const roleId = interaction.options.getString('role', true);
    const player = session.getPlayer(user.id);
    if (!player) { await interaction.reply({ content: 'プレイヤーが見つかりません', ephemeral: true }); return; }
    const roleDef = manager.getRoleHandler().getRoleDef(roleId);
    if (!roleDef) { await interaction.reply({ content: `役職 "${roleId}" は存在しません`, ephemeral: true }); return; }
    player.roleId = roleId;
    await interaction.reply({ content: `✅ <@${user.id}> の役職を **${roleDef.name}** に変更しました`, ephemeral: true });
  }

  if (sub === 'time') {
    await interaction.reply({ content: '時間変更は次回フェーズから適用されます', ephemeral: true });
  }
}
```

- [ ] **Step 4: src/commands/logs.tsを作成する**

```typescript
import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getDb } from '../db/Database';

export async function handleLogs(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '管理者権限が必要です', ephemeral: true });
    return;
  }

  const db = getDb();
  let gameId = interaction.options.getString('game_id');

  if (!gameId) {
    const latest = db.prepare(
      'SELECT id FROM games WHERE guild_id = ? ORDER BY started_at DESC LIMIT 1'
    ).get(interaction.guildId!) as { id: string } | undefined;
    if (!latest) { await interaction.reply({ content: 'ゲーム履歴がありません', ephemeral: true }); return; }
    gameId = latest.id;
  }

  const logs = db.prepare(
    'SELECT event_type, payload, timestamp FROM game_logs WHERE game_id = ? ORDER BY id DESC LIMIT 20'
  ).all(gameId) as { event_type: string; payload: string; timestamp: string }[];

  if (logs.length === 0) { await interaction.reply({ content: 'ログがありません', ephemeral: true }); return; }

  const lines = logs.map(l => `\`${l.timestamp}\` **${l.event_type}** ${l.payload}`).join('\n');
  const embed = new EmbedBuilder()
    .setTitle(`📋 ゲームログ: ${gameId.slice(0, 8)}...`)
    .setDescription(lines.slice(0, 4000));

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
```

- [ ] **Step 5: src/commands/spectate.tsを作成する**

```typescript
import { ChatInputCommandInteraction } from 'discord.js';
import { GameManager } from '../game/GameManager';

export async function handleSpectate(
  interaction: ChatInputCommandInteraction,
  manager: GameManager
): Promise<void> {
  if (!interaction.guildId) { await interaction.reply({ content: 'サーバー内で実行してください', ephemeral: true }); return; }
  const session = manager.getSession(interaction.guildId);
  if (!session) { await interaction.reply({ content: 'ゲームがありません', ephemeral: true }); return; }

  const uid = interaction.user.id;
  if (session.spectators.has(uid)) {
    session.spectators.delete(uid);
    await interaction.reply({ content: '👁️ 観戦モードを解除しました', ephemeral: true });
  } else {
    if (session.players.find(p => p.userId === uid)) {
      await interaction.reply({ content: '参加中のため観戦できません', ephemeral: true });
      return;
    }
    session.spectators.add(uid);
    await interaction.reply({ content: '👁️ 観戦モードで参加しました。ゲームイベントをDMで受け取ります', ephemeral: true });
  }
}
```

- [ ] **Step 6: コミットする**

```bash
git add src/commands/
git commit -m "feat: add all slash command handlers"
```

---

## Task 15: ビルド確認 & 動作テスト

**Files:** なし（既存コードの確認）

- [ ] **Step 1: 全テストを実行する**

```bash
npx jest --no-coverage
```

期待出力: `PASS` (VoteEngine, WinChecker, NightEngine, GameSession, RoleHandler)

- [ ] **Step 2: TypeScriptビルドを確認する**

```bash
npx tsc --noEmit
```

期待出力: エラーなし

- [ ] **Step 3: .envに BOT_TOKEN と CLIENT_ID を設定して開発モードで起動する**

```bash
npm run dev
```

期待出力: `[INFO]: bot ready { tag: 'BotName#1234' }`

- [ ] **Step 4: コマンドをDiscordに登録する**

```bash
npm run deploy
```

期待出力: `✅ コマンドをサーバー XXXX に登録しました`

- [ ] **Step 5: Discordで動作確認する**

Discordのテストサーバーで以下を確認:
1. `/start` でゲーム募集メッセージが表示される
2. 「参加する」ボタンが機能する
3. 3人以上参加して「ゲーム開始」でゲームが始まる
4. 各プレイヤーにDMで役職が届く
5. 夜フェーズでDMに行動ボタンが表示される

- [ ] **Step 6: コミットする**

```bash
git add -A
git commit -m "feat: complete core game bot implementation"
```

---

## Task 16: Railwayデプロイ

**Files:**
- Create: `railway.toml`

- [ ] **Step 1: railway.tomlを作成する**

```toml
[build]
  builder = "NIXPACKS"

[deploy]
  startCommand = "node dist/bot.js"
  restartPolicyType = "ON_FAILURE"
  restartPolicyMaxRetries = 5
```

- [ ] **Step 2: package.jsonのbuildスクリプトを確認する**

`package.json` の `"build": "tsc"` が存在することを確認。

- [ ] **Step 3: GitHubにリポジトリを作成してpushする**

```bash
git remote add origin https://github.com/YOUR_USERNAME/wolf-discord.git
git push -u origin main
```

- [ ] **Step 4: Railwayにデプロイする**

1. https://railway.app にアクセスしてGitHubアカウントでログイン
2. 「New Project」→「Deploy from GitHub repo」
3. リポジトリを選択
4. 「Variables」タブで以下を設定:
   - `BOT_TOKEN` = Discordのボットトークン
   - `CLIENT_ID` = アプリケーションID
   - `NODE_ENV` = `production`
   - `LOG_LEVEL` = `info`
5. 「Volumes」→「New Volume」でマウントポイント `/app` に永続ボリュームを追加
   - `DB_PATH` = `/app/data.db` を環境変数に追加

- [ ] **Step 5: デプロイログを確認する**

Railway管理画面の「Deployments」でビルドログを確認。

期待出力: `bot ready { tag: 'BotName#1234' }`

- [ ] **Step 6: コマンドをグローバル登録する**

ローカルで以下を実行（GUILD_IDを外してグローバル登録）:

```bash
# .envからGUILD_IDを削除またはコメントアウトして実行
npm run deploy
```

期待出力: `✅ グローバルコマンドを登録しました（反映に最大1時間）`

- [ ] **Step 7: コミットする**

```bash
git add railway.toml
git commit -m "feat: add Railway deployment configuration"
git push origin main
```

---

## Task 17: 残りの役職をroles.jsonに追加

**Files:**
- Modify: `src/roles/roles.json`
- Modify: `src/types.ts`

**全役職リスト（123役職）:** ローカルファイル `C:\Users\solar\Downloads\役職リスト - 【人狼ジャッジメント】 初心者ガイド - atwiki（アットウィキ）.html` を参照

| 陣営 | 役職一覧 |
|------|----------|
| 市民 | 市民, 占い師, 霊能者, 狩人, 双子, 女王, プリンセス, 猫又, 罠師, 饒舌な狩人, 医者, 聖職者, 賢者, 魔女, 暗殺者, わら人形, 赤ずきん, 巫女, 偽占い師, 占い師の弟子, 貴族, 独裁者, 長老, 市長, 人狼キラー, ギャンブラー, 名探偵, 新聞配達, パン屋, 狼憑き, 番犬, 病人, 呪われし者, 生霊, 奴隷, 逃亡者, 怪盗, 家政婦, ささやく双子, 二丁拳銃, 狼憑きの狩人, 迷惑な狩人, 鉄の女, 詩人, 光の使徒, イタコ, 神父, 幸福の梟, 貴族の息子, 偽女王, マッチ売り, 聖騎士, 指導者, 墓場の司祭, 魔法少女, チキン, 風来坊 |
| 人狼 | 人狼, 強欲な人狼, 大狼, 賢狼, 能ある人狼, 蘇る人狼, 饒舌な人狼, 一途な人狼, 一匹狼, 新種の人狼, 呪狼, 心眼の人狼, ギャンブル狼, 人狼王, 窮地の人狼, 狂人, 狂信者, ささやく狂人, 反逆の狂人, 狼少年, 黒猫, サイコ, 妖術師, 爆弾狂, 狼少女, ギャンブル狂, 悪徳政治家, 人狼の末裔, 黒い占い師, 誘惑の狼信者, 封魔の狼信者, 女王騙り, 闇の化身 |
| 妖狐 | 妖狐, 子狐, 九尾の狐, 饒舌な妖狐, 変異狐, 背徳者, 背信者, ささやく背教者, 背徳の呪術師, 狐憑き |
| 恋人 | 恋人, キューピット, 悪女 |
| ゾンビ | ゾンビ, 襲撃のゾンビ, ゾンビマニア, ささやくゾンビ博士 |
| サンタ | サンタ, トナカイ |
| 悪魔 | 悪魔 |
| 第三 | 殉教者, てるてる坊主, コウモリ男, ブタ男, 純愛者, 復讐者, 天邪鬼, ねずみ娘, テレパシスト, 激愛女, 銀色の影 |
| その他 | 酔っぱらい, 疫病神, ジキルとハイド |

- [ ] **Step 1: src/types.tsのTeam型を更新する**

```typescript
export type Team = 'village' | 'werewolf' | 'fox' | 'lover' | 'zombie' | 'santa' | 'devil' | 'solo' | 'other';
```

- [ ] **Step 2: WinChecker.tsに新陣営の勝利判定を追加する**

```typescript
check(players: Player[]): Team | null {
  const alive = players.filter(p => p.isAlive);
  const aliveWerewolves = alive.filter(p => this.roleHandler.getTeam(p) === 'werewolf');
  const aliveVillage = alive.filter(p => {
    const team = this.roleHandler.getTeam(p);
    return team !== 'werewolf' && team !== 'fox' && team !== 'lover' && team !== 'zombie' && team !== 'santa' && team !== 'devil' && team !== 'solo' && team !== 'other';
  });
  const aliveFox = alive.filter(p => this.roleHandler.getTeam(p) === 'fox');
  const aliveLovers = alive.filter(p => this.roleHandler.getTeam(p) === 'lover');
  const aliveZombie = alive.filter(p => this.roleHandler.getTeam(p) === 'zombie');

  if (aliveWerewolves.length === 0 && aliveZombie.length === 0) {
    if (aliveFox.length > 0) return 'fox';
    if (aliveLovers.length >= 2) return 'lover';
    return 'village';
  }

  if (aliveWerewolves.length >= aliveVillage.length + aliveFox.length) {
    return 'werewolf';
  }

  if (aliveZombie.length > 0 && aliveWerewolves.length === 0 && aliveVillage.length === 0) {
    return 'zombie';
  }

  return null;
}
```

- [ ] **Step 3: 各役職をroles.json形式でroles.jsonに追加する**

フォーマット（Task 5と同じ）:
```json
{
  "id": "role_id",
  "name": "役職名",
  "team": "village | werewolf | fox | solo",
  "description": "能力の簡潔な説明",
  "timing": "night | day | always | none",
  "hasTarget": true,
  "priority": 1,
  "winCondition": "勝利条件",
  "effect": {
    "type": "effectのtype（Task 5参照）",
    "targetFilter": "any | alive | dead | village | werewolf | fox"
  }
}
```

特殊処理が必要な役職は `"type": "custom"` を使い `"special": "役職ID"` を追加する。

- [ ] **Step 3: 特殊役職のcustomハンドラをNightEngineに追加する**

NightEngine.tsの`process`メソッドのswitch文に`case 'custom'`を追加:

```typescript
case 'custom': {
  const special = roleDef.effect['special'] as string | undefined;
  if (special === 'bakeneko' && !actor.isAlive) {
    const wolves = [...playerMap.values()].filter(p =>
      p.isAlive && this.roleHandler.getTeam(p) === 'werewolf'
    );
    if (wolves.length > 0) {
      const victim = wolves[Math.floor(Math.random() * wolves.length)];
      victim.isAlive = false;
    }
  }
  break;
}
```

- [ ] **Step 4: テストを実行してリグレッションがないことを確認する**

```bash
npx jest --no-coverage
```

期待出力: すべて `PASS`

- [ ] **Step 5: コミットする**

```bash
git add src/roles/roles.json src/game/NightEngine.ts
git commit -m "feat: add remaining roles from wiki"
```

---

## 全テスト実行

最終確認:

```bash
npx jest --no-coverage
npx tsc --noEmit
```

両方ともエラーなしで完了すること。
