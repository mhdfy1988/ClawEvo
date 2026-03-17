# Workspace 娴嬭瘯涓庡彂甯冭竟鐣?
杩欎唤鏂囨。鐢ㄦ潵璇存槑 workspace-first 鎷嗗垎涔嬪悗锛屾祴璇曞簲璇ユ€庝箞鍒嗗眰锛屼互鍙婃瘡涓?workspace 褰撳墠鎵挎媴鐨?public API 涓庡彂甯冭亴璐ｃ€?
鐩稿叧鏂囨。锛?- [structure-convergence-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/structure-convergence-todo.zh-CN.md)
- [multi-project-split-plan.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/multi-project-split-plan.zh-CN.md)
- [project-split-dependency-acceptance.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-dependency-acceptance.zh-CN.md)
- [workspace-build-graph-and-cache-strategy.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-build-graph-and-cache-strategy.zh-CN.md)
- [workspace-smoke-baseline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-smoke-baseline.zh-CN.md)
- [workspace-test-ownership.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-ownership.zh-CN.md)
- [workspace-release-audit-matrix.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-release-audit-matrix.zh-CN.md)

## 娴嬭瘯鍒嗗眰

### 1. package unit tests

鐩爣锛氶獙璇佸叡浜寘鑷繁鐨勫鍑洪潰銆佹湇鍔¤涓哄拰杈圭晫锛屼笉鎶?app 澹冲眰鍜?root 鍏煎灞傛贩杩涙潵銆?
褰撳墠瀵瑰簲鑴氭湰锛?- `npm run test:package:contracts`
- `npm run test:package:runtime-core`
- `npm run test:package:control-plane-core`
- `npm run test:package:openclaw-adapter`
- `npm run test:package:control-plane-shell`
- `npm run test:packages`
- 鍏变韩鍑嗗閾撅細`npm run prepare:test:packages`

褰撳墠鎵ц鏂瑰紡锛?- 鍏堝彧鏋勫缓 package 渚濊禆闂寘
- 鍐嶆妸 repo 娴嬭瘯缂栬瘧鍒?run-scoped 涓存椂鐩綍
- 涓嶅啀澶嶇敤 root 鍥哄畾 `dist`

閫傚悎鏀惧湪杩欎竴灞傜殑鍐呭锛?- shared contracts / runtime core / control-plane core 鐨勫崟鍏冧笌鏈嶅姟娴嬭瘯
- adapter / shell 鐨?package-local 琛屼负娴嬭瘯
- 涓嶄緷璧?root compatibility `dist` 鐨勮竟鐣屾祴璇?
### 2. app integration tests

鐩爣锛氶獙璇?app 鍙槸钖勫３锛屼笖鑳芥纭?re-export / 瑁呴厤瀵瑰簲 package銆?
褰撳墠瀵瑰簲鑴氭湰锛?- `npm run test:app:openclaw-plugin`
- `npm run test:app:control-plane`
- `npm run test:apps`
- 鍏变韩鍑嗗閾撅細`npm run prepare:test:apps`

閫傚悎鏀惧湪杩欎竴灞傜殑鍐呭锛?- app manifest 鏄惁鍙緷璧栧搴?shell / adapter package
- app dist 鏄惁浠嶇劧淇濇寔钖勫３缁撴瀯
- app 鍏ュ彛鏄惁姝ｇ‘ re-export 杩愯鏃跺叆鍙ｆ垨 client/server 鍏ュ彛

### 3. root e2e / smoke tests

