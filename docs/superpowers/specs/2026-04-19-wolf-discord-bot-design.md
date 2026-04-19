# Discord 人狼Bot 設計書

## 概要

Discord上で動作する人狼ゲーム自動進行Bot。複数サーバーで同時稼働し、全役職を自由に使用可能。進行・操作・情報管理の快適さを最優先とする。

## 技術スタック

| 項目 | 採用技術 |
|------|----------|
| 言語 | TypeScript |
| Discordライブラリ | discord.js v14 |
| DB | SQLite（better-sqlite3） |
| ホスティング | Railway（無料枠） |
| ビルド | tsx（開発）/ tsc（本番） |

## アーキテクチャ（モノリシック構成）

```
wolf-discord/
├── src/
│   ├── bot.ts                  # Discordクライアント初期化・イベント登録
│   ├── deploy-commands.ts      # スラッシュコマンド登録スクリプト
│   ├── commands/
│   │   ├── setup.ts            # /setup - ゲーム設定
│   │   ├── start.ts            # /start - 参加募集開始
│   │   ├── admin.ts            # /admin - 管理者コマンド群
│   │   └── logs.ts             # /logs - ゲームログ閲覧
│   ├── game/
│   │   ├── GameManager.ts      # サーバーIDキーで複数ゲーム管理
│   │   ├── GameSession.ts      # 1ゲームのフェーズ進行
│   │   ├── PhaseEngine.ts      # 昼/夜フェーズ制御
│   │   ├── NightEngine.ts      # 夜処理6段階実行
│   │   ├── VoteEngine.ts       # 投票・同票・再投票処理
│   │   └── WinChecker.ts       # 勝利判定
│   ├── roles/
│   │   ├── roles.json          # 全役職データ定義
│   │   └── RoleHandler.ts      # 役職能力の汎用実行エンジン
│   ├── ui/
│   │   ├── ButtonBuilder.ts    # フェーズ別ボタン生成
│   │   └── EmbedBuilder.ts     # 埋め込みメッセージ生成
│   ├── db/
│   │   └── Database.ts         # SQLite操作（全CRUD）
│   └── utils/
│       ├── logger.ts           # デバッグログ（winston）
│       └── timer.ts            # カウントダウン・残り30秒通知
├── config/
│   └── defaults.json           # デフォルト時間設定
├── .env                        # BOT_TOKEN, CLIENT_ID, GUILD_ID（開発時のみ）
├── .env.example                # トークンなしのサンプル
├── railway.toml                # Railwayデプロイ設定
├── package.json
└── tsconfig.json
```

## ゲームフロー

```
/start → 参加募集メッセージ（参加ボタン）
    └─ ホストが「開始」ボタン
        └─ 役職配布（全員にDM送信）
            └─ [初日昼フェーズ]
            │   ├─ 生存者一覧表示
            │   ├─ 議論（カウントダウン）
            │   └─ 投票なし → 夜へ
            └─ [夜フェーズ]
                ├─ 各自DMで能力使用ボタン
                ├─ 時間切れで強制終了
                ├─ 夜処理6段階実行
                └─ 勝利判定
                    ├─ 決着 → 結果発表
                    └─ 継続 → [昼フェーズ（2日目以降）]
                        ├─ 生存者一覧表示
                        ├─ 議論（カウントダウン）
                        ├─ 投票 → 同票なら再投票（最大N回）
                        ├─ 処刑 or ランダム or なし（設定依存）
                        └─ 勝利判定 → 夜へ
```

## 夜処理の順序（固定）

| 段階 | 内容 | 例 |
|------|------|-----|
| 第1段階 | 状態変更 | 変身、コピー系 |
| 第2段階 | 防御 | 騎士の護衛 |
| 第3段階 | 攻撃 | 人狼の襲撃 |
| 第4段階 | 判定 | 占い師の占い結果確定 |
| 第5段階 | 死亡確定 | 防御を突破した攻撃で死亡 |
| 第6段階 | 結果通知 | 死者・能力結果をDMで通知 |

**共通ルール:**
- 複数攻撃はすべて適用
- 死亡者の能力はその夜は有効
- 対象選択可否は役職ごとに`roles.json`で定義

## 役職データ構造

```json
{
  "id": "seer",
  "name": "占い師",
  "team": "village",
  "description": "毎夜1人の役職を占える",
  "timing": "night",
  "hasTarget": true,
  "priority": 4,
  "winCondition": "すべての人狼を追放する",
  "effect": {
    "type": "reveal_role",
    "targetFilter": "any"
  }
}
```

