# Workspace 娑堣垂鑰呰縼绉荤瓥鐣?
杩欎唤鏂囨。瀵瑰簲 [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md) 鐨?`TODO 9`锛屼笓闂ㄥ洖绛旓細

- 娑堣垂鑰呯幇鍦ㄥ簲璇ョ敤鍝簺姝ｅ紡鍏ュ彛
- 浠?root 鏃у叆鍙ｈ縼鍒板摢閲?- 浠?compat `src/*` 鍏ュ彛杩佸埌鍝噷

鐩稿叧鏂囨。锛?
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)
- [src-ownership-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/src-ownership-boundary.zh-CN.md)
- [workspace-release-readiness.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-release-readiness.zh-CN.md)

## 1. 褰撳墠姝ｅ紡鍏ュ彛

褰撳墠搴旇浼樺厛浣跨敤锛?
- shared contracts锛歚@openclaw-compact-context/contracts`
- shared runtime core锛歚@openclaw-compact-context/runtime-core`
- runtime 瀛愬叆鍙ｏ細
  - `@openclaw-compact-context/runtime-core/runtime`
  - `@openclaw-compact-context/runtime-core/context-processing`
  - `@openclaw-compact-context/runtime-core/governance`
  - `@openclaw-compact-context/runtime-core/infrastructure`
  - `@openclaw-compact-context/runtime-core/engine/context-engine`
- control-plane core锛歚@openclaw-compact-context/control-plane-core`
- control-plane shell锛歚@openclaw-compact-context/control-plane-shell/*`
- OpenClaw 閫傞厤锛歚@openclaw-compact-context/openclaw-adapter/openclaw`
- plugin bridge / stdio锛歚@openclaw-compact-context/openclaw-adapter/plugin/*`
- apps锛?  - `@openclaw-compact-context/compact-context`
  - `@openclaw-compact-context/control-plane`

## 2. 浠?root 鏃у叆鍙ｈ縼绉?
### 宸茬Щ闄ょ殑鏃у叆鍙?
涓嬮潰杩欎簺鍏ュ彛宸茬粡涓嶅啀浣滀负姝ｅ紡娑堣垂闈㈠瓨鍦細

- root `exports`
- root `bin`
- root `openclaw.extensions`
- `root-compat/*`

### 褰撳墠杩佺Щ鏂瑰紡

| 鏃у叆鍙?| 鏂板叆鍙?|
| --- | --- |
| root 椤跺眰瀵煎叆 | 鎸夎兘鍔涙敼鐢ㄥ叿浣?workspace 鍖?|
| root `openclaw-context-plugin` | `@openclaw-compact-context/compact-context` |
| root `openclaw-control-plane` | `@openclaw-compact-context/control-plane` |

## 3. 浠?compat `src/*` 鍏ュ彛杩佺Щ

涓嬮潰杩欎簺 `src/*` 璺緞浠嶅湪杩佺Щ绐楀彛鍐呬繚鐣欙紝浣嗗凡缁忎笉鏄帹鑽愪富鍏ュ彛锛?
| compat 璺緞 | 鎺ㄨ崘杩佺Щ鐩爣 |
| --- | --- |
| `src/openclaw/*` | `@openclaw-compact-context/openclaw-adapter/openclaw` |
| `src/plugin/*` | `@openclaw-compact-context/openclaw-adapter/plugin/*` |
| `src/control-plane/*` | `@openclaw-compact-context/control-plane-shell/*` 鎴?`@openclaw-compact-context/control-plane-core` |
| `src/control-plane-core/*` | `@openclaw-compact-context/control-plane-core` |
| `src/engine/*` | `@openclaw-compact-context/runtime-core/engine/context-engine` |
| `src/index.ts` | 瀵瑰簲鐨?workspace 姝ｅ紡鍏ュ彛 |

## 4. 鍝簺 `src` 璺緞涓嶄細鍐嶆垚涓烘寮忓叕鍏卞叆鍙?
鍗充究褰撳墠杩樺湪杩佺Щ绐楀彛涓紝杩欎簺璺緞涔熶笉搴旇鍐嶈鍐欒繘鏂扮殑 README / 闆嗘垚璇存槑 / 绀轰緥浠ｇ爜锛?
- `src/index.ts`
- `src/openclaw/*`
- `src/plugin/*`
- `src/control-plane/*`
- `src/control-plane-core/*`
- `src/engine/*`
- `src/adapters/index.ts`
- `src/bin/*`

## 5. breaking change note 鐨勬渶浣庤姹?
濡傛灉鍚庨潰鍒犻櫎鏌愭潯 compat 璺緞锛岃嚦灏戣璇存槑锛?
1. 琚垹鐨勬棫鍏ュ彛鏄粈涔?2. 瀵瑰簲鐨勬柊鍏ュ彛鏄粈涔?3. 鏄惁鏈夎涓哄彉鍖?4. app / package / shell 鐨勮亴璐ｆ湁娌℃湁鍙樺寲

## 6. 涓€鍙ヨ瘽缁撹

`浠庣幇鍦ㄥ紑濮嬶紝娑堣垂鑰呭簲褰撶洿鎺ラ潰鍚?apps/* 鍜?packages/* 鐨勬寮忓叆鍙ｏ紱鍓╀綑 src/* 鍙敤浜庤縼绉荤獥鍙ｅ吋瀹癸紝涓嶅啀浣滀负鎺ㄨ崘 API銆俙