鐩爣锛氬彧楠岃瘉璺?workspace 鐨勬暣浣撻獙鏀讹紝涓嶅啀璁?root 缁х画鎵挎媴鎵€鏈夌粏绮掑害娴嬭瘯銆?
褰撳墠瀵瑰簲鑴氭湰锛?- `npm run test:smoke:required`
- `npm run test:smoke:release`
- `npm run test:smoke:root`锛堝綋鍓嶅埆鍚嶅埌 `test:smoke:required`锛?- `npm run test:smoke:workspace`锛堝綋鍓嶅埆鍚嶅埌 `test:smoke:required`锛?- 鍙戝竷浜х墿鏍￠獙锛歚npm run pack:workspace`

閫傚悎鏀惧湪杩欎竴灞傜殑鍐呭锛?- workspace pack/build smoke
- workspace 杈撳嚭涓庡彂甯冭竟鐣屾槸鍚︿粛鐒舵敹鏁?- layer boundary / debug smoke

褰撳墠鎷嗗垎锛?- `蹇呰 smoke`
  - `workspace-smoke`
  - `layer-boundaries`
- `鍙戝竷 smoke`
  - `workspace-smoke`
  - `layer-boundaries`
  - `debug-smoke`
  - `pack:workspace`

褰撳墠 workspace 缂栬瘧渚濊禆鍥惧拰鎷撴墤椤哄簭鍙互鐩存帴閫氳繃涓嬮潰鍛戒护鏌ョ湅锛?
```powershell
npm run describe:workspace:graph
```

骞跺彂淇濇姢锛?- app / smoke 娴嬭瘯涓嶅啀澶嶇敤鍥哄畾 `dist-smoke`锛岃€屾槸姣忔杩愯鐢熸垚鍞竴鐨勪复鏃剁紪璇戠洰褰?- workspace `build:self / check:self` 閫氳繃閿侀伩鍏嶅苟鍙戞竻鐞嗗悓涓€涓?workspace `dist`
- `pack:workspace` 鍦ㄦ牎楠屼笌 dry-run 鏈熼棿澶嶇敤鍚屼竴鎶?workspace 閿侊紝閬垮厤璇诲埌琚苟鍙戜慨鏀圭殑浜х墿
- root 绾?`build / check / pack / test:*` 鍏ュ彛缁熶竴閫氳繃 `workspace-artifacts` 閿佷覆琛屽寲鍏变韩浜х墿璁块棶锛岄伩鍏嶉《灞傚懡浠や簰鐩告竻鐞嗕緷璧栭摼涓婄殑 `dist`
- 褰撳墠 smoke 鑰楁椂鍩虹嚎瑙侊細[workspace-smoke-baseline.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-smoke-baseline.zh-CN.md)

### 4. evaluation tests

鐩爣锛氫繚鎸佸拰涓氬姟璇勪及閾捐矾鐙珛锛屼笉涓?package/app 杈圭晫娴嬭瘯娣峰湪涓€璧枫€?
褰撳墠瀵瑰簲鑴氭湰锛?- `npm run test:evaluation`

## 鍙戝竷杈圭晫

### root package

鑱岃矗锛?- workspace orchestrator
- repo 绾?`check / build / test / smoke / CI`
- repo-level test harness 涓庢枃妗ｅ叆鍙?
涓嶅啀鎵挎媴锛?- 鐪熷疄涓诲疄鐜板彂甯冨崟鍏?- 鎸佺画鎵╁紶鐨勫唴閮ㄦā鍧楀叕鍏卞嚭鍙?
### `@openclaw-compact-context/contracts`

鑱岃矗锛?- shared contracts
- shared pure types

public API 鏈熸湜锛?- 绋冲畾銆佸皬鑰屾槑纭?- 涓嶅甫 runtime / platform / adapter concrete

鐗堟湰鑺傚锛?- 鍙湪 contract 鍙樺寲鏃舵墠闇€瑕佹彁鍗囧彲瑙佺増鏈?
### `@openclaw-compact-context/runtime-core`

鑱岃矗锛?- 涓婁笅鏂囧鐞?- 杩愯鏃剁煡璇嗗浘璋变笌璁板繂搴曞骇
- 鍏变韩 persistence / governance core

public API 鏈熸湜锛?- 鍙毚闇插叡浜繍琛屾椂鏍稿績鍏ュ彛
- 涓嶅弽鍚戞毚闇?OpenClaw adapter 渚у疄鐜?
鐗堟湰鑺傚锛?- 璺熼殢 runtime / knowledge / persistence shared core 婕旇繘

### `@openclaw-compact-context/control-plane-core`

鑱岃矗锛?- governance / observability / import / facade 绛夊钩鍙版牳蹇冩湇鍔?
public API 鏈熸湜锛?- 鍙毚闇插钩鍙版牳蹇冩湇鍔′笌 contract
- 涓嶅弽鍚戝甫鍏?plugin runtime concrete

鐗堟湰鑺傚锛?- 璺熼殢鎺у埗骞冲彴鏈嶅姟鍗忚鍙樺寲

### `@openclaw-compact-context/openclaw-adapter`

鑱岃矗锛?- OpenClaw 瀹夸富閫傞厤
- plugin shell
- hooks / gateway / stdio 妗ユ帴

public API 鏈熸湜锛?- 鍙毚闇插涓婚€傞厤涓庢彃浠跺３灞傞渶瑕佺殑鍏ュ彛
- 涓嶅甫鍏ユ暣妫?runtime/control-plane implementation tree

鐗堟湰鑺傚锛?- 璺熼殢瀹夸富閫傞厤鍗忚鍙樺寲

### `@openclaw-compact-context/control-plane-shell`

鑱岃矗锛?- control-plane `server / client / console / CLI` 澹冲眰

public API 鏈熸湜锛?- 鍙毚闇插钩鍙板３灞傚叆鍙?- 骞冲彴鏍稿績琛屼负鏉ヨ嚜 `control-plane-core`

鐗堟湰鑺傚锛?- 璺熼殢鎺у埗闈㈠叆鍙ｅ崗璁彉鍖?
### `@openclaw-compact-context/compact-context`

鑱岃矗锛?- 鍙戝竷 OpenClaw 鎻掍欢 app 钖勫３

public API 鏈熸湜锛?- 鍙壙鎷?app-local 鍏ュ彛涓?bin
- 鐪熸瀹炵幇鏉ヨ嚜 `openclaw-adapter`

### `@openclaw-compact-context/control-plane`

鑱岃矗锛?- 鍙戝竷 control-plane app 钖勫３

public API 鏈熸湜锛?- 鍙壙鎷?app-local 鍏ュ彛銆乧lient 鍏ュ彛涓?bin
- 鐪熸瀹炵幇鏉ヨ嚜 `control-plane-shell`

## 褰撳墠缁撹

鐜板湪鍙互鎶?workspace 鐨勮亴璐ｇ悊瑙ｆ垚锛?
- `packages/*`锛氬叡浜兘鍔涘拰鍙鐢ㄦ湇鍔?- `apps/*`锛氬彲杩愯鐨勫彂甯冨３灞?- `root`锛氱紪鎺掍笌鏈€灏忓吋瀹归潰

鍚庣画濡傛灉缁х画寰€澶氫粨搴撴帹杩涳紝杩欎唤鏂囨。灏辨槸 workspace 绾у彂甯冭竟鐣岀殑鍩虹鐗堟湰銆?
琛ュ厖璇存槑锛?- `pack:workspace` 褰撳墠浼氳鐩栧叏閮ㄥ彲鍙戝竷 workspace锛?  - `packages/contracts`
  - `packages/runtime-core`
  - `packages/control-plane-core`
  - `packages/openclaw-adapter`
  - `packages/control-plane-shell`
  - `apps/openclaw-plugin`
  - `apps/control-plane`
- `pack:workspace` 鍦?dry-run 涔嬪墠浼氬厛鏍￠獙姣忎釜 workspace `package.json` 涓０鏄庣殑鐜版湁浜х墿銆乣exports`銆乣bin`銆乣openclaw.extensions` 涓?`files` 璺緞锛岄伩鍏嶉€氳繃 `prepack` 鎴栭殣寮忔瀯寤哄厹搴曘€?