**effectのtype一覧（汎用エンジンが解釈）:**
- `reveal_role` - 役職を確認
- `reveal_team` - 陣営を確認
- `protect` - 攻撃を防ぐ
- `kill` - 対象を死亡させる
- `copy_role` - 役職をコピー
- `transform` - 別役職に変身
- `curse` - 状態異常付与
- `vote_weight` - 投票数を変更
- `extra_action` - 追加行動付与
- `block_action` - 相手の行動を封じる
- `revive` - 蘇生
- `custom` - 特殊処理（個別実装）

## DB設計（SQLite）

```sql
-- ゲーム管理
games (id, guild_id, channel_id, state, phase, day, started_at, ended_at)

-- プレイヤー
players (id, game_id, user_id, role_id, is_alive, death_phase, death_cause)

-- 投票
votes (id, game_id, voter_id, target_id, phase, day, created_at)

-- 夜行動
night_actions (id, game_id, actor_id, target_id, role_id, night, created_at)

-- ゲームログ（デバッグ・観戦用）
game_logs (id, game_id, timestamp, event_type, payload)

-- サーバー設定
settings (guild_id, key, value)
```

## 設定管理

### config/defaults.json（デフォルト値）
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

### /setup コマンドで上書き可能な項目
- 昼時間・夜時間・投票時間
- 最大再投票回数
- 同票時の処理（ランダム処刑 / 処刑なし）
- 匿名投票 ON/OFF
- 死亡時役職公開 ON/OFF

## UI仕様

### サーバー内ボタン
- 参加中のみ: 「参加する」「参加キャンセル」
- ホストのみ: 「ゲーム開始」「強制終了」
- 投票フェーズ: 生存者一覧ボタン（1人1票）
- **原則: そのタイミングで押せるボタンのみ表示**

### DM内ボタン
- 役職・能力・勝利条件の表示
- 夜フェーズ: 対象選択ボタン（hasTarget=trueの役職のみ）
- 能力不使用の選択肢も提供

## 投票システム

1. 生存者一覧をボタンで表示
2. 1人1票、締切まで変更可能
3. 同票 → 再投票（対象は同票者のみ）
4. 最大再投票回数を超過 → tieDeath設定で処理

### 結果表示
- 匿名ON: 得票数のみ
- 匿名OFF: 誰が誰に投票したか全表示

## 管理者コマンド

| コマンド | 説明 |
|----------|------|
| `/admin end` | ゲーム強制終了 |
| `/admin time <phase> <seconds>` | 時間変更 |
| `/admin assign <user> <role>` | 役職手動割当 |
| `/admin restart` | 再試合（同メンバー） |
| `/logs <game_id>` | ゲームログ閲覧 |

## デバッグ機能

- **winston**によるログレベル管理（DEBUG / INFO / WARN / ERROR）
- 環境変数`LOG_LEVEL`で制御（Railway環境変数で設定）
- 全ゲームイベントをDB `game_logs`テーブルに記録
- `/logs`コマンドで管理者がDiscord上でログ閲覧
- 開発環境: `LOG_LEVEL=debug`でコンソール詳細出力

## 複数サーバー対応

- `GameManager`がサーバーID（guild_id）をキーに`Map<string, GameSession>`で管理
- サーバーごとに独立した設定（settings テーブル）
- Botを招待したサーバー全てで即使用可能
- **必要なBot権限:** Send Messages, Use Slash Commands, Manage Channels, Send Messages in Threads

## セキュリティ

- トークンは`.env`のみ管理、`.gitignore`に追加
- 管理者コマンドはDiscordの`ADMINISTRATOR`権限チェック
- ゲームホスト権限はゲーム作成者のみ
- SQLインジェクション対策: プリペアドステートメントのみ使用
- レートリミット: discord.jsの組み込み対応を使用

## 観戦モード

- `/spectate` コマンドで観戦者として登録
- 観戦者はゲームに参加できないが `game_logs` をリアルタイムで閲覧可能
- 観戦専用チャンネルにイベントを逐次投稿（死亡・能力使用など）
- 役職情報は表示しない（ゲーム終了後に公開）

## ホスティング（Railway）

```toml
# railway.toml
[build]
  builder = "NIXPACKS"

[deploy]
  startCommand = "node dist/bot.js"
  restartPolicyType = "ON_FAILURE"
```

- 環境変数: `BOT_TOKEN`, `CLIENT_ID`, `NODE_ENV=production`, `LOG_LEVEL=info`
- SQLiteファイルはRailwayのボリュームにマウント（永続化）
- 無料枠: 月$5クレジット（常時稼働で約500時間分）
